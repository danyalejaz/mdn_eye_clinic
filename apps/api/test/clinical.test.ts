import { afterAll, expect, it } from "vitest";
import { testPlatform } from "./platform";
import { startVisit } from "./visit";

let platform: Awaited<ReturnType<typeof testPlatform>>;
afterAll(async () => { await platform?.dispose(); });

it("finalizes a versioned encounter and reveals only its explicitly released summary", async () => {
  platform = await testPlatform(["public-catalog.sql"]);
  const { request } = platform;
  const visit = await startVisit(platform);
  const path = `/api/v1/encounters/${visit.encounterId}`;
  const history = `/api/v1/patients/${visit.patientId}/history`;
  const cookie = visit.doctor.cookie;
  expect((await request(path, { cookie: visit.reception.cookie })).status).toBe(403);
  expect((await request(history, { cookie: visit.reception.cookie })).status).toBe(403);
  const otherDoctor = await platform.staff("doctor", "doc_demo_b");
  expect((await request(path, { cookie: otherDoctor.cookie })).status).toBe(404);
  expect((await request(history, { cookie: otherDoctor.cookie })).status).toBe(404);
  const patch = (expectedVersion: number) => request(path, {
    method: "PATCH", cookie, body: { expectedVersion, notes: { assessment: "Internal demo note", vitals: { pulseBpm: null } } },
  });
  expect((await patch(1)).status).toBe(200);
  expect((await patch(1)).status).toBe(409);
  expect((await request(`${path}/finalize`, { cookie, body: { expectedVersion: 2 } })).status).toBe(200);
  expect((await patch(3)).status).toBe(409);
  expect(await (await request(history, { cookie: visit.patientCookie })).json()).toEqual({ data: [] });
  expect((await request(`${path}/amendments`, { cookie, body: { reason: "Correction", correction: "Internal addition" } })).status).toBe(201);
  expect((await request(`${path}/release`, { cookie, body: { summary: "Approved fictional summary" } })).status).toBe(201);
  const patientHistory = await (await request(history, { cookie: visit.patientCookie })).text();
  expect(patientHistory).toContain("Approved fictional summary");
  expect(patientHistory).not.toContain("Internal");
  expect(await (await request(`/api/v1/appointments/${visit.appointmentId}`, { cookie: visit.patientCookie })).json())
    .toMatchObject({ data: { status: "completed" } });
}, 20_000);
