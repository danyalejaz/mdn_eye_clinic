import { Hono } from "hono";
import { requireActor, requireRole, type ApiEnv } from "./identity";
import { businessDay, conflict, dayStart, id, input, invalid, operationKey, version } from "./inputs";

type Appointment = {
  id: string; reference: string; patientId: string; doctorId: string; slotId: string | null;
  scheduledAt: string; feeMinor: number; status: string; source: string; version: number;
};
const projection = `id, reference, patient_id AS patientId, doctor_id AS doctorId,
  slot_id AS slotId, scheduled_at AS scheduledAt, fee_minor AS feeMinor, status, source, version, 'PKR' AS currency`;
const day = 86_400_000;

export const availability = new Hono<ApiEnv>();
availability.get("/availability", async (c) => {
  const query = new URL(c.req.url).searchParams;
  const doctor = query.get("doctorId");
  const from = dayStart(query.get("from") ?? businessDay());
  const to = dayStart(query.get("to") ?? query.get("from") ?? businessDay());
  if ((doctor !== null && !id(doctor)) || !Number.isFinite(from) || !Number.isFinite(to) ||
      to < from || to - from >= 30 * day) return invalid(c);
  const { results } = await c.env.DB.prepare(`
    SELECT s.id AS slotId, s.doctor_id AS doctorId, s.start_at AS startAt, s.end_at AS endAt,
      d.fee_minor AS feeMinor, 'PKR' AS currency
    FROM appointment_slots s JOIN doctors d ON d.id = s.doctor_id
    JOIN departments p ON p.slug = d.department_slug
    WHERE s.enabled = 1 AND d.published = 1 AND p.published = 1
      AND s.start_at >= ?1 AND s.start_at < ?2 AND (?3 IS NULL OR d.id = ?3)
      AND NOT EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id AND a.status NOT IN ('cancelled', 'left'))
    ORDER BY s.start_at, s.id LIMIT 501
  `).bind(new Date(Math.max(from, Date.now())).toISOString(), new Date(to + day).toISOString(), doctor).all();
  return c.json({ data: results.slice(0, 500), meta: { truncated: results.length > 500 } });
});

export const appointments = new Hono<ApiEnv>();
appointments.use("*", requireActor);

appointments.get("/", async (c) => {
  const actor = c.get("actor");
  const from = c.req.query("from");
  const to = c.req.query("to");
  const fromTime = from ? dayStart(from) : null;
  const toTime = to ? dayStart(to) : null;
  const doctorFilter = c.req.query("doctorId") ?? null;
  const rawCursor = c.req.query("cursor");
  const [cursorAt, cursorId, extraCursor] = rawCursor?.split("~") ?? [];
  const size = c.req.query("limit") ?? "25";
  if ((from && !Number.isFinite(fromTime)) || (to && !Number.isFinite(toTime)) ||
      (fromTime !== null && toTime !== null && toTime < fromTime) ||
      (doctorFilter !== null && !id(doctorFilter)) || !/^(?:[1-9]\d?|100)$/.test(size) ||
      (rawCursor !== undefined && (!cursorAt || !Number.isFinite(Date.parse(cursorAt)) || !id(cursorId) || extraCursor !== undefined))) return invalid(c);
  const limit = Number(size);
  const { results } = await c.env.DB.prepare(`
    SELECT ${projection} FROM appointments
    WHERE (?1 != 'patient' OR patient_id = ?2) AND (?1 != 'doctor' OR doctor_id = ?3)
      AND (?4 IS NULL OR scheduled_at >= ?4) AND (?5 IS NULL OR scheduled_at < ?5)
      AND (?6 IS NULL OR doctor_id = ?6)
      AND (?7 IS NULL OR scheduled_at > ?7 OR (scheduled_at = ?7 AND id > ?8))
    ORDER BY scheduled_at, id LIMIT ?9
  `).bind(actor.role, actor.patientId, actor.doctorId, fromTime === null ? null : new Date(fromTime).toISOString(),
    toTime === null ? null : new Date(toTime + day).toISOString(), doctorFilter, cursorAt ?? null, cursorId ?? null, limit + 1)
    .all<Appointment>();
  const data = results.slice(0, limit);
  const last = data.at(-1);
  return c.json({ data, meta: { nextCursor: results.length > limit && last ? `${last.scheduledAt}~${last.id}` : null } });
});

appointments.get("/:id", async (c) => {
  const actor = c.get("actor");
  const appointment = await c.env.DB.prepare(`
    SELECT ${projection} FROM appointments
    WHERE id = ?1 AND (?2 != 'patient' OR patient_id = ?3) AND (?2 != 'doctor' OR doctor_id = ?4)
  `).bind(c.req.param("id"), actor.role, actor.patientId, actor.doctorId).first<Appointment>();
  return appointment ? c.json({ data: appointment }) : c.notFound();
});

