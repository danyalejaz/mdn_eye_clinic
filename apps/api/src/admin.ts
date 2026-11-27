import { Hono } from "hono";
import type { Context } from "hono";
import { requireActor, requireRole, type ApiEnv, type Role } from "./identity";
import { businessDay, conflict, dayStart, id, input, invalid, money, text, timestamp, version } from "./inputs";
import { provisionAccount } from "./provision";

export const admin = new Hono<ApiEnv>();
export const publicPages = new Hono<ApiEnv>();
admin.use("*", requireActor, requireRole("admin"));
const day = 86_400_000;
const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const slug = (value: unknown): value is string => typeof value === "string" && value.length <= 80 && slugPattern.test(value);
const optionalText = (value: unknown, max: number) => value == null || text(value, max);

function auditChange(c: Context<ApiEnv>, action: string, type: string, resourceId: string) {
  return c.env.DB.prepare(`
    INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
    SELECT ?, ?, ?, ?, ?, ? WHERE changes() = 1
  `).bind(c.get("actor").userId, action, type, resourceId, c.get("requestId"), new Date().toISOString());
}

admin.get("/accounts", async (c) => {
  const { results } = await c.env.DB.prepare(`
    SELECT ca.user_id AS userId, u.name, u.email, ca.role, ca.active, ca.doctor_id AS doctorId
    FROM clinic_accounts ca JOIN user u ON u.id = ca.user_id ORDER BY u.email LIMIT 501
  `).all();
  return c.json({ data: results.slice(0, 500), meta: { truncated: results.length > 500 } });
});

admin.post("/accounts", async (c) => {
  const body = await input(c, ["email", "password", "name", "role", "doctorId", "patientId"]);
  if (!body || !text(body.email, 254) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email.trim()) ||
      !text(body.password, 128) || body.password.length < 12 || !text(body.name) ||
      typeof body.role !== "string" || !["patient", "receptionist", "doctor", "admin"].includes(body.role) ||
      (body.role === "doctor" ? !id(body.doctorId) : body.doctorId != null) ||
      (body.role === "patient" ? !id(body.patientId) : body.patientId != null)) return invalid(c);
  const userId = await provisionAccount(c.env.DB, {
    email: body.email.trim().toLowerCase(), name: body.name.trim(), password: body.password, role: body.role as Role,
    doctorId: typeof body.doctorId === "string" ? body.doctorId : undefined,
    patientId: typeof body.patientId === "string" ? body.patientId : undefined,
  }, c.get("actor").userId, c.get("requestId"));
  return userId ? c.json({ data: { userId, role: body.role } }, 201) :
    conflict(c, "ACCOUNT_CONFLICT", "This account or record cannot be linked.");
});

admin.patch("/accounts/:id", async (c) => {
  const body = await input(c, ["active"]);
  if (!body || typeof body.active !== "boolean") return invalid(c);
  const userId = c.req.param("id");
  const actorId = c.get("actor").userId;
  if (userId === actorId) return conflict(c);
  const db = c.env.DB;
  const [result] = await db.batch([
    db.prepare("UPDATE clinic_accounts SET active = ? WHERE user_id = ? AND active != ?")
      .bind(Number(body.active), userId, Number(body.active)),
    auditChange(c, body.active ? "account.activate" : "account.deactivate", "account", userId),
    db.prepare("DELETE FROM session WHERE userId = ? AND ? = 0").bind(userId, Number(body.active)),
  ]);
  if (!result.meta.changes && !await db.prepare("SELECT user_id FROM clinic_accounts WHERE user_id = ?").bind(userId).first()) return c.notFound();
  return c.json({ data: { userId, active: body.active } });
});

admin.get("/catalog", async (c) => {
  const db = c.env.DB;
  const [clinic, departments, doctors, services, rooms] = await db.batch([
    db.prepare("SELECT name, address, phone, hours_summary AS hoursSummary, published FROM clinic_settings WHERE id = 1"),
    db.prepare("SELECT slug, name, published FROM departments ORDER BY slug LIMIT 500"),
    db.prepare(`SELECT d.id, d.slug, d.department_slug AS departmentSlug, d.display_name AS displayName,
      d.specialty, d.qualifications, d.photo_url AS photoUrl, d.fee_minor AS feeMinor, d.published,
      r.room_id AS roomId FROM doctors d LEFT JOIN doctor_rooms r ON r.doctor_id = d.id ORDER BY d.slug LIMIT 500`),
    db.prepare(`SELECT slug, department_slug AS departmentSlug, name, description,
      fee_minor AS feeMinor, published FROM services ORDER BY slug LIMIT 500`),
    db.prepare("SELECT id, name FROM rooms ORDER BY id LIMIT 500"),
  ]);
  return c.json({ data: {
    clinic: clinic.results[0] ?? null, departments: departments.results, doctors: doctors.results,
    services: services.results, rooms: rooms.results,
  } });
});

