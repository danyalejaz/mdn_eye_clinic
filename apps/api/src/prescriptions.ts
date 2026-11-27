import { Hono } from "hono";
import { audit } from "./audit";
import { apiError, requireActor, requireRole, type ApiEnv } from "./identity";
import { conflict, id, input, invalid, operationKey, text, version } from "./inputs";
import { renderPdf } from "./pdf";

export const prescriptions = new Hono<ApiEnv>();
const doctorOnly = requireRole("doctor");
const itemFields = ["medicine", "strength", "dose", "route", "frequency", "duration", "quantity", "instructions"] as const;
type Item = Partial<Record<(typeof itemFields)[number], string>> & { medicine: string; dose: string; frequency: string };

function validItems(items: unknown): items is Item[] {
  return Array.isArray(items) && items.length > 0 && items.length <= 30 && items.every((item) =>
    item && typeof item === "object" && !Array.isArray(item) &&
    Object.entries(item).every(([field, value]) => itemFields.some((key) => key === field) && text(value, 300)) &&
    text(item.medicine, 300) && text(item.dose, 300) && text(item.frequency, 300));
}

type Prescription = {
  id: string; encounterId: string; items: string; approvedAt: string | null;
  releasedAt: string | null; status: string; version: number; doctorName: string; patientName: string;
};
const projection = `
  SELECT p.id, p.encounter_id AS encounterId, p.supersedes_id AS supersedesId,
    p.version, p.items, p.created_at AS createdAt, p.approved_at AS approvedAt,
    r.released_at AS releasedAt, d.display_name AS doctorName, pt.display_name AS patientName,
    CASE WHEN p.approved_at IS NULL THEN 'draft'
      WHEN EXISTS (SELECT 1 FROM prescriptions x WHERE x.supersedes_id = p.id AND x.approved_at IS NOT NULL)
        THEN 'superseded' ELSE 'approved' END AS status
  FROM prescriptions p JOIN encounters e ON e.id = p.encounter_id
  JOIN doctors d ON d.id = e.doctor_id JOIN patients pt ON pt.id = e.patient_id
  LEFT JOIN prescription_releases r ON r.prescription_id = p.id`;

function view(row: Prescription) {
  return { ...row, items: JSON.parse(row.items) as Item[] };
}

prescriptions.get("/prescriptions", requireActor, requireRole("doctor", "patient"), async (c) => {
  const actor = c.get("actor");
  const { results } = await c.env.DB.prepare(`${projection}
    WHERE (e.doctor_id = ?1 AND ?2 = 'doctor') OR
      (e.patient_id = ?3 AND ?2 = 'patient' AND r.released_at IS NOT NULL AND p.approved_at IS NOT NULL)
    ORDER BY p.created_at DESC, p.id LIMIT 101
  `).bind(actor.doctorId, actor.role, actor.patientId).all<Prescription>();
  await audit(c, "prescription.list", "account", actor.userId).run();
  return c.json({ data: results.slice(0, 100).map(view), meta: { truncated: results.length > 100 } });
});

prescriptions.on("GET", ["/prescriptions/:id", "/prescriptions/:id/pdf"], requireActor,
  requireRole("doctor", "patient"), async (c) => {
    const actor = c.get("actor");
    const row = await c.env.DB.prepare(`${projection}
      WHERE p.id = ?1 AND ((e.doctor_id = ?2 AND ?3 = 'doctor') OR
        (e.patient_id = ?4 AND ?3 = 'patient' AND p.approved_at IS NOT NULL AND r.released_at IS NOT NULL))
    `).bind(c.req.param("id"), actor.doctorId, actor.role, actor.patientId).first<Prescription>();
    if (!row) return c.notFound();
    const data = view(row);
    if (!c.req.path.endsWith("/pdf")) {
      await audit(c, "prescription.read", "prescription", data.id).run();
      return c.json({ data });
    }
    if (!data.approvedAt) return conflict(c, "FILE_NOT_READY", "Approve the prescription before downloading it.");
    const lines = [
      `Reference: ${data.id}`, `Patient: ${data.patientName}`, `Doctor: ${data.doctorName}`,
      `Approved: ${data.approvedAt}`, `Status: ${data.status}`, "",
      ...data.items.flatMap((item, index) => [
        `${index + 1}. ${item.medicine}`,
        ...itemFields.slice(1).flatMap((field) => item[field] ?
          `${field}: ${item[field]}`.split(/\r?\n/) : []), "",
      ]),
    ];
    const pdf = await renderPdf("Prescription", lines);
    if (!pdf) return apiError(c, 422, "DOCUMENT_FONT_UNSUPPORTED", "The configured document font cannot render this prescription.");
    await audit(c, "prescription.pdf.read", "prescription", data.id).run();
    return new Response(new Uint8Array(pdf), { headers: {
      "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="prescription-${data.id}.pdf"`,
      "Cache-Control": "private, no-store",
    } });
  });

