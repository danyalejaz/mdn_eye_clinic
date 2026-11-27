import { afterAll, expect, it } from "vitest";
import { testPlatform } from "./platform";

let platform: Awaited<ReturnType<typeof testPlatform>>;
afterAll(async () => { await platform?.dispose(); });

it("registers a walk-in, checks in once, and exposes only anonymous room tokens", async () => {
  platform = await testPlatform(["public-catalog.sql"]);
  const { cookie } = await platform.staff("receptionist");
  const doctor = await platform.staff("doctor", "doc_demo_b");
  const { request, env } = platform;
  const api = "/api/v1";
  const post = (path: string, body: object, key?: string) => request(`${api}${path}`, {
    cookie, body, headers: key ? { "Idempotency-Key": key } : undefined,
  });
  expect((await request(`${api}/patients?q=Demo`, { cookie: doctor.cookie })).status).toBe(403);
  const patient = await post("/patients", { displayName: "Fictional Queue Patient" });
  expect(patient.status).toBe(201);
  const { data: { id: patientId } } = await patient.json<{ data: { id: string } }>();
  await env.DB.batch([
    env.DB.prepare("INSERT INTO rooms VALUES ('room-a', 'Room A')"),
    env.DB.prepare("INSERT INTO doctor_rooms VALUES ('doc_demo_a', 'room-a')"),
  ]);
  const walkIn = await post("/appointments/walk-in", { patientId, doctorId: "doc_demo_a" }, "walkin-001");
  expect(walkIn.status).toBe(201);
  const { data: { id: appointmentId } } = await walkIn.json<{ data: { id: string } }>();
  const arrivals = await Promise.all(Array.from({ length: 2 }, () =>
    post(`/appointments/${appointmentId}/check-in`, {}, "checkin-001")));
  expect(arrivals.map((result) => result.status).sort()).toEqual([200, 201]);
  const tokens = await Promise.all(arrivals.map((result) => result.json<{ data: { id: string; tokenNumber: number } }>()));
  expect(tokens[0]).toEqual(tokens[1]);
  expect(tokens[0].data.tokenNumber).toBe(1);
  const queueId = tokens[0].data.id;
  expect((await request(`${api}/queue/${queueId}/call`, { cookie: doctor.cookie, body: { expectedVersion: 1 } })).status).toBe(404);
  expect((await post(`/queue/${queueId}/call`, { expectedVersion: 1 })).status).toBe(200);
  expect((await post(`/queue/${queueId}/skip`, { expectedVersion: 1, reason: "Sample reason" })).status).toBe(409);
  const display = await request(`${api}/public/display/room-a`);
  expect(await display.json()).toEqual({ data: { room: "Room A", tokens: [{ tokenNumber: 1, status: "called" }] } });
}, 15_000);
