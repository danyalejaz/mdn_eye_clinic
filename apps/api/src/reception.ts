import { Hono } from "hono";
import { requireActor, requireRole, type ApiEnv } from "./identity";
import { businessDay, conflict, dayStart, id, input, invalid, operationKey, text, version } from "./inputs";

export const reception = new Hono<ApiEnv>();
const frontDesk = requireRole("receptionist");
const day = 86_400_000;
const queueColumns = `id, appointment_id AS appointmentId, doctor_id AS doctorId,
  room_id AS roomId, local_date AS localDate, token_number AS tokenNumber, status, version,
  arrived_at AS arrivedAt, updated_at AS updatedAt`;
const patientColumns = `id, mrn, display_name AS displayName, date_of_birth AS dateOfBirth, phone`;

reception.get("/patients", requireActor, frontDesk, async (c) => {
  const q = c.req.query("q")?.trim() ?? "";
  if (q.length < 2 || q.length > 120) return invalid(c);
  const { results } = await c.env.DB.prepare(`
    SELECT ${patientColumns} FROM patients
    WHERE mrn = ?1 OR phone = ?1 OR instr(lower(display_name), lower(?1)) > 0
    ORDER BY display_name, id LIMIT 51
  `).bind(q).all();
  return c.json({ data: results.slice(0, 50), meta: { truncated: results.length > 50 } });
});

reception.post("/patients", requireActor, frontDesk, async (c) => {
  const body = await input(c, ["displayName", "dateOfBirth", "phone"]);
  if (!body || !text(body.displayName) ||
      (body.dateOfBirth != null && (typeof body.dateOfBirth !== "string" ||
        !Number.isFinite(dayStart(body.dateOfBirth)) || body.dateOfBirth > businessDay())) ||
      (body.phone != null && (typeof body.phone !== "string" || !/^\+92[0-9]{10}$/.test(body.phone)))) return invalid(c);
  const patientId = crypto.randomUUID();
  const row = await c.env.DB.prepare(`
    INSERT INTO patients (id, mrn, display_name, date_of_birth, phone, created_at)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING ${patientColumns}
  `).bind(patientId, `MRN-${patientId}`, body.displayName.trim(), body.dateOfBirth ?? null, body.phone ?? null, new Date().toISOString()).first();
  return c.json({ data: row }, 201);
});

reception.post("/appointments/walk-in", requireActor, frontDesk, async (c) => {
  const actor = c.get("actor");
  const body = await input(c, ["doctorId", "patientId"]);
  const key = operationKey(c);
  if (!body || !id(body.doctorId) || !id(body.patientId) || !key) return invalid(c);
  const appointmentId = crypto.randomUUID();
  const now = new Date().toISOString();
  const db = c.env.DB;
  const projection = `id, reference, patient_id AS patientId, doctor_id AS doctorId, slot_id AS slotId,
    scheduled_at AS scheduledAt, fee_minor AS feeMinor, 'PKR' AS currency, source, status, version`;
  const created = await db.prepare(`
    INSERT INTO appointments (id, reference, patient_id, doctor_id, scheduled_at,
      fee_minor, source, status, created_by, booking_key, created_at)
    SELECT ?1, ?2, p.id, d.id, ?3, d.fee_minor, 'walk_in', 'confirmed', ?4, ?5, ?3
    FROM patients p JOIN doctors d ON d.id = ?6 WHERE p.id = ?7 AND d.published = 1
    ON CONFLICT DO NOTHING RETURNING ${projection}
  `).bind(appointmentId, `APT-${appointmentId}`, now, actor.userId, key, body.doctorId, body.patientId).first();
  if (created) return c.json({ data: created }, 201);
  const existing = await db.prepare(`SELECT ${projection} FROM appointments WHERE created_by = ? AND booking_key = ?`)
    .bind(actor.userId, key).first<{ source: string; patientId: string; doctorId: string }>();
  if (!existing) return c.notFound();
  return existing.source === "walk_in" && existing.patientId === body.patientId && existing.doctorId === body.doctorId ?
    c.json({ data: existing }) : conflict(c, "IDEMPOTENCY_CONFLICT", "This key was used for a different booking.");
});

