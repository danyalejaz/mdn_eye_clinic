import { Hono } from "hono";
import type { Context } from "hono";
import { audit } from "./audit";
import { apiError, requireActor, requireRole, type ApiEnv } from "./identity";
import { businessDay, conflict, dayStart, id, input, invalid, money, operationKey, text } from "./inputs";
import { renderPdf } from "./pdf";

export const billing = new Hono<ApiEnv>();
const receptionOnly = requireRole("receptionist");
const reader = requireRole("patient", "receptionist", "admin");
const invoiceProjection = `
  SELECT i.id, i.appointment_id AS appointmentId, i.patient_id AS patientId, i.consultation_minor AS totalMinor,
    COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.invoice_id = i.id), 0)
      - COALESCE((SELECT SUM(r.amount_minor) FROM refunds r JOIN payments p ON p.id = r.payment_id
                  WHERE p.invoice_id = i.id), 0) AS paidMinor,
    i.created_at AS createdAt, 'PKR' AS currency FROM invoices i`;
type Invoice = { id: string; totalMinor: number; paidMinor: number };

function invoiceView(row: Invoice) {
  const balanceMinor = row.totalMinor - row.paidMinor;
  return { ...row, balanceMinor, status: balanceMinor === 0 ? "paid" : row.paidMinor > 0 ? "partially_paid" : "unpaid",
    items: [{ label: "Consultation", amountMinor: row.totalMinor }] };
}

function financeAudit(c: Context<ApiEnv>, action: string, type: string, resourceId: string) {
  return c.env.DB.prepare(`
    INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1
  `).bind(c.get("actor").userId, action, type, resourceId, c.get("requestId"), new Date().toISOString());
}

billing.post("/invoices", requireActor, receptionOnly, async (c) => {
  const body = await input(c, ["appointmentId"]);
  if (!body || !id(body.appointmentId)) return invalid(c);
  const db = c.env.DB;
  const invoiceId = crypto.randomUUID();
  const [created] = await db.batch([
    db.prepare(`
      INSERT INTO invoices (id, appointment_id, patient_id, consultation_minor, created_by, created_at)
      SELECT ?, id, patient_id, fee_minor, ?, ? FROM appointments
      WHERE id = ? AND status IN ('confirmed', 'waiting', 'in_consultation', 'completed')
      ON CONFLICT(appointment_id) DO NOTHING
    `).bind(invoiceId, c.get("actor").userId, new Date().toISOString(), body.appointmentId),
    financeAudit(c, "invoice.create", "invoice", invoiceId),
  ]);
  const row = await db.prepare(`${invoiceProjection} WHERE i.appointment_id = ?`).bind(body.appointmentId).first<Invoice>();
  return row ? c.json({ data: invoiceView(row) }, created.meta.changes === 1 ? 201 : 200) : c.notFound();
});

billing.get("/invoices", requireActor, reader, async (c) => {
  const actor = c.get("actor");
  const { results } = await c.env.DB.prepare(`${invoiceProjection} WHERE (?1 != 'patient' OR i.patient_id = ?2)
    ORDER BY i.created_at DESC, i.id LIMIT 101`).bind(actor.role, actor.patientId).all<Invoice>();
  return c.json({ data: results.slice(0, 100).map(invoiceView), meta: { truncated: results.length > 100 } });
});

billing.get("/invoices/:id", requireActor, reader, async (c) => {
  const actor = c.get("actor");
  const db = c.env.DB;
  const invoiceId = c.req.param("id");
  const row = await db.prepare(`${invoiceProjection} WHERE i.id = ?1 AND (?2 != 'patient' OR i.patient_id = ?3)`)
    .bind(invoiceId, actor.role, actor.patientId).first<Invoice>();
  if (!row) return c.notFound();
  const { results } = await db.prepare(`
    SELECT p.id AS receiptId, p.amount_minor AS amountMinor, p.method, p.created_at AS createdAt,
      COALESCE((SELECT SUM(r.amount_minor) FROM refunds r WHERE r.payment_id = p.id), 0) AS refundedMinor
    FROM payments p WHERE invoice_id = ? ORDER BY p.created_at, p.id
  `).bind(invoiceId).all();
  return c.json({ data: { ...invoiceView(row), receipts: results } });
});

