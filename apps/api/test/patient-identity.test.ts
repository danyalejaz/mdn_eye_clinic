import { afterAll, expect, it, vi } from "vitest";
import { cookies, password, testPlatform } from "./platform";

let platform: Awaited<ReturnType<typeof testPlatform>>;
afterAll(async () => { vi.restoreAllMocks(); await platform?.dispose(); });

it("verifies a new patient without linking existing records and recovers the account once", async () => {
  platform = await testPlatform();
  const { env, request } = platform;
  const staffEmail = "staff-recovery@example.test";
  await platform.account(staffEmail, "receptionist");
  env.AUTH_EMAIL_API_KEY = "test-only";
  env.AUTH_EMAIL_FROM = "clinic@example.test";
  const messages: { to: string[]; text: string }[] = [];
  const original = globalThis.fetch;
  vi.spyOn(globalThis, "fetch").mockImplementation(async (url, init) => {
    if (String(url) !== "https://api.resend.com/emails") return original(url, init);
    messages.push(JSON.parse(String(init?.body)));
    return Response.json({ id: "fictional-message" });
  });
  const headers = { "CF-Connecting-IP": "192.0.2.75" };
  const call = (path: string, body: object) => request(`/api/auth/${path}`, { body, headers });
  const email = "new-patient@example.test";
  const registration = { email, password, name: "Fictional Patient" };
  const signedUp = await call("sign-up/email", registration);
  expect(signedUp.status).toBe(202);
  expect(await signedUp.json()).not.toHaveProperty("user");
  expect(messages).toHaveLength(1);
  expect((await call("sign-up/email", { ...registration, role: "admin" })).status).toBe(422);
  const pre = cookies(await call("sign-in/email", { email, password }));
  expect((await request("/api/v1/me", { cookie: pre })).status).toBe(403);
  const verification = new URL(messages[0].text.split("\n")[2]);
  const verificationPath = verification.pathname + verification.search;
  expect((await request(verificationPath)).status).toBe(401);
  expect((await request("/api/v1/me", { cookie: pre })).status).toBe(403);
  expect((await request(verificationPath, { cookie: pre })).status).toBe(200);
  expect((await request(verificationPath, { cookie: pre })).status).toBe(200);
  expect(await (await request("/api/v1/me", { cookie: pre })).json()).toMatchObject({
    data: { role: "patient", patientId: expect.any(String), doctorId: null },
  });
  expect(await env.DB.prepare("SELECT COUNT(*) AS count FROM patients").first()).toEqual({ count: 1 });
  expect((await call("request-password-reset", { email: staffEmail })).status).toBe(200);
  expect(messages).toHaveLength(1);
  expect((await call("request-password-reset", { email })).status).toBe(200);
  expect(messages).toHaveLength(2);
  const recovery = new URL(messages[1].text.split("\n")[2]);
  const token = new URLSearchParams(recovery.hash.slice(1)).get("token");
  expect(recovery.pathname).toBe("/reset-password");
  const newPassword = "fictional-new-password";
  expect((await call("reset-password", { token, newPassword })).status).toBe(200);
  expect((await call("reset-password", { token, newPassword })).ok).toBe(false);
  expect((await request("/api/v1/me", { cookie: pre })).status).toBe(401);
  expect((await call("sign-in/email", { email, password })).status).toBe(401);
  expect((await call("sign-in/email", { email, password: newPassword })).status).toBe(200);
}, 20_000);
