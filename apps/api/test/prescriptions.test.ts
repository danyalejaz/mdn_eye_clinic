import { afterAll, expect, it } from "vitest";
import { cookies, password, testPlatform } from "./platform";
import { startVisit } from "./visit";

let platform: Awaited<ReturnType<typeof testPlatform>>;
afterAll(async () => { await platform?.dispose(); });

it("keeps prescriptions private until approved and released, with immutable amendments and PDF access", async () => {
  platform = await testPlatform(["public-catalog.sql"]);
  const visit = await startVisit(platform);
  const { request } = platform;
  const cookie = visit.doctor.cookie;
  const items = [{ medicine: "Fictional Test Item", dose: "TEST", frequency: "TEST", instructions: "For automated tests only" }];
  const result = await visit.post("/prescriptions", { encounterId: visit.encounterId, items }, cookie);
  expect(result.status).toBe(201);
  const { data: { id } } = await result.json<{ data: { id: string } }>();
  const path = `/prescriptions/${id}`;
  expect((await request(`/api/v1${path}`, { cookie: visit.patientCookie })).status).toBe(404);
  expect((await request(`/api/v1${path}`, { cookie: visit.reception.cookie })).status).toBe(403);
  expect((await visit.post(`${path}/approve`, { expectedVersion: 1 }, cookie, "approval-001")).status).toBe(200);
  expect((await visit.post(`${path}/approve`, { expectedVersion: 1 }, cookie, "approval-001")).status).toBe(200);
  expect((await visit.post(`${path}/release`, {}, cookie)).status).toBe(409);
  expect((await request(`/api/v1${path}`, { method: "PATCH", body: { expectedVersion: 2, items }, cookie })).status).toBe(409);
  expect((await request(`/api/v1${path}/pdf`, { cookie: visit.patientCookie })).status).toBe(404);
  expect((await request(`/api/v1/encounters/${visit.encounterId}`, {
    method: "PATCH", cookie, body: { expectedVersion: 1, notes: { assessment: "Test only" } },
  })).status).toBe(200);
  expect((await visit.post(`/encounters/${visit.encounterId}/finalize`, { expectedVersion: 2 }, cookie)).status).toBe(200);
  expect((await visit.post(`${path}/release`, {}, cookie)).status).toBe(201);
  await platform.env.DB.batch([
    platform.env.DB.prepare("UPDATE doctors SET display_name = 'Updated Doctor' WHERE id = 'doc_demo_a'"),
    platform.env.DB.prepare("UPDATE patients SET display_name = 'Updated Patient' WHERE id = ?").bind(visit.patientId),
  ]);
  const ownDetail = await request(`/api/v1${path}`, { cookie: visit.patientCookie });
  expect(await ownDetail.json()).toMatchObject({
    data: { doctorName: "Demo Doctor A", patientName: "Fictional Visit Patient" },
  });
  const email = "non-owner@example.test";
  await platform.account(email, "patient");
  const nonOwner = cookies(await request("/api/auth/sign-in/email", { body: { email, password } }));
  expect((await request(`/api/v1${path}/pdf`, { cookie: nonOwner })).status).toBe(404);
  const pdf = await request(`/api/v1${path}/pdf`, { cookie: visit.patientCookie });
  expect(pdf.headers.get("Content-Type")).toBe("application/pdf");
  expect((await pdf.text()).slice(0, 5)).toBe("%PDF-");
  const amendment = await visit.post(`${path}/amendments`, { reason: "Test correction", items }, cookie);
  expect(amendment.status).toBe(201);
  const { data: amended } = await amendment.json<{ data: { id: string } }>();
  expect((await visit.post(`/prescriptions/${amended.id}/approve`, { expectedVersion: 1 }, cookie, "approval-002")).status).toBe(200);
  expect(await (await request("/api/v1/prescriptions", { cookie: visit.patientCookie })).json())
    .toMatchObject({ data: [{ id, status: "superseded" }] });
}, 20_000);