reception.post("/appointments/:id/check-in", requireActor, frontDesk, async (c) => {
  if (!operationKey(c)) return invalid(c);
  const appointmentId = c.req.param("id");
  const now = new Date();
  const localDate = businessDay(now);
  const from = dayStart(localDate);
  const db = c.env.DB;
  const created = await db.prepare(`
    INSERT INTO queue_tokens (id, appointment_id, doctor_id, room_id, local_date,
      token_number, arrived_at, updated_at, updated_by)
    SELECT ?1, a.id, a.doctor_id, r.room_id, ?2,
      1 + COALESCE((SELECT MAX(token_number) FROM queue_tokens WHERE doctor_id = a.doctor_id AND local_date = ?2), 0),
      ?3, ?3, ?4
    FROM appointments a LEFT JOIN doctor_rooms r ON r.doctor_id = a.doctor_id
    WHERE a.id = ?5 AND a.status = 'confirmed' AND a.scheduled_at >= ?6 AND a.scheduled_at < ?7
    ON CONFLICT(appointment_id) DO NOTHING RETURNING ${queueColumns}
  `).bind(crypto.randomUUID(), localDate, now.toISOString(), c.get("actor").userId, appointmentId,
    new Date(from).toISOString(), new Date(from + day).toISOString()).first();
  if (created) return c.json({ data: created }, 201);
  const existing = await db.prepare(`SELECT ${queueColumns} FROM queue_tokens WHERE appointment_id = ?`)
    .bind(appointmentId).first();
  if (existing) return c.json({ data: existing });
  const appointment = await db.prepare("SELECT id FROM appointments WHERE id = ?").bind(appointmentId).first();
  return appointment ? conflict(c) : c.notFound();
});

reception.get("/queue", requireActor, requireRole("receptionist", "doctor"), async (c) => {
  const actor = c.get("actor");
  const date = c.req.query("date") ?? businessDay();
  const doctorId = actor.role === "doctor" ? actor.doctorId : c.req.query("doctorId") ?? null;
  if (!Number.isFinite(dayStart(date)) || (doctorId !== null && !id(doctorId))) return invalid(c);
  const { results } = await c.env.DB.prepare(`
    SELECT q.id, q.appointment_id AS appointmentId, q.doctor_id AS doctorId,
      q.room_id AS roomId, q.local_date AS localDate, q.token_number AS tokenNumber,
      q.status, q.version, q.arrived_at AS arrivedAt, q.updated_at AS updatedAt,
      a.patient_id AS patientId, p.display_name AS patientName, p.mrn,
      e.id AS encounterId, e.status AS encounterStatus, e.version AS encounterVersion
    FROM queue_tokens q JOIN appointments a ON a.id = q.appointment_id JOIN patients p ON p.id = a.patient_id
    LEFT JOIN encounters e ON e.queue_id = q.id
    WHERE q.local_date = ?1 AND (?2 IS NULL OR q.doctor_id = ?2)
    ORDER BY q.doctor_id, q.token_number LIMIT 501
  `).bind(date, doctorId).all();
  return c.json({ data: results.slice(0, 500), meta: { truncated: results.length > 500 } });
});

reception.post("/queue/:id/:action{call|skip|return}", requireActor, requireRole("receptionist", "doctor"), async (c) => {
  const actor = c.get("actor");
  const action = c.req.param("action");
  const body = await input(c, ["expectedVersion", "reason"]);
  if (!body || !version(body.expectedVersion) || (action !== "call" && !text(body.reason, 400))) return invalid(c);
  const status = action === "call" ? "called" : action === "skip" ? "skipped" : "waiting";
  const current = action === "return" ? "skipped" : "waiting";
  const queueId = c.req.param("id");
  const db = c.env.DB;
  const updated = await db.prepare(`
    UPDATE OR IGNORE queue_tokens SET status = ?1, version = version + 1, updated_at = ?2,
      updated_by = ?3, reason = ?4
    WHERE id = ?5 AND (?6 != 'doctor' OR doctor_id = ?7)
      AND local_date = ?8 AND version = ?9
      AND (status = ?10 OR (?1 = 'skipped' AND status = 'called'))
      AND (?1 != 'called' OR NOT EXISTS (
        SELECT 1 FROM queue_tokens active WHERE active.doctor_id = queue_tokens.doctor_id
          AND active.status = 'in_consultation'
      ))
    RETURNING ${queueColumns}
  `).bind(status, new Date().toISOString(), actor.userId, action === "call" ? null : body.reason,
    queueId, actor.role, actor.doctorId, businessDay(), body.expectedVersion, current).first();
  if (updated) return c.json({ data: updated });
  const existing = await db.prepare("SELECT id FROM queue_tokens WHERE id = ?1 AND (?2 != 'doctor' OR doctor_id = ?3)")
    .bind(queueId, actor.role, actor.doctorId).first();
  return existing ? conflict(c) : c.notFound();
});

reception.get("/public/display/:roomId", async (c) => {
  const roomId = c.req.param("roomId");
  const db = c.env.DB;
  const room = await db.prepare("SELECT name FROM rooms WHERE id = ?").bind(roomId).first<{ name: string }>();
  if (!room) return c.notFound();
  const { results } = await db.prepare(`
    SELECT token_number AS tokenNumber, status FROM queue_tokens
    WHERE room_id = ? AND local_date = ? AND status IN ('called', 'in_consultation', 'waiting')
    ORDER BY status = 'waiting', token_number LIMIT 10
  `).bind(roomId, businessDay()).all();
  return c.json({ data: { room: room.name, tokens: results } });
});