appointments.post("/", requireRole("patient", "receptionist"), async (c) => {
  const actor = c.get("actor");
  const body = await input(c, ["doctorId", "slotId", "patientId"]);
  const key = operationKey(c);
  if (!body || !id(body.doctorId) || !id(body.slotId) || !key) return invalid(c);
  const patientId = actor.role === "patient" ? actor.patientId : body.patientId;
  if (!id(patientId) || (body.patientId !== undefined && body.patientId !== patientId)) return c.notFound();
  const { doctorId, slotId } = body;
  const db = c.env.DB;
  const now = new Date().toISOString();
  const bookingId = crypto.randomUUID();
  const created = await db.prepare(`
    INSERT INTO appointments (id, reference, patient_id, doctor_id, slot_id, scheduled_at,
      fee_minor, source, status, created_by, booking_key, requested_slot_id, created_at)
    SELECT ?1, ?2, p.id, d.id, s.id, s.start_at, d.fee_minor, ?3, 'confirmed', ?4, ?5, s.id, ?6
    FROM appointment_slots s JOIN doctors d ON d.id = s.doctor_id
    JOIN departments dp ON dp.slug = d.department_slug JOIN patients p ON p.id = ?7
    WHERE s.id = ?8 AND d.id = ?9 AND s.enabled = 1 AND s.start_at > ?6
      AND d.published = 1 AND dp.published = 1
    ON CONFLICT DO NOTHING RETURNING ${projection}
  `).bind(bookingId, `APT-${bookingId}`, actor.role === "patient" ? "online" : "reception",
    actor.userId, key, now, patientId, slotId, doctorId).first<Appointment>();
  if (created) return c.json({ data: created }, 201);

  const existing = await db.prepare(`
    SELECT ${projection}, requested_slot_id AS requestedSlotId FROM appointments
    WHERE created_by = ? AND booking_key = ?
  `).bind(actor.userId, key).first<Appointment & { requestedSlotId: string }>();
  if (existing) {
    const { requestedSlotId, ...data } = existing;
    if (requestedSlotId !== slotId || data.doctorId !== doctorId || data.patientId !== patientId) {
      return conflict(c, "IDEMPOTENCY_CONFLICT", "This key was used for a different booking.");
    }
    return c.json({ data });
  }
  return conflict(c, "SLOT_UNAVAILABLE", "This slot is no longer available.");
});

appointments.post("/:id/cancel", requireRole("patient", "receptionist"), async (c) => {
  const actor = c.get("actor");
  const body = await input(c, ["expectedVersion"]);
  if (!body || !version(body.expectedVersion)) return invalid(c);
  const appointmentId = c.req.param("id");
  const updated = await c.env.DB.prepare(`
    UPDATE appointments SET status = 'cancelled', version = version + 1
    WHERE id = ?1 AND (?2 != 'patient' OR patient_id = ?3)
      AND status = 'confirmed' AND version = ?4 AND scheduled_at > ?5
    RETURNING ${projection}
  `).bind(appointmentId, actor.role, actor.patientId, body.expectedVersion, new Date().toISOString()).first<Appointment>();
  if (updated) return c.json({ data: updated });
  const current = await c.env.DB.prepare("SELECT id FROM appointments WHERE id = ?1 AND (?2 != 'patient' OR patient_id = ?3)")
    .bind(appointmentId, actor.role, actor.patientId).first();
  return current ? conflict(c) : c.notFound();
});

appointments.post("/:id/reschedule", requireRole("patient", "receptionist"), async (c) => {
  const actor = c.get("actor");
  const body = await input(c, ["slotId", "expectedVersion"]);
  if (!body || !id(body.slotId) || !version(body.expectedVersion)) return invalid(c);
  const appointmentId = c.req.param("id");
  const updated = await c.env.DB.prepare(`
    UPDATE OR IGNORE appointments SET slot_id = ?1,
      scheduled_at = (SELECT start_at FROM appointment_slots WHERE id = ?1), version = version + 1
    WHERE id = ?2 AND (?3 != 'patient' OR patient_id = ?4)
      AND status = 'confirmed' AND version = ?5 AND scheduled_at > ?6
      AND slot_id != ?1 AND EXISTS (
        SELECT 1 FROM appointment_slots s JOIN doctors d ON d.id = s.doctor_id
        JOIN departments p ON p.slug = d.department_slug
        WHERE s.id = ?1 AND s.doctor_id = appointments.doctor_id AND s.enabled = 1
          AND s.start_at > ?6 AND d.published = 1 AND p.published = 1
      )
    RETURNING ${projection}
  `).bind(body.slotId, appointmentId, actor.role, actor.patientId, body.expectedVersion,
    new Date().toISOString()).first<Appointment>();
  if (updated) return c.json({ data: updated });
  const current = await c.env.DB.prepare("SELECT id, version FROM appointments WHERE id = ?1 AND (?2 != 'patient' OR patient_id = ?3)")
    .bind(appointmentId, actor.role, actor.patientId).first<{ version: number }>();
  if (!current) return c.notFound();
  return current.version === body.expectedVersion ? conflict(c, "SLOT_UNAVAILABLE", "This slot cannot be selected.") :
    conflict(c, "VERSION_CONFLICT");
});
