import { afterAll, expect, it } from "vitest";
import { provisionAccount } from "../src/provision";
import { cookies, password, testPlatform } from "./platform";

let platform: Awaited<ReturnType<typeof testPlatform>>;
afterAll(async () => { await platform?.dispose(); });

it("provisions accounts, publishes snapshots and protects administration, reports and redacted audit", async () => {
  platform = await testPlatform(["public-catalog.sql"]);
  const { env, request } = platform;
  const bootstrap = { email: "bootstrap@example.test", name: "Demo Bootstrap", password, role: "admin" as const };
  expect(await provisionAccount(env.DB, bootstrap, null, "boot-1")).toBeTruthy();
  expect(await provisionAccount(env.DB, { ...bootstrap, email: "duplicate@example.test" }, null, "boot-2")).toBeNull();
  const [admin, reception] = await Promise.all([platform.staff("admin"), platform.staff("receptionist")]);
  const api = "/api/v1";
  const op = (path: string, method = "GET", body?: object) => request(`${api}/admin${path}`, {
    cookie: admin.cookie, method, body,
  });
  expect((await request(`${api}/admin/audit-logs`, { cookie: reception.cookie })).status).toBe(403);
  expect((await op("/reports")).status).toBe(200);
  const page = "/content/visit-info";
  expect((await op(page, "PUT", { title: "Draft title", body: "Demo content", expectedVersion: 0 })).status).toBe(200);
  const publicPage = () => request(`${api}/public/pages/visit-info`);
  expect((await publicPage()).status).toBe(404);
  expect((await op(`${page}/publish`, "POST", { expectedVersion: 1 })).status).toBe(200);
  expect((await op(page, "PUT", { title: "Private draft", body: "New draft", expectedVersion: 2 })).status).toBe(200);
  expect(await (await publicPage()).json()).toMatchObject({ data: { title: "Draft title" } });

  const tomorrow = new Date(Date.now() + 172_800_000).toISOString().slice(0, 10);
  const slot = { doctorId: "doc_demo_a", startAt: `${tomorrow}T03:00:00.000Z`, endAt: `${tomorrow}T03:30:00.000Z` };
  expect((await op("/slots", "POST", slot)).status).toBe(201);
  expect((await op("/slots", "POST", { ...slot, startAt: `${tomorrow}T03:10:00.000Z` })).status).toBe(409);

  const patient = await request(`${api}/patients`, { cookie: reception.cookie, body: { displayName: "Demo patient" } });
  const { data: { id: patientId } } = await patient.json<{ data: { id: string } }>();
  const email = "provisioned@example.test";
  const accountData = { email, password, name: "Demo patient", role: "patient", patientId };
  const account = await op("/accounts", "POST", accountData);
  expect(account.status).toBe(201);
  const { data: { userId } } = await account.json<{ data: { userId: string } }>();
  expect((await op("/accounts", "POST", { ...accountData, email: "other@example.test" })).status).toBe(409);
  const login = await request("/api/auth/sign-in/email", { body: { email, password } });
  const cookie = cookies(login);
  expect(await (await request(`${api}/me`, { cookie })).json()).toMatchObject({ data: { patientId } });
  expect((await op(`/accounts/${userId}`, "PATCH", { active: false })).status).toBe(200);
  expect((await request(`${api}/me`, { cookie })).status).toBe(401);
  const audit = await (await op("/audit-logs")).text();
  expect(audit).toContain("content.publish");
  expect(audit).toContain("account.deactivate");
  expect(audit).not.toContain(password);
  expect(audit).not.toContain("New draft");
}, 20_000);