admin.put("/clinic", async (c) => {
  const body = await input(c, ["name", "address", "phone", "hoursSummary", "published"]);
  if (!body || !text(body.name) || !text(body.address, 500) || !optionalText(body.phone, 40) ||
      !optionalText(body.hoursSummary, 200) || typeof body.published !== "boolean") return invalid(c);
  const db = c.env.DB;
  await db.batch([
    db.prepare(`INSERT INTO clinic_settings (id, name, address, phone, hours_summary, published)
      VALUES (1, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name,
      address = excluded.address, phone = excluded.phone, hours_summary = excluded.hours_summary, published = excluded.published`)
      .bind(body.name, body.address, body.phone ?? null, body.hoursSummary ?? null, Number(body.published)),
    auditChange(c, "catalog.clinic.save", "clinic", "1"),
  ]);
  return c.json({ data: body });
});

admin.put("/departments/:slug", async (c) => {
  const key = c.req.param("slug");
  const body = await input(c, ["name", "published"]);
  if (!slug(key) || !body || !text(body.name) || typeof body.published !== "boolean") return invalid(c);
  const db = c.env.DB;
  await db.batch([
    db.prepare(`INSERT INTO departments (slug, name, published) VALUES (?, ?, ?)
      ON CONFLICT(slug) DO UPDATE SET name = excluded.name, published = excluded.published`)
      .bind(key, body.name, Number(body.published)),
    auditChange(c, "catalog.department.save", "department", key),
  ]);
  return c.json({ data: { slug: key, ...body } });
});

admin.put("/services/:slug", async (c) => {
  const key = c.req.param("slug");
  const body = await input(c, ["name", "departmentSlug", "description", "feeMinor", "published"]);
  if (!slug(key) || !body || !text(body.name) || !slug(body.departmentSlug) || !optionalText(body.description, 2000) ||
      !money(body.feeMinor) || typeof body.published !== "boolean") return invalid(c);
  const db = c.env.DB;
  const [result] = await db.batch([
    db.prepare(`INSERT INTO services (slug, department_slug, name, description, fee_minor, published)
      SELECT ?1, slug, ?2, ?3, ?4, ?5 FROM departments WHERE slug = ?6
      ON CONFLICT(slug) DO UPDATE SET department_slug = excluded.department_slug, name = excluded.name,
        description = excluded.description, fee_minor = excluded.fee_minor, published = excluded.published`)
      .bind(key, body.name, body.description ?? null, body.feeMinor, Number(body.published), body.departmentSlug),
    auditChange(c, "catalog.service.save", "service", key),
  ]);
  return result.meta.changes ? c.json({ data: { slug: key, ...body } }) : c.notFound();
});

