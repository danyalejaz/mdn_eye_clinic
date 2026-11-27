import { Hono } from "hono";
import { requireActor, requireRole, type ApiEnv } from "./identity";
import { conflict, input, invalid, version } from "./inputs";

export const patientUpdates = new Hono<ApiEnv>();
const patientOnly = requireRole("patient");

patientUpdates.get("/notifications", requireActor, patientOnly, async (c) => {
  const patientId = c.get("actor").patientId;
  if (!patientId) return c.json({ data: [], meta: { unreadCount: 0 } });
  const db = c.env.DB;
  const [feed, unread] = await db.batch([
    db.prepare(`SELECT n.id, n.kind, n.resource_id AS resourceId, n.created_at AS createdAt,
      n.scheduled_at AS scheduledAt, r.read_at AS readAt
      FROM patient_notification_feed n LEFT JOIN notification_reads r
      ON r.patient_id = n.patient_id AND r.notification_id = n.id
      WHERE n.patient_id = ? ORDER BY n.created_at DESC, n.id DESC LIMIT 100`).bind(patientId),
    db.prepare(`SELECT COUNT(*) AS count FROM patient_notification_feed n WHERE n.patient_id = ?
      AND NOT EXISTS (SELECT 1 FROM notification_reads r WHERE r.patient_id = n.patient_id AND r.notification_id = n.id)`)
      .bind(patientId),
  ]);
  const { count } = unread.results[0] as { count: number };
  return c.json({ data: feed.results, meta: { unreadCount: count } });
});

patientUpdates.post("/notifications/:id/read", requireActor, patientOnly, async (c) => {
  const patientId = c.get("actor").patientId;
  if (!patientId) return c.notFound();
  const db = c.env.DB;
  const id = c.req.param("id");
  const data = await db.prepare(`
    INSERT INTO notification_reads(patient_id, notification_id, read_at)
    SELECT patient_id, id, ?1 FROM patient_notification_feed WHERE patient_id = ?2 AND id = ?3
    ON CONFLICT(patient_id, notification_id) DO UPDATE SET read_at = notification_reads.read_at
    RETURNING notification_id AS id, read_at AS readAt
  `).bind(new Date().toISOString(), patientId, id).first();
  return data ? c.json({ data }) : c.notFound();
});

patientUpdates.post("/appointments/:id/no-show", requireActor, requireRole("receptionist"), async (c) => {
  const body = await input(c, ["expectedVersion"]);
  if (!body || !version(body.expectedVersion)) return invalid(c);
  const appointmentId = c.req.param("id");
  const db = c.env.DB;
  const now = new Date().toISOString();
  const [result] = await db.batch([
    db.prepare(`UPDATE appointments SET status = 'no_show', version = version + 1
      WHERE id = ? AND version = ? AND scheduled_at <= ? AND source != 'walk_in' AND status = 'confirmed'
      RETURNING id, status, version`).bind(appointmentId, body.expectedVersion, now),
    db.prepare(`INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
      SELECT ?, 'appointment.no_show', 'appointment', ?, ?, ? WHERE changes() = 1`)
      .bind(c.get("actor").userId, appointmentId, c.get("requestId"), now),
  ]);
  if (result.results.length) return c.json({ data: result.results[0] });
  return await db.prepare("SELECT id FROM appointments WHERE id = ?").bind(appointmentId).first() ? conflict(c) : c.notFound();
});
