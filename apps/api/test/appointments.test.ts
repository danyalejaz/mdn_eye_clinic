import { afterAll, expect, it } from "vitest";
import { cookies, password, testPlatform } from "./platform";

let platform: Awaited<ReturnType<typeof testPlatform>>;
afterAll(async () => { await platform?.dispose(); });

it("protects patient scope, confirms only one concurrent booking, and preserves a failed reschedule", async () => {
  platform = await testPlatform(["public-catalog.sql"]);
  const { env, request, account } = platform;
  const appointmentPath = "/api/v1/appointments";
  const date = new Date(Date.now() + 172_800_000).toISOString().slice(0, 10);
  for (const [slot, start, end] of [["slot_a", "05:00", "05:20"], ["slot_b", "05:20", "05:40"]]) {
    await env.DB.prepare("INSERT INTO appointment_slots (id, doctor_id, start_at, end_at) VALUES (?, ?, ?, ?)")
      .bind(slot, "doc_demo_a", `${date}T${start}:00.000Z`, `${date}T${end}:00.000Z`).run();
  }
  async function patient(suffix: string) {
    const email = `${suffix}@example.test`;
    const userId = await account(email, "patient");
    await env.DB.prepare("INSERT INTO patients (id, user_id, mrn, display_name, created_at) VALUES (?, ?, ?, ?, ?)")
      .bind(suffix, userId, `MRN-${suffix}`, suffix, new Date().toISOString()).run();
    return cookies(await request("/api/auth/sign-in/email", { body: { email, password } }));
  }
  const first = await patient("patient_a");
  const second = await patient("patient_b");
  expect((await request(appointmentPath)).status).toBe(401);
  const availability = (query: string) => request(`/api/v1/public/availability?from=${date}${query}`);
  expect(await (await availability("")).json()).toMatchObject({ data: [{ slotId: "slot_a" }, { slotId: "slot_b" }] });
  const book = (cookie: string, key: string, slotId: string, patientId?: string) => request(appointmentPath, {
    cookie, headers: { "Idempotency-Key": key }, body: { doctorId: "doc_demo_a", slotId, patientId },
  });
  expect((await book(first, "denied-001", "slot_a", "patient_b")).status).toBe(404);
  const races = await Promise.all([
    book(first, "booking-001", "slot_a"),
    book(second, "booking-002", "slot_a"),
  ]);
  expect(races.map((r) => r.status).sort()).toEqual([201, 409]);
  const winner = races.findIndex((result) => result.status === 201);
  const booking = await races[winner].json<{ data: { id: string; slotId: string } }>();
  const [own, other] = winner === 0 ? [first, second] : [second, first];
  expect((await book(own, winner === 0 ? "booking-001" : "booking-002", "slot_a")).status).toBe(200);
  expect((await request(`${appointmentPath}/${booking.data.id}`, { cookie: other })).status).toBe(404);
  expect((await book(other, "booking-003", "slot_b")).status).toBe(201);
  const failed = await request(`${appointmentPath}/${booking.data.id}/reschedule`, {
    cookie: own, body: { slotId: "slot_b", expectedVersion: 1 },
  });
  expect(failed.status).toBe(409);
  expect(await (await request(`${appointmentPath}/${booking.data.id}`, { cookie: own })).json())
    .toMatchObject({ data: { slotId: "slot_a", version: 1 } });
  expect(await (await availability("")).json()).toMatchObject({ data: [] });
}, 15_000);
