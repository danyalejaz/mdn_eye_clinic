import { afterAll, beforeAll, expect, it } from "vitest";
import { getAuth } from "../src/identity";
import { cookies, password, testPlatform } from "./platform";

let platform: Awaited<ReturnType<typeof testPlatform>>;
beforeAll(async () => { platform = await testPlatform(); }, 15_000);
afterAll(async () => { await platform?.dispose(); });

it("requires a real session and an active clinic account", async () => {
  const path = "/api/v1/me";
  expect((await platform.request(path)).status).toBe(401);
  expect((await platform.request("/api/auth/sign-up/email", { body: {} })).status).toBe(404);
  const email = "patient@example.test";
  const userId = await platform.account(email, "patient");
  const signedIn = await platform.request("/api/auth/sign-in/email", { body: { email, password } });
  expect(signedIn.status).toBe(200);
  expect(await signedIn.json()).not.toHaveProperty("token");
  const cookie = cookies(signedIn);
  const me = await platform.request(path, { cookie });
  expect(await me.json()).toEqual({ data: { userId, role: "patient", doctorId: null, patientId: null } });
  await platform.env.DB.prepare("UPDATE clinic_accounts SET active = 0 WHERE user_id = ?").bind(userId).run();
  expect((await platform.request(path, { cookie })).status).toBe(403);
});

it("requires MFA for each staff session and rejects foreign origins", async () => {
  const email = "staff@example.test";
  await platform.account(email, "receptionist");
  const signIn = (ip = "192.0.2.1") => platform.request("/api/auth/sign-in/email", {
    body: { email, password }, headers: { "CF-Connecting-IP": ip },
  });
  const oldCookie = cookies(await signIn());
  expect((await platform.request("/api/v1/me", { cookie: oldCookie })).status).toBe(403);
  const cookie = cookies(await signIn());
  const enablePath = "/api/auth/two-factor/enable";
  expect((await platform.request(enablePath, { cookie, body: { password }, origin: "https://elsewhere.example" })).status).toBe(403);
  const enrolled = await platform.request(enablePath, { cookie, body: { password } });
  expect(enrolled.status).toBe(200);
  const { totpURI } = await enrolled.json<{ totpURI: string }>();
  const encoded = new URL(totpURI).searchParams.get("secret")!;
  const bits = [...encoded.replace(/=+$/, "")].map((char) =>
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char).toString(2).padStart(5, "0"),
  ).join("");
  const secret = String.fromCharCode(...(bits.match(/.{8}/g) ?? []).map((byte) => parseInt(byte, 2)));
  const { code } = await getAuth(platform.env).api.generateTOTP({ body: { secret } });
  const verify = (session: string) => platform.request("/api/auth/two-factor/verify-totp", { cookie: session, body: { code } });
  const verified = await verify(cookie);
  expect(verified.status).toBe(200);
  expect((await platform.request("/api/v1/me", { cookie: cookies(verified) })).status).toBe(200);
  expect((await platform.request("/api/v1/me", { cookie: oldCookie })).status).not.toBe(200);
  const challenge = await signIn("192.0.2.2");
  expect(await challenge.json()).toMatchObject({ twoFactorRedirect: true });
  expect((await platform.request("/api/v1/me", { cookie: cookies(challenge) })).status).toBe(401);
  const fresh = await verify(cookies(challenge));
  expect(fresh.status).toBe(200);
  expect((await platform.request("/api/v1/me", { cookie: cookies(fresh) })).status).toBe(200);
});
