import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { twoFactor } from "better-auth/plugins/two-factor";
import type { Context, MiddlewareHandler } from "hono";
import { authMailConfigured, sendAuthMail } from "./auth-mail";
import { provisionVerifiedPatient } from "./patient-identity";

export type Role = "patient" | "receptionist" | "doctor" | "admin";
export type Actor = { userId: string; role: Role; doctorId: string | null; patientId: string | null };
export type ApiEnv = {
  Bindings: Pick<Env, "DB"> & {
    AUTH_BASE_URL?: string; BETTER_AUTH_SECRET?: string;
    AUTH_EMAIL_API_KEY?: string; AUTH_EMAIL_FROM?: string;
  };
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
    emailAndPassword: {
      enabled: true, autoSignIn: false, minPasswordLength: 12, maxPasswordLength: 128,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: 1800,
      sendResetPassword: authMailConfigured(env) ? async ({ user, token }) => {
        if (!user.emailVerified) return;
        const account = await env.DB.prepare("SELECT active FROM clinic_accounts WHERE user_id = ?")
          .bind(user.id).first<{ active: number }>();
        if (account?.active === 0) return;
        const link = new URL("/reset-password", baseURL);
        link.hash = new URLSearchParams({ token }).toString();
        // Keep the public reset response indistinguishable if delivery fails.
        await sendAuthMail(env, user.email, "Reset your clinic password", link).catch(() => {
          console.error({ event: "auth.password_reset.delivery_failed" });
        });
      } : undefined,
    },
    emailVerification: authMailConfigured(env) ? {
      sendOnSignUp: true,
      expiresIn: 1800,
      sendVerificationEmail: async ({ user, token }) => {
        // Provisioned users cannot use public resend to claim an unverified staff or patient identity.
        const account = await env.DB.prepare("SELECT 1 FROM clinic_accounts WHERE user_id = ?").bind(user.id).first();
        if (account) return;
        const link = new URL("/api/auth/verify-email", baseURL);
        link.searchParams.set("token", token);
        await sendAuthMail(env, user.email, "Verify your clinic email", link).catch(() => {
          console.error({ event: "auth.email_verification.delivery_failed" });
        });
      },
      beforeEmailVerification: async (user, request) => {
        // Require both control of the inbox and the credentials used at registration.
        // Otherwise an unsolicited signup link could activate an attacker-chosen password.
        const session = request && await readAuthSession(env, request.headers);
        if (!session || session.user.id !== user.id) {
          throw new APIError("UNAUTHORIZED", {
            code: "VERIFICATION_SESSION_REQUIRED",
            message: "Sign in with the account you registered, then reopen the verification link.",
          });
        }
      },
      afterEmailVerification: (user) => provisionVerifiedPatient(env.DB, user.id),
    } : undefined,
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

async function readAuthSession(env: ApiEnv["Bindings"], headers: Headers): Promise<{ user: { id: string } } | null> {
  return getAuth(env).api.getSession({ headers });
}

export function apiError(c: Context<ApiEnv>, status: 400 | 401 | 403 | 404 | 409 | 422 | 503, code: string, message: string) {
  return c.json({ error: { code, message }, requestId: c.get("requestId") }, status);
}

export const requireActor: MiddlewareHandler<ApiEnv> = async (c, next) => {
  if (!c.req.header("Cookie")) return apiError(c, 401, "AUTH_REQUIRED", "Sign in to continue.");
  const auth = getAuth(c.env);
  const identity = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!identity) return apiError(c, 401, "AUTH_REQUIRED", "Sign in to continue.");

  const lookup = c.env.DB.prepare(`
    SELECT a.user_id AS userId, a.role, a.doctor_id AS doctorId, p.id AS patientId
    FROM clinic_accounts a LEFT JOIN patients p ON p.user_id = a.user_id
    WHERE a.user_id = ? AND a.active = 1
  `).bind(identity.user.id);
  let actor = await lookup.first<Actor>();
  if (!actor && identity.user.emailVerified &&
      !await c.env.DB.prepare("SELECT 1 FROM clinic_accounts WHERE user_id = ?").bind(identity.user.id).first()) {
    await provisionVerifiedPatient(c.env.DB, identity.user.id);
    actor = await lookup.first<Actor>();
  }

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
const selfServiceRoutes = new Set([
  "POST /sign-up/email", "POST /send-verification-email", "GET /verify-email",
  "POST /request-password-reset", "POST /reset-password",
]);

export async function handleAuth(c: Context<ApiEnv>) {
  const route = `${c.req.method} ${c.req.path.slice("/api/auth".length)}`;
  if (!authRoutes.has(route) && !selfServiceRoutes.has(route)) return c.notFound();
  if (c.req.method === "POST" && (!c.env.AUTH_BASE_URL ||
      c.req.header("Origin") !== new URL(c.env.AUTH_BASE_URL).origin)) {
    return apiError(c, 403, "FORBIDDEN", "Request origin is not authorized.");
  }
  if (selfServiceRoutes.has(route) && !authMailConfigured(c.env)) {
    return apiError(c, 503, "TEMPORARILY_UNAVAILABLE", "Email-based account services are unavailable.");
  }
  if (route === "POST /sign-up/email") {
    const body: unknown = await c.req.raw.clone().json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body) ||
        Object.keys(body).some((key) => !["name", "email", "password"].includes(key)) ||
        !("name" in body) || typeof body.name !== "string" ||
        !body.name.trim() || body.name.length > 120) {
      return apiError(c, 422, "VALIDATION_FAILED", "Enter a valid name, email, and password.");
    }
  }
  if (route === "GET /verify-email") c.header("Referrer-Policy", "no-referrer");
  const response = await getAuth(c.env).handler(c.req.raw);
  if (!response.ok) return response;
  if (route === "POST /sign-up/email") {
    return c.json({ status: true, message: "Check your email for account verification instructions." }, 202);
  }
  const data = await response.json<Record<string, unknown>>();
  const { token: _token, session: _session, ...safeData } = data;
  const headers = new Headers(response.headers);
  headers.delete("Content-Length");
  return Response.json(safeData, { status: response.status, headers });
}