prescriptions.post("/prescriptions", requireActor, doctorOnly, async (c) => {
  const body = await input(c, ["encounterId", "items"]);
  if (!body || !id(body.encounterId) || !validItems(body.items)) return invalid(c);
  const prescriptionId = crypto.randomUUID();
  const now = new Date().toISOString();
  const row = await c.env.DB.prepare(`
    INSERT INTO prescriptions (id, encounter_id, items, created_at, updated_at)
    SELECT ?1, e.id, ?2, ?3, ?3 FROM encounters e WHERE e.id = ?4 AND e.doctor_id = ?5
    RETURNING id, encounter_id AS encounterId, version
  `).bind(prescriptionId, JSON.stringify(body.items), now, body.encounterId, c.get("actor").doctorId).first();
  if (!row) return c.notFound();
  await audit(c, "prescription.draft.create", "prescription", prescriptionId).run();
  return c.json({ data: row }, 201);
});

prescriptions.patch("/prescriptions/:id", requireActor, doctorOnly, async (c) => {
  const body = await input(c, ["expectedVersion", "items"]);
  if (!body || !version(body.expectedVersion) || !validItems(body.items)) return invalid(c);
  const prescriptionId = c.req.param("id");
  const actor = c.get("actor");
  const db = c.env.DB;
  const row = await db.prepare(`
    UPDATE prescriptions SET items = ?1, updated_at = ?2, version = version + 1
    WHERE id = ?3 AND version = ?4 AND approved_at IS NULL
      AND EXISTS (SELECT 1 FROM encounters e WHERE e.id = prescriptions.encounter_id AND e.doctor_id = ?5)
    RETURNING id, version
  `).bind(JSON.stringify(body.items), new Date().toISOString(), prescriptionId, body.expectedVersion, actor.doctorId).first();
  if (!row) {
    return await db.prepare(`${projection} WHERE p.id = ? AND e.doctor_id = ?`)
      .bind(prescriptionId, actor.doctorId).first() ? conflict(c, "VERSION_CONFLICT") : c.notFound();
  }
  await audit(c, "prescription.draft.save", "prescription", prescriptionId).run();
  return c.json({ data: row });
});