type Payment = { id: string; invoiceId: string; amountMinor: number; method: string; reference: string | null; createdAt: string };
const paymentColumns = `id, invoice_id AS invoiceId, amount_minor AS amountMinor, method, reference, created_at AS createdAt`;
function paymentView(payment: Payment) {
  const { reference: _, ...data } = payment;
  return { ...data, receiptId: data.id, currency: "PKR" };
}

billing.post("/invoices/:id/payments", requireActor, receptionOnly, async (c) => {
  const body = await input(c, ["amountMinor", "method", "reference", "currency"]);
  const key = operationKey(c);
  if (!body || !money(body.amountMinor) || body.amountMinor <= 0 || !key ||
      (body.currency !== undefined && body.currency !== "PKR") ||
      (body.method !== "cash" && body.method !== "bank_transfer" && body.method !== "wallet") ||
      (body.method === "cash" ? body.reference != null : !text(body.reference, 120))) return invalid(c);
  const method = body.method;
  const reference = typeof body.reference === "string" ? body.reference.trim() : null;
  const actor = c.get("actor");
  const db = c.env.DB;
  const invoiceId = c.req.param("id");
  const paymentId = crypto.randomUUID();
  const [created] = await db.batch<Payment>([
    db.prepare(`
      INSERT INTO payments (id, invoice_id, amount_minor, method, reference, operation_key, created_by, created_at)
      SELECT ?1, i.id, ?2, ?3, ?4, ?5, ?6, ?7 FROM invoices i
      JOIN appointments a ON a.id = i.appointment_id
      WHERE i.id = ?8 AND a.status NOT IN ('cancelled', 'no_show', 'left') AND ?2 <= i.consultation_minor
        - COALESCE((SELECT SUM(p.amount_minor) FROM payments p WHERE p.invoice_id = i.id), 0)
        + COALESCE((SELECT SUM(r.amount_minor) FROM refunds r JOIN payments p ON p.id = r.payment_id
                    WHERE p.invoice_id = i.id), 0)
      ON CONFLICT DO NOTHING RETURNING ${paymentColumns}
    `).bind(paymentId, body.amountMinor, method, reference, key, actor.userId, new Date().toISOString(), invoiceId),
    financeAudit(c, "payment.record", "payment", paymentId),
  ]);
  if (created.results[0]) return c.json({ data: paymentView(created.results[0]) }, 201);
  const existing = await db.prepare(`SELECT ${paymentColumns} FROM payments WHERE created_by = ? AND operation_key = ?`)
    .bind(actor.userId, key).first<Payment>();
  if (existing) {
    if (existing.invoiceId !== invoiceId || existing.amountMinor !== body.amountMinor ||
        existing.method !== method || existing.reference !== reference) return conflict(c, "IDEMPOTENCY_CONFLICT");
    return c.json({ data: paymentView(existing) });
  }
  if (!await db.prepare("SELECT id FROM invoices WHERE id = ?").bind(invoiceId).first()) return c.notFound();
  if (reference && await db.prepare("SELECT id FROM payments WHERE method = ? AND reference = ?").bind(method, reference).first()) {
    return conflict(c, "PAYMENT_REFERENCE_USED", "That external payment reference has already been recorded.");
  }
  return conflict(c, "PAYMENT_EXCEEDS_BALANCE", "The payment exceeds the balance or the invoice cannot accept payments.");
});

