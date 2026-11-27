import { betterAuth } from "better-auth";
import { twoFactor } from "better-auth/plugins/two-factor";
import type { Context, MiddlewareHandler } from "hono";

export type Role = "patient" | "receptionist" | "doctor" | "admin";
export type Actor = { userId: string; role: Role; doctorId: string | null; patientId: string | null };
export type ApiEnv = {
  Bindings: Pick<Env, "DB"> & { AUTH_BASE_URL?: string; BETTER_AUTH_SECRET?: string };
  Variables: { requestId: string; actor: Actor };
};

export function getAuth(env: ApiEnv["Bindings"]) {
  if (!env.AUTH_BASE_URL || !env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw new Error("Authentication is not configured");
  }
  const baseURL = new URL(env.AUTH_BASE_URL);
  const local = baseURL.protocol === "http:" && ["localhost", "127.0.0.1"].includes(baseURL.hostname);
  if (baseURL.protocol !== "https:" && !local) throw new Error("Authentication requires HTTPS");

  return betterAuth({
    database: env.DB,
    baseURL: baseURL.origin,
    secret: env.BETTER_AUTH_SECRET,
    telemetry: { enabled: false },
    logger: { disabled: true },
    emailAndPassword: { enabled: true, autoSignIn: false, minPasswordLength: 12 },
    advanced: { useSecureCookies: !local, ipAddress: { ipAddressHeaders: ["cf-connecting-ip"] } },
    rateLimit: { enabled: true, storage: "database" },
    session: { additionalFields: { mfaVerified: { type: "boolean", defaultValue: false, input: false } } },
    databaseHooks: {
      session: {
        create: {
          before: async (session, context) => ({
            data: {
              ...session,
              mfaVerified: ["/two-factor/verify-totp", "/two-factor/verify-backup-code"].includes(context?.path ?? ""),
            },
          }),
        },
      },
    },
    plugins: [twoFactor({ issuer: "Mardan Eye Clinic" })],
  });
}

export function apiError(c: Context<ApiEnv>, status: 400 | 401 | 403 | 404 | 409 | 422 | 503, code: string, message: string) {
  return c.json({ error: { code, message }, requestId: c.get("requestId") }, status);
}

export const requireActor: MiddlewareHandler<ApiEnv> = async (c, next) => {
  if (!c.req.header("Cookie")) return apiError(c, 401, "AUTH_REQUIRED", "Sign in to continue.");
  const auth = getAuth(c.env);
  const identity = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!identity) return apiError(c, 401, "AUTH_REQUIRED", "Sign in to continue.");

  const actor = await c.env.DB.prepare(`
    SELECT a.user_id AS userId, a.role, a.doctor_id AS doctorId, p.id AS patientId
    FROM clinic_accounts a LEFT JOIN patients p ON p.user_id = a.user_id
    WHERE a.user_id = ? AND a.active = 1
  `).bind(identity.user.id).first<Actor>();

  if (!actor || (actor.role !== "patient" && (!identity.user.twoFactorEnabled || !identity.session.mfaVerified))) {
    return apiError(c, 403, "FORBIDDEN", "This account is not authorized for the requested operation.");
  }

  if (!["GET", "HEAD", "OPTIONS"].includes(c.req.method) &&
      c.req.header("Origin") !== new URL(c.env.AUTH_BASE_URL!).origin) {
    return apiError(c, 403, "FORBIDDEN", "Request origin is not authorized.");
  }

  c.set("actor", actor);
  await next();
};

export function requireRole(...roles: Role[]): MiddlewareHandler<ApiEnv> {
  return async (c, next) => {
    if (!roles.includes(c.get("actor").role)) {
      return apiError(c, 403, "FORBIDDEN", "This operation is not available to your role.");
    }
    await next();
  };
}

const authRoutes = new Set([
  "POST /sign-in/email", "POST /sign-out",
  "POST /two-factor/enable", "POST /two-factor/verify-totp", "POST /two-factor/verify-backup-code",
]);

export async function handleAuth(c: Context<ApiEnv>) {
  if (!authRoutes.has(`${c.req.method} ${c.req.path.slice("/api/auth".length)}`)) return c.notFound();
  if (c.req.method === "POST" && (!c.env.AUTH_BASE_URL ||
      c.req.header("Origin") !== new URL(c.env.AUTH_BASE_URL).origin)) {
    return apiError(c, 403, "FORBIDDEN", "Request origin is not authorized.");
  }
  const response = await getAuth(c.env).handler(c.req.raw);
  if (!response.ok) return response;
  const data = await response.json<Record<string, unknown>>();
  const { token: _token, session: _session, ...safeData } = data;
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return Response.json(safeData, { status: response.status, headers });
}
