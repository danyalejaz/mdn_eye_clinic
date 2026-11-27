import { Hono } from "hono";
import { audit } from "./audit";
import { requireActor, requireRole, type ApiEnv } from "./identity";
import { businessDay, conflict, input, invalid, text, version } from "./inputs";

export const clinical = new Hono<ApiEnv>();
const doctorOnly = requireRole("doctor");
const columns = `id, appointment_id AS appointmentId, patient_id AS patientId, doctor_id AS doctorId,
  status, version, notes, created_at AS createdAt, finalized_at AS finalizedAt`;
type StoredEncounter = { id: string; notes: string; status: string; version: number };
const view = (row: StoredEncounter) => ({ ...row, notes: JSON.parse(row.notes) as Record<string, unknown> });
const noteFields = ["reason", "symptoms", "history", "exam", "assessment", "diagnosis", "plan", "followUp"] as const;
const vitalFields = ["temperatureC", "pulseBpm", "systolicMmHg", "diastolicMmHg", "spo2Percent"] as const;

function validNotes(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, item]) => {
    if (key !== "vitals") return noteFields.some((field) => field === key) && (item === null || text(item, 5000));
    if (!item || typeof item !== "object" || Array.isArray(item)) return false;
    return Object.entries(item).every(([name, reading]) => vitalFields.some((field) => field === name) &&
      (reading === null || (typeof reading === "number" && Number.isFinite(reading) && reading > 0 &&
        reading <= (name === "spo2Percent" ? 100 : name === "temperatureC" ? 60 : 400))));
  });
}

export async function hasCareRelationship(db: D1Database, patientId: string, doctorId: string | null) {
  return Boolean(await db.prepare(`
    SELECT 1 FROM appointments WHERE patient_id = ? AND doctor_id = ?
      AND status IN ('confirmed', 'waiting', 'in_consultation', 'completed') LIMIT 1
  `).bind(patientId, doctorId).first());
}

clinical.post("/queue/:id/start", requireActor, doctorOnly, async (c) => {
  const body = await input(c, ["expectedVersion"]);
  if (!body || !version(body.expectedVersion)) return invalid(c);
  const actor = c.get("actor");
  const queueId = c.req.param("id");
  const db = c.env.DB;
  const created = await db.prepare(`
    INSERT INTO encounters (id, appointment_id, queue_id, patient_id, doctor_id, created_at, updated_at, actor_id, request_id)
    SELECT ?1, a.id, q.id, a.patient_id, a.doctor_id, ?2, ?2, ?3, ?4
    FROM queue_tokens q JOIN appointments a ON a.id = q.appointment_id
    WHERE q.id = ?5 AND q.doctor_id = ?6 AND q.version = ?7 AND q.local_date = ?8
      AND q.status = 'called' AND a.status = 'waiting'
      AND NOT EXISTS (SELECT 1 FROM queue_tokens other WHERE other.doctor_id = q.doctor_id AND other.status = 'in_consultation')
    ON CONFLICT DO NOTHING RETURNING ${columns}
  `).bind(crypto.randomUUID(), new Date().toISOString(), actor.userId, c.get("requestId"),
    queueId, actor.doctorId, body.expectedVersion, businessDay()).first<StoredEncounter>();
  if (created) return c.json({ data: view(created) }, 201);
  const queue = await db.prepare("SELECT id FROM queue_tokens WHERE id = ? AND doctor_id = ?")
    .bind(queueId, actor.doctorId).first();
  return queue ? conflict(c) : c.notFound();
});

clinical.get("/encounters/:id", requireActor, doctorOnly, async (c) => {
  const id = c.req.param("id");
  const db = c.env.DB;
  const row = await db.prepare(`SELECT ${columns} FROM encounters WHERE id = ? AND doctor_id = ?`)
    .bind(id, c.get("actor").doctorId).first<StoredEncounter>();
  if (!row) return c.notFound();
  const [amendments, release] = await Promise.all([
    db.prepare(`SELECT id, reason, correction, author_id AS authorId, created_at AS createdAt
      FROM encounter_amendments WHERE encounter_id = ? ORDER BY created_at, id LIMIT 100`).bind(id).all(),
    db.prepare("SELECT released_at AS releasedAt FROM released_summaries WHERE encounter_id = ?").bind(id).first(),
  ]);
  await audit(c, "encounter.read", "encounter", id).run();
  return c.json({ data: { ...view(row), amendments: amendments.results, release } });
});

clinical.on(["PATCH", "POST"], ["/encounters/:id", "/encounters/:id/finalize"], requireActor, doctorOnly, async (c) => {
  const isFinalize = c.req.method === "POST" && c.req.path.endsWith("/finalize");
  if (!isFinalize && (c.req.method !== "PATCH" || c.req.path.endsWith("/finalize"))) return c.notFound();
  const body = await input(c, isFinalize ? ["expectedVersion"] : ["expectedVersion", "notes"]);
  if (!body || !version(body.expectedVersion) || (!isFinalize && !validNotes(body.notes))) return invalid(c);
  const actor = c.get("actor");
  const id = c.req.param("id");
  const now = new Date().toISOString();
  const db = c.env.DB;
  const row = await db.prepare(`
    UPDATE encounters SET notes = COALESCE(?1, notes), version = version + 1,
      updated_at = ?2, status = ?3, finalized_at = ?4, actor_id = ?5, request_id = ?6
    WHERE id = ?7 AND doctor_id = ?8 AND version = ?9 AND status = 'draft'
      AND (?3 != 'finalized' OR length(trim(COALESCE(json_extract(notes, '$.assessment'), ''))) > 0)
    RETURNING ${columns}
  `).bind(isFinalize ? null : JSON.stringify(body.notes), now, isFinalize ? "finalized" : "draft",
    isFinalize ? now : null, actor.userId, c.get("requestId"), id, actor.doctorId, body.expectedVersion).first<StoredEncounter>();
  if (row) return c.json({ data: view(row) });
  const current = await db.prepare("SELECT version FROM encounters WHERE id = ? AND doctor_id = ?")
    .bind(id, actor.doctorId).first<{ version: number }>();
  return current ? conflict(c, current.version === body.expectedVersion ? "INVALID_TRANSITION" : "VERSION_CONFLICT") : c.notFound();
});