function publicPhoto(value: unknown) {
  if (value == null) return true;
  if (!text(value, 1000)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

admin.put("/doctors/:id", async (c) => {
  const key = c.req.param("id");
  const body = await input(c, ["slug", "departmentSlug", "displayName", "specialty", "qualifications", "photoUrl", "feeMinor", "published"]);
  if (!id(key) || !body || !slug(body.slug) || !slug(body.departmentSlug) || !text(body.displayName) || !text(body.specialty) ||
      !optionalText(body.qualifications, 2000) || !publicPhoto(body.photoUrl) || !money(body.feeMinor) ||
      typeof body.published !== "boolean") return invalid(c);
  const db = c.env.DB;
  const [result] = await db.batch([
    db.prepare(`INSERT INTO doctors (id, slug, department_slug, display_name, specialty, qualifications, photo_url, fee_minor, published)
      SELECT ?1, ?2, p.slug, ?3, ?4, ?5, ?6, ?7, ?8 FROM departments p WHERE p.slug = ?9
        AND NOT EXISTS (SELECT 1 FROM doctors WHERE slug = ?2 AND id != ?1)
      ON CONFLICT(id) DO UPDATE SET slug = excluded.slug, department_slug = excluded.department_slug,
        display_name = excluded.display_name, specialty = excluded.specialty, qualifications = excluded.qualifications,
        photo_url = excluded.photo_url, fee_minor = excluded.fee_minor, published = excluded.published`)
      .bind(key, body.slug, body.displayName, body.specialty, body.qualifications ?? null, body.photoUrl ?? null,
        body.feeMinor, Number(body.published), body.departmentSlug),
    auditChange(c, "catalog.doctor.save", "doctor", key),
  ]);
  return result.meta.changes ? c.json({ data: { id: key, ...body } }) : conflict(c, "CATALOG_CONFLICT");
});

admin.put("/rooms/:id", async (c) => {
  const roomId = c.req.param("id");
  const body = await input(c, ["name", "doctorId"]);
  if (!id(roomId) || !body || !text(body.name) || (body.doctorId != null && !id(body.doctorId))) return invalid(c);
  const db = c.env.DB;
  if (body.doctorId && !await db.prepare("SELECT id FROM doctors WHERE id = ?").bind(body.doctorId).first()) return c.notFound();
  const statements = [
    db.prepare("INSERT INTO rooms (id, name) VALUES (?, ?) ON CONFLICT(id) DO UPDATE SET name = excluded.name")
      .bind(roomId, body.name),
    auditChange(c, "room.save", "room", roomId),
  ];
  if (body.doctorId) statements.push(db.prepare(`INSERT INTO doctor_rooms (doctor_id, room_id) VALUES (?, ?)
    ON CONFLICT(doctor_id) DO UPDATE SET room_id = excluded.room_id`).bind(body.doctorId, roomId));
  await db.batch(statements);
  return c.json({ data: { id: roomId, ...body } });
});

admin.get("/slots", async (c) => {
  const date = c.req.query("date") ?? businessDay();
  const start = dayStart(date);
  if (!Number.isFinite(start)) return invalid(c);
  const { results } = await c.env.DB.prepare(`
    SELECT s.id, s.doctor_id AS doctorId, s.start_at AS startAt, s.end_at AS endAt,
      s.enabled, EXISTS (SELECT 1 FROM appointments a WHERE a.slot_id = s.id
        AND a.status NOT IN ('cancelled', 'left')) AS reserved FROM appointment_slots s
    WHERE s.start_at >= ? AND s.start_at < ? ORDER BY s.start_at, s.id LIMIT 501
  `).bind(new Date(start).toISOString(), new Date(start + day).toISOString()).all();
  return c.json({ data: results.slice(0, 500), meta: { truncated: results.length > 500 } });
});

admin.post("/slots", async (c) => {
  const body = await input(c, ["doctorId", "startAt", "endAt"]);
  if (!body || !id(body.doctorId) || !timestamp(body.startAt) || !timestamp(body.endAt) || body.endAt <= body.startAt ||
      Date.parse(body.startAt) <= Date.now() || Date.parse(body.endAt) - Date.parse(body.startAt) > 4 * 3_600_000) return invalid(c);
  const slotId = crypto.randomUUID();
  const db = c.env.DB;
  try {
    const [row] = await db.batch([
      db.prepare(`INSERT INTO appointment_slots (id, doctor_id, start_at, end_at)
        SELECT ?, id, ?, ? FROM doctors WHERE id = ? RETURNING id, doctor_id AS doctorId, start_at AS startAt, end_at AS endAt`)
        .bind(slotId, body.startAt, body.endAt, body.doctorId),
      auditChange(c, "slot.create", "slot", slotId),
    ]);
    return row.results.length ? c.json({ data: row.results[0] }, 201) : c.notFound();
  } catch (error) {
    if (error instanceof Error && error.message.includes("SLOT_OVERLAP")) return conflict(c, "SCHEDULE_CONFLICT");
    throw error;
  }
});

admin.patch("/slots/:id", async (c) => {
  const slotId = c.req.param("id");
  const body = await input(c, ["enabled"]);
  if (!body || typeof body.enabled !== "boolean") return invalid(c);
  const db = c.env.DB;
  const [result] = await db.batch([
    db.prepare(`UPDATE appointment_slots SET enabled = ?1 WHERE id = ?2 AND (?1 = 1 OR NOT EXISTS (
      SELECT 1 FROM appointments WHERE slot_id = ?2 AND status NOT IN ('cancelled', 'left')))`)
      .bind(Number(body.enabled), slotId),
    auditChange(c, "slot.availability.update", "slot", slotId),
  ]);
  if (result.meta.changes) return c.json({ data: { id: slotId, enabled: body.enabled } });
  return await db.prepare("SELECT id FROM appointment_slots WHERE id = ?").bind(slotId).first() ?
    conflict(c, "SCHEDULE_CONFLICT", "A reserved slot cannot be disabled.") : c.notFound();
});

admin.get("/content/:slug", async (c) => {
  const data = await c.env.DB.prepare(`SELECT slug, draft_title AS draftTitle, draft_body AS draftBody,
    version, published_at AS publishedAt FROM website_pages WHERE slug = ?`).bind(c.req.param("slug")).first();
  return data ? c.json({ data }) : c.notFound();
});

admin.put("/content/:slug", async (c) => {
  const key = c.req.param("slug");
  const body = await input(c, ["title", "body", "expectedVersion"]);
  if (!slug(key) || !body || !text(body.title) || !text(body.body, 12_000) ||
      (body.expectedVersion !== 0 && !version(body.expectedVersion))) return invalid(c);
  const db = c.env.DB;
  const [result] = await db.batch([
    body.expectedVersion === 0 ? db.prepare(`INSERT INTO website_pages (slug, draft_title, draft_body)
      VALUES (?, ?, ?) ON CONFLICT(slug) DO NOTHING RETURNING version`).bind(key, body.title, body.body) :
      db.prepare(`UPDATE website_pages SET draft_title = ?, draft_body = ?, version = version + 1
        WHERE slug = ? AND version = ? RETURNING version`).bind(body.title, body.body, key, body.expectedVersion),
    auditChange(c, "content.draft.save", "page", key),
  ]);
  return result.results.length ? c.json({ data: result.results[0] }) : conflict(c, "VERSION_CONFLICT");
});

admin.post("/content/:slug/publish", async (c) => {
  const key = c.req.param("slug");
  const body = await input(c, ["expectedVersion"]);
  if (!slug(key) || !body || !version(body.expectedVersion)) return invalid(c);
  const db = c.env.DB;
  const [result] = await db.batch([
    db.prepare(`UPDATE website_pages SET published_title = draft_title, published_body = draft_body,
      published_at = ?, version = version + 1 WHERE slug = ? AND version = ?
      RETURNING version, published_at AS publishedAt`).bind(new Date().toISOString(), key, body.expectedVersion),
    auditChange(c, "content.publish", "page", key),
  ]);
  return result.results.length ? c.json({ data: result.results[0] }) : conflict(c, "VERSION_CONFLICT");
});

publicPages.get("/pages/:slug", async (c) => {
  const data = await c.env.DB.prepare(`SELECT slug, published_title AS title, published_body AS body, published_at AS publishedAt
    FROM website_pages WHERE slug = ? AND published_at IS NOT NULL`).bind(c.req.param("slug")).first();
  return data ? c.json({ data }) : c.notFound();
});

admin.get("/reports", async (c) => {
  const date = businessDay();
  const from = dayStart(c.req.query("from") ?? date);
  const to = dayStart(c.req.query("to") ?? date);
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from || to - from >= 90 * day) return invalid(c);
  const start = new Date(from).toISOString();
  const end = new Date(to + day).toISOString();
  const db = c.env.DB;
  const [appointments, finances, counts] = await db.batch([
    db.prepare(`SELECT status, COUNT(*) AS count FROM appointments
      WHERE scheduled_at >= ? AND scheduled_at < ? GROUP BY status ORDER BY status`).bind(start, end),
    db.prepare(`SELECT
      (SELECT COALESCE(SUM(amount_minor), 0) FROM payments WHERE created_at >= ?1 AND created_at < ?2) AS grossMinor,
      (SELECT COALESCE(SUM(amount_minor), 0) FROM refunds WHERE created_at >= ?1 AND created_at < ?2) AS refundedMinor`)
      .bind(start, end),
    db.prepare(`SELECT (SELECT COUNT(*) FROM doctors d JOIN departments p ON p.slug = d.department_slug
      WHERE d.published = 1 AND p.published = 1) AS publishedDoctors,
      (SELECT COUNT(*) FROM clinic_accounts WHERE active = 1 AND role != 'patient') AS activeStaff`),
  ]);
  const totals = finances.results[0] as { grossMinor: number; refundedMinor: number };
  const clinicCounts = counts.results[0] as { publishedDoctors: number; activeStaff: number };
  return c.json({ data: { appointments: appointments.results, ...clinicCounts, ...totals,
    netMinor: totals.grossMinor - totals.refundedMinor, currency: "PKR" } });
});

admin.get("/audit-logs", async (c) => {
  const cursor = c.req.query("cursor");
  const value = cursor === undefined ? null : Number(cursor);
  if (value !== null && (!Number.isSafeInteger(value) || value < 1)) return invalid(c);
  const { results } = await c.env.DB.prepare(`SELECT id, actor_id AS actorId, action, resource_type AS resourceType,
    resource_id AS resourceId, request_id AS requestId, created_at AS createdAt FROM audit_events
    WHERE ?1 IS NULL OR id < ?1 ORDER BY id DESC LIMIT 51`).bind(value).all<{ id: number }>();
  const data = results.slice(0, 50);
  return c.json({ data, meta: { nextCursor: results.length > 50 ? data.at(-1)?.id : null } });
});

admin.get("/backup-status", (c) => c.json({ data: { status: "not_configured", verifiedAt: null } }));
