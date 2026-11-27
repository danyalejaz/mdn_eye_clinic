import { Hono } from "hono";

type CatalogEnv = { Bindings: Pick<Env, "DB">; Variables: { requestId: string } };
type Department = { departmentSlug: string; departmentName: string };
type Doctor = Department & {
  id: string;
  slug: string;
  displayName: string;
  specialty: string;
  qualifications: string | null;
  photoUrl: string | null;
  feeMinor: number;
  currency: "PKR";
};
type Service = Department & {
  slug: string;
  name: string;
  description: string | null;
  feeMinor: number;
  currency: "PKR";
};
type Clinic = {
  name: string;
  address: string;
  phone: string | null;
  hoursSummary: string | null;
  timezone: "Asia/Karachi";
  currency: "PKR";
};

export const publicCatalog = new Hono<CatalogEnv>();

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const doctorSelect = `
  SELECT d.id, d.slug, d.display_name AS displayName, d.specialty, d.qualifications,
    d.photo_url AS photoUrl, d.fee_minor AS feeMinor, 'PKR' AS currency,
    p.slug AS departmentSlug, p.name AS departmentName
  FROM doctors d JOIN departments p ON p.slug = d.department_slug
  WHERE d.published = 1 AND p.published = 1`;

function validSlug(slug: string) {
  return slug.length <= 80 && slugPattern.test(slug);
}

function listParams(query: URLSearchParams, allowed: readonly string[]) {
  for (const name of query.keys()) {
    if (!allowed.includes(name) || query.getAll(name).length > 1) return null;
  }

  const cursor = query.get("cursor");
  const department = query.get("department");
  const q = query.get("q")?.trim() ?? null;
  const rawLimit = query.get("limit") ?? "25";
  if (
    (cursor !== null && !validSlug(cursor)) ||
    (department !== null && !validSlug(department)) ||
    (q !== null && (q.length < 1 || q.length > 80)) ||
    !/^(?:[1-9]\d?|100)$/.test(rawLimit)
  ) return null;

  return { cursor: cursor ?? "", department, q, limit: Number(rawLimit) };
}

function page<T extends { slug: string }>(rows: T[], limit: number) {
  const data = rows.slice(0, limit);
  return { data, meta: { nextCursor: rows.length > limit ? data.at(-1)!.slug : null } };
}

publicCatalog.get("/clinic", async (c) => {
  const clinic = await c.env.DB.prepare(`
    SELECT name, address, phone, hours_summary AS hoursSummary,
      'Asia/Karachi' AS timezone, 'PKR' AS currency
    FROM clinic_settings WHERE id = 1 AND published = 1
  `).first<Clinic>();

  return clinic ? c.json({ data: clinic }) : c.notFound();
});

publicCatalog.get("/doctors", async (c) => {
  const params = listParams(new URL(c.req.url).searchParams, ["cursor", "limit", "department", "q"]);
  if (!params) {
    return c.json({
      error: { code: "VALIDATION_FAILED", message: "Invalid catalog query parameters." },
      requestId: c.get("requestId"),
    }, 422);
  }

  const { cursor, department, q, limit } = params;
  const { results } = await c.env.DB.prepare(`${doctorSelect}
    AND d.slug > ?1 AND (?2 IS NULL OR p.slug = ?2)
    AND (?3 IS NULL OR instr(lower(d.display_name), lower(?3)) > 0
      OR instr(lower(d.specialty), lower(?3)) > 0)
    ORDER BY d.slug LIMIT ?4
  `).bind(cursor, department, q, limit + 1).all<Doctor>();

  return c.json(page(results, limit));
});

publicCatalog.get("/doctors/:slug", async (c) => {
  const slug = c.req.param("slug");
  if (!validSlug(slug)) return c.notFound();

  const doctor = await c.env.DB.prepare(`${doctorSelect} AND d.slug = ?`)
    .bind(slug).first<Doctor>();
  return doctor ? c.json({ data: doctor }) : c.notFound();
});

publicCatalog.get("/services", async (c) => {
  const params = listParams(new URL(c.req.url).searchParams, ["cursor", "limit", "department"]);
  if (!params) {
    return c.json({
      error: { code: "VALIDATION_FAILED", message: "Invalid catalog query parameters." },
      requestId: c.get("requestId"),
    }, 422);
  }

  const { cursor, department, limit } = params;
  const { results } = await c.env.DB.prepare(`
    SELECT s.slug, s.name, s.description, s.fee_minor AS feeMinor, 'PKR' AS currency,
      p.slug AS departmentSlug, p.name AS departmentName
    FROM services s JOIN departments p ON p.slug = s.department_slug
    WHERE s.published = 1 AND p.published = 1
      AND s.slug > ?1 AND (?2 IS NULL OR p.slug = ?2)
    ORDER BY s.slug LIMIT ?3
  `).bind(cursor, department, limit + 1).all<Service>();

  return c.json(page(results, limit));
});