billing.post("/payments/:id/refunds", requireActor, requireRole("admin"), async (c) => {
  const body = await input(c, ["amountMinor", "reason"]);
  const key = operationKey(c);
  if (!body || !money(body.amountMinor) || body.amountMinor <= 0 || !text(body.reason, 500) || !key) return invalid(c);
  const db = c.env.DB;
  const actor = c.get("actor");
  const paymentId = c.req.param("id");
  const refundId = crypto.randomUUID();
  const reason = body.reason.trim();
  type Refund = { id: string; paymentId: string; amountMinor: number; reason: string; createdAt: string };
  const columns = `id, payment_id AS paymentId, amount_minor AS amountMinor, reason, created_at AS createdAt`;
  const [created] = await db.batch<Refund>([
    db.prepare(`
      INSERT INTO refunds (id, payment_id, amount_minor, reason, operation_key, created_by, created_at)
      SELECT ?1, p.id, ?2, ?3, ?4, ?5, ?6 FROM payments p WHERE p.id = ?7 AND ?2 <= p.amount_minor -
        COALESCE((SELECT SUM(r.amount_minor) FROM refunds r WHERE r.payment_id = p.id), 0)
      ON CONFLICT DO NOTHING RETURNING ${columns}
    `).bind(refundId, body.amountMinor, reason, key, actor.userId, new Date().toISOString(), paymentId),
    financeAudit(c, "refund.record", "payment", paymentId),
  ]);
  if (created.results[0]) return c.json({ data: { ...created.results[0], currency: "PKR" } }, 201);
  const existing = await db.prepare(`SELECT ${columns} FROM refunds WHERE created_by = ? AND operation_key = ?`)
    .bind(actor.userId, key).first<Refund>();
  if (existing) {
    if (existing.paymentId !== paymentId || existing.amountMinor !== body.amountMinor || existing.reason !== reason) {
      return conflict(c, "IDEMPOTENCY_CONFLICT");
    }
    return c.json({ data: { ...existing, currency: "PKR" } });
  }
  if (!await db.prepare("SELECT id FROM payments WHERE id = ?").bind(paymentId).first()) return c.notFound();
  return conflict(c, "REFUND_EXCEEDS_PAYMENT", "The refund exceeds the refundable amount.");
});

billing.get("/receipts/:id/pdf", requireActor, reader, async (c) => {
  const actor = c.get("actor");
  const row = await c.env.DB.prepare(`
    SELECT p.id, p.invoice_id AS invoiceId, p.amount_minor AS amountMinor, p.method,
      p.created_at AS createdAt, r.patient_name AS patientName
    FROM payments p JOIN invoices i ON i.id = p.invoice_id JOIN receipt_identity r ON r.payment_id = p.id
    WHERE p.id = ?1 AND (?2 != 'patient' OR i.patient_id = ?3)
  `).bind(c.req.param("id"), actor.role, actor.patientId).first<Payment & { patientName: string }>();
  if (!row) return c.notFound();
  const pdf = await renderPdf("Payment Receipt", [
    `Receipt: ${row.id}`, `Invoice: ${row.invoiceId}`, `Patient: ${row.patientName}`,
    `Paid at: ${row.createdAt}`, `Amount: PKR ${(row.amountMinor / 100).toFixed(2)}`, `Method: ${row.method}`,
  ]);
  if (!pdf) return apiError(c, 422, "DOCUMENT_FONT_UNSUPPORTED", "The configured document font cannot render this receipt.");
  await audit(c, "receipt.read", "payment", row.id).run();
  return new Response(new Uint8Array(pdf), { headers: {
    "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="receipt-${row.id}.pdf"`,
    "Cache-Control": "private, no-store",
  } });
});

billing.get("/billing/collections", requireActor, requireRole("receptionist", "admin"), async (c) => {
  const date = c.req.query("date") ?? businessDay();
  const start = dayStart(date);
  if (!Number.isFinite(start)) return invalid(c);
  const { results } = await c.env.DB.prepare(`
    SELECT method, SUM(paid) AS grossMinor, SUM(refunded) AS refundedMinor,
      SUM(paid) - SUM(refunded) AS netMinor FROM (
      SELECT method, amount_minor AS paid, 0 AS refunded FROM payments
      WHERE created_at >= ?1 AND created_at < ?2
      UNION ALL
      SELECT p.method, 0, r.amount_minor FROM refunds r JOIN payments p ON p.id = r.payment_id
      WHERE r.created_at >= ?1 AND r.created_at < ?2
    ) GROUP BY method ORDER BY method
  `).bind(new Date(start).toISOString(), new Date(start + 86_400_000).toISOString()).all();
  return c.json({ data: { date, currency: "PKR", methods: results } });
});
