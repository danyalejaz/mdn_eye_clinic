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

  return { env, request, account, dispose: () => platform.dispose() };
}

export function cookies(response: Response) {
  return response.headers.getSetCookie().filter((value) => !value.includes("Max-Age=0"))
    .map((value) => value.split(";", 1)[0]).join("; ");
}
