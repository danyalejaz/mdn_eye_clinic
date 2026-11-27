import { afterAll, expect, it } from "vitest";
import { cookies, password, testPlatform } from "./platform";

let platform: Awaited<ReturnType<typeof testPlatform>>;
afterAll(async () => { await platform?.dispose(); });

it("protects patient scope, confirms only one concurrent booking, and preserves a failed reschedule", async () => {
  platform = await testPlatform(["public-catalog.sql"]);
  const { env, request, account } = platform;
  const appointmentPath = "/api/v1/appointments";
  const date = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
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
  const ownFeed = await request("/api/v1/notifications", { cookie: own });
  const { data: notices, meta } = await ownFeed.json<{ data: { id: string; kind: string }[]; meta: { unreadCount: number } }>();
  expect(notices.map((notice) => notice.kind).sort()).toEqual(["appointment.confirmed", "appointment.reminder"]);
  expect(meta.unreadCount).toBe(2);
  const readPath = `/api/v1/notifications/${notices[0].id}/read`;
  expect((await request(readPath, { cookie: other, method: "POST" })).status).toBe(404);
  expect((await request(readPath, { cookie: own, method: "POST" })).status).toBe(200);
  expect(await (await request("/api/v1/notifications", { cookie: own })).json()).toMatchObject({ meta: { unreadCount: 1 } });
  const reception = await platform.staff("receptionist");
  const noShow = (cookie: string, id: string) => request(`${appointmentPath}/${id}/no-show`, {
    cookie, body: { expectedVersion: 1 },
  });
  expect((await noShow(own, booking.data.id)).status).toBe(403);
  expect((await noShow(reception.cookie, booking.data.id)).status).toBe(409);
  const past = new Date(Date.now() - 60_000).toISOString();
  await env.DB.prepare(`INSERT INTO appointments (id, reference, patient_id, doctor_id, scheduled_at,
    fee_minor, source, status, created_by, booking_key, created_at)
    SELECT 'past-appointment', 'APT-PAST', patient_id, doctor_id, ?1,
      fee_minor, 'reception', 'confirmed', ?2, 'past-booking', ?1 FROM appointments WHERE id = ?3`)
    .bind(past, reception.userId, booking.data.id).run();
  expect((await noShow(reception.cookie, "past-appointment")).status).toBe(200);
  expect(await (await request(`${appointmentPath}/past-appointment`, { cookie: own })).json())
    .toMatchObject({ data: { status: "no_show", version: 2 } });
}, 15_000);
