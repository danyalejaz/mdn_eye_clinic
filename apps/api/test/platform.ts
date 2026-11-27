import { readdir, readFile } from "node:fs/promises";
import { URL } from "node:url";
import { getPlatformProxy } from "wrangler";
import { getAuth, type ApiEnv } from "../src/identity";
import app from "../src/index";

export const origin = "http://localhost:8787";
export const password = "fictional-test-only-password";

export async function testPlatform(fixtures: string[] = []) {
  const platform = await getPlatformProxy<Pick<Env, "DB">>({ configPath: "wrangler.jsonc", persist: false });
  const env: ApiEnv["Bindings"] = {
    ...platform.env, AUTH_BASE_URL: origin, BETTER_AUTH_SECRET: crypto.randomUUID() + crypto.randomUUID(),
  };
  const migrations = new URL("../../../packages/database/migrations/", import.meta.url);
  try {
    const files = (await readdir(migrations)).filter((name) => name.endsWith(".sql")).sort()
      .map((name) => new URL(name, migrations));
    for (const file of [...files, ...fixtures.map((name) => new URL(`./fixtures/${name}`, import.meta.url))]) {
      const sql = await readFile(file, "utf8");
      const statements = sql.split(/^-- statement-breakpoint\s*$/m);
      const queries = statements.flatMap((statement) => /^\s*CREATE TRIGGER\b/i.test(statement)
        ? [statement.trim()] : statement.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean));
      await env.DB.batch(queries.map((query) => env.DB.prepare(query)));
    }
  } catch (error) {
    await platform.dispose();
    throw error;
  }

  function request(path: string, options?: { body?: object; cookie?: string; origin?: string; method?: string; headers?: Record<string, string> }) {
    const headers = new Headers(options?.headers);
    if (options?.cookie) headers.set("Cookie", options.cookie);
    if (options?.body) headers.set("Content-Type", "application/json");
    const method = options?.method ?? (options?.body ? "POST" : "GET");
    if (method !== "GET") headers.set("Origin", options?.origin ?? origin);
    return app.request(`${origin}${path}`, {
      headers, method, body: options?.body ? JSON.stringify(options.body) : undefined,
    }, env);
  }

  async function account(email: string, role: string, doctorId: string | null = null) {
    const { user } = await getAuth(env).api.signUpEmail({ body: { email, password, name: email.split("@")[0] } });
    await env.DB.prepare("INSERT INTO clinic_accounts (user_id, role, doctor_id) VALUES (?, ?, ?)")
      .bind(user.id, role, doctorId).run();
    return user.id;
  }

  async function staff(role: string, doctorId: string | null = null) {
    const email = `${role}-${crypto.randomUUID()}@example.test`;
    const userId = await account(email, role, doctorId);
    const headers = { "CF-Connecting-IP": `2001:db8::${crypto.randomUUID().slice(0, 4)}` };
    const initial = await request("/api/auth/sign-in/email", { body: { email, password }, headers });
    if (!initial.ok) throw new Error(`Staff sign-in failed: ${initial.status}`);
    const cookie = cookies(initial);
    const enabled = await request("/api/auth/two-factor/enable", { cookie, body: { password }, headers });
    if (!enabled.ok) throw new Error(`MFA enrollment failed: ${enabled.status}`);
    const { totpURI } = await enabled.json<{ totpURI: string }>();
    const code = await totpCode(env, totpURI);
    const verified = await request("/api/auth/two-factor/verify-totp", { cookie, body: { code }, headers });
    if (!verified.ok) throw new Error(`MFA verification failed: ${verified.status}`);
    return { userId, cookie: cookies(verified) };
  }

  return { env, request, account, staff, dispose: () => platform.dispose() };
}

export async function totpCode(env: ApiEnv["Bindings"], totpURI: string) {
  const encoded = new URL(totpURI).searchParams.get("secret")!;
  const bits = [...encoded.replace(/=+$/, "")].map((char) =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char).toString(2).padStart(5, "0"),
  ).join("");
  const secret = String.fromCharCode(...(bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const { code } = await getAuth(env).api.generateTOTP({ body: { secret } });
  return code;
}
export function cookies(response: Response) {
  return response.headers.getSetCookie().filter((value) => !value.includes("Max-Age=0"))
    .map((value) => value.split(";", 1)[0]).join("; ");
}