prescriptions.post("/prescriptions/:id/approve", requireActor, doctorOnly, async (c) => {
  const body = await input(c, ["expectedVersion"]);
  const key = operationKey(c);
  if (!body || !version(body.expectedVersion) || !key) return invalid(c);
  const actor = c.get("actor");
  const db = c.env.DB;
  const prescriptionId = c.req.param("id");
  const now = new Date().toISOString();
  const [row] = await db.batch([
    db.prepare(`
      UPDATE prescriptions SET approved_at = ?1, approved_by = ?2, version = version + 1, updated_at = ?1, approval_key = ?6
      WHERE id = ?3 AND version = ?4 AND approved_at IS NULL
        AND EXISTS (SELECT 1 FROM encounters e WHERE e.id = prescriptions.encounter_id AND e.doctor_id = ?5)
      RETURNING id, approved_at AS approvedAt, version
    `).bind(now, actor.userId, prescriptionId, body.expectedVersion, actor.doctorId, key),
    db.prepare(`
      INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
      SELECT ?, 'prescription.approve', 'prescription', ?, ?, ? WHERE changes() = 1
    `).bind(actor.userId, prescriptionId, c.get("requestId"), now),
  ]);
  if (row.results.length) return c.json({ data: row.results[0] });
  const current = await db.prepare(`SELECT p.id, p.approved_at AS approvedAt, p.version, p.approval_key AS approvalKey
    FROM prescriptions p JOIN encounters e ON e.id = p.encounter_id WHERE p.id = ? AND e.doctor_id = ?`)
    .bind(prescriptionId, actor.doctorId).first<{ id: string; approvedAt: string | null; version: number; approvalKey: string | null }>();
  if (!current) return c.notFound();
  if (current.approvedAt && current.version === body.expectedVersion + 1 && current.approvalKey === key) {
    return c.json({ data: { id: current.id, approvedAt: current.approvedAt, version: current.version } });
  }
  return conflict(c, "VERSION_CONFLICT");
});

prescriptions.post("/prescriptions/:id/amendments", requireActor, doctorOnly, async (c) => {
  const body = await input(c, ["reason", "items"]);
  if (!body || !text(body.reason, 400) || !validItems(body.items)) return invalid(c);
  const previousId = c.req.param("id");
  const now = new Date().toISOString();
  const actor = c.get("actor");
  const db = c.env.DB;
  const newId = crypto.randomUUID();
  const row = await db.prepare(`
    INSERT INTO prescriptions (id, encounter_id, supersedes_id, items, correction_reason, created_at, updated_at)
    SELECT ?1, p.encounter_id, p.id, ?2, ?3, ?4, ?4
    FROM prescriptions p JOIN encounters e ON e.id = p.encounter_id
    WHERE p.id = ?5 AND p.approved_at IS NOT NULL AND e.doctor_id = ?6
    ON CONFLICT(supersedes_id) DO NOTHING RETURNING id, version, supersedes_id AS supersedesId
  `).bind(newId, JSON.stringify(body.items), body.reason, now, previousId, actor.doctorId).first();
  if (!row) return await db.prepare(`${projection} WHERE p.id = ? AND e.doctor_id = ?`)
    .bind(previousId, actor.doctorId).first() ? conflict(c) : c.notFound();
  await audit(c, "prescription.amend", "prescription", newId).run();
  return c.json({ data: row }, 201);
});

prescriptions.post("/prescriptions/:id/release", requireActor, doctorOnly, async (c) => {
  const actor = c.get("actor");
  const prescriptionId = c.req.param("id");
  const now = new Date().toISOString();
  const db = c.env.DB;
  const [result] = await db.batch([
    db.prepare(`
      INSERT INTO prescription_releases (prescription_id, released_by, released_at)
      SELECT p.id, ?1, ?2 FROM prescriptions p JOIN encounters e ON e.id = p.encounter_id
      WHERE p.id = ?3 AND e.doctor_id = ?4 AND p.approved_at IS NOT NULL AND e.status = 'finalized'
        AND NOT EXISTS (SELECT 1 FROM prescriptions x WHERE x.supersedes_id = p.id AND x.approved_at IS NOT NULL)
      ON CONFLICT(prescription_id) DO NOTHING RETURNING prescription_id AS id, released_at AS releasedAt
    `).bind(actor.userId, now, prescriptionId, actor.doctorId),
    db.prepare(`
      INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
      SELECT ?, 'prescription.release', 'prescription', ?, ?, ? WHERE changes() = 1
    `).bind(actor.userId, prescriptionId, c.get("requestId"), now),
  ]);
  if (result.results.length) return c.json({ data: result.results[0] }, 201);
  const current = await db.prepare(`${projection} WHERE p.id = ? AND e.doctor_id = ?`)
    .bind(prescriptionId, actor.doctorId).first<Prescription>();
  if (!current) return c.notFound();
  return current.releasedAt ? c.json({ data: { id: current.id, releasedAt: current.releasedAt } }) : conflict(c);
});