clinical.post("/encounters/:id/:action{amendments|release}", requireActor, doctorOnly, async (c) => {
  const release = c.req.param("action") === "release";
  const body = await input(c, release ? ["summary"] : ["reason", "correction"]);
  if (!body || (release ? !text(body.summary, 6000) : !text(body.reason, 400) || !text(body.correction, 6000))) return invalid(c);
  const encounterId = c.req.param("id");
  const actor = c.get("actor");
  const db = c.env.DB;
  const row = await db.prepare("SELECT status FROM encounters WHERE id = ? AND doctor_id = ?")
    .bind(encounterId, actor.doctorId).first<{ status: string }>();
  if (!row) return c.notFound();
  if (row.status !== "finalized") return conflict(c);
  const now = new Date().toISOString();
  const id = release ? encounterId : crypto.randomUUID();
  const write = release ? db.prepare(`
    INSERT INTO released_summaries (encounter_id, summary, released_by, released_at)
    VALUES (?, ?, ?, ?) ON CONFLICT(encounter_id) DO NOTHING RETURNING encounter_id
  `).bind(encounterId, body.summary, actor.userId, now) : db.prepare(`
    INSERT INTO encounter_amendments (id, encounter_id, reason, correction, author_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?) RETURNING id
  `).bind(id, encounterId, body.reason, body.correction, actor.userId, now);
  // The audit statement only records a release when the release insert changed a row.
  const auditWrite = db.prepare(`
    INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
    SELECT ?, ?, 'encounter', ?, ?, ? WHERE changes() = 1
  `).bind(actor.userId, release ? "encounter.release" : "encounter.amend", encounterId, c.get("requestId"), now);
  const [result] = await db.batch([write, auditWrite]);
  if (!result.results.length) return conflict(c);
  return c.json({ data: { id, encounterId, createdAt: now } }, 201);
});

clinical.get("/patients/:id/history", requireActor, requireRole("patient", "doctor"), async (c) => {
  const patientId = c.req.param("id");
  const actor = c.get("actor");
  const db = c.env.DB;
  if (actor.role === "patient") {
    if (actor.patientId !== patientId) return c.notFound();
    const { results } = await db.prepare(`
      SELECT e.id AS encounterId, d.display_name AS doctorName, r.summary, r.released_at AS releasedAt
      FROM released_summaries r JOIN encounters e ON e.id = r.encounter_id JOIN doctors d ON d.id = e.doctor_id
      WHERE e.patient_id = ? ORDER BY r.released_at DESC, e.id LIMIT 100
    `).bind(patientId).all();
    await audit(c, "patient.released_history.read", "patient", patientId).run();
    return c.json({ data: results });
  }
  if (!await hasCareRelationship(db, patientId, actor.doctorId)) return c.notFound();
  const [visits, allergies] = await Promise.all([
    db.prepare(`SELECT ${columns} FROM encounters WHERE patient_id = ? AND status = 'finalized'
      ORDER BY finalized_at DESC, id LIMIT 100`).bind(patientId).all<StoredEncounter>(),
    db.prepare("SELECT status, details FROM patient_allergies WHERE patient_id = ?").bind(patientId).first(),
  ]);
  await audit(c, "patient.clinical_history.read", "patient", patientId).run();
  return c.json({ data: { visits: visits.results.map(view), allergies: allergies ?? { status: "unknown", details: null } } });
});

clinical.put("/patients/:id/allergies", requireActor, doctorOnly, async (c) => {
  const body = await input(c, ["status", "details"]);
  if (!body || !["none_known", "recorded"].includes(String(body.status)) ||
      (body.status === "recorded" ? !text(body.details, 2000) : body.details != null)) return invalid(c);
  const actor = c.get("actor");
  const patientId = c.req.param("id");
  const db = c.env.DB;
  if (!await hasCareRelationship(db, patientId, actor.doctorId)) return c.notFound();
  await db.batch([
    db.prepare(`INSERT INTO patient_allergies (patient_id, status, details, updated_by, updated_at)
      VALUES (?, ?, ?, ?, ?) ON CONFLICT(patient_id) DO UPDATE SET
        status = excluded.status, details = excluded.details,
        updated_by = excluded.updated_by, updated_at = excluded.updated_at`)
      .bind(patientId, body.status, body.details ?? null, actor.userId, new Date().toISOString()),
    audit(c, "patient.allergies.update", "patient", patientId),
  ]);
  return c.json({ data: { status: body.status, details: body.details ?? null } });
});
