import { readFile } from "node:fs/promises";
import { URL } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPlatformProxy } from "wrangler";
import app from "../src/index";

describe("public clinic catalog with local D1", () => {
  let platform: Awaited<ReturnType<typeof getPlatformProxy<Pick<Env, "DB">>>>;

  beforeAll(async () => {
    platform = await getPlatformProxy({ configPath: "wrangler.jsonc", persist: false });

    for (const path of [
      "../../../packages/database/migrations/0001_public_catalog.sql",
      "./fixtures/public-catalog.sql",
    ]) {
      const sql = await readFile(new URL(path, import.meta.url), "utf8");
      const statements = sql.split(/;\s*(?:\r?\n|$)/).map((part) => part.trim()).filter(Boolean);
      await platform.env.DB.batch(statements.map((statement) => platform.env.DB.prepare(statement)));
    }
  }, 15_000);

  afterAll(async () => {
    await platform?.dispose();
  });

  function get(path: string) {
    return app.request(`/api/v1/public/${path}`, undefined, platform.env);
  }

  it("returns only published clinic and service information", async () => {
    const clinic = await get("clinic");
    expect(clinic.status).toBe(200);
    expect(await clinic.json()).toEqual({
      data: {
        name: "Demo Eye Clinic",
        address: "Sample address, Mardan",
        phone: null,
        hoursSummary: "Mon–Sat, 9:00 AM–2:00 PM",
        timezone: "Asia/Karachi",
        currency: "PKR",
      },
    });

    const services = await get("services");
    expect(services.status).toBe(200);
    expect(await services.json()).toEqual({
      data: [{
        slug: "eye-consultation", name: "Demo Eye Consultation", description: null,
        feeMinor: 150000, currency: "PKR", departmentSlug: "eye-care", departmentName: "Eye Care",
      }],
      meta: { nextCursor: null },
    });
  });

  it("paginates and filters doctors without returning draft rows", async () => {
    const first = await get("doctors?department=eye-care&limit=1");
    expect(await first.json()).toMatchObject({
      data: [{ slug: "demo-doctor-a" }], meta: { nextCursor: "demo-doctor-a" },
    });

    const next = await get("doctors?department=eye-care&limit=1&cursor=demo-doctor-a");
    expect(await next.json()).toMatchObject({
      data: [{ slug: "demo-doctor-b" }], meta: { nextCursor: null },
    });

    const search = await get("doctors?q=OPHTHALMOLOGY");
    expect(await search.json()).toMatchObject({
      data: [{ slug: "demo-doctor-a" }], meta: { nextCursor: null },
    });
  });

  it("uses a normal 404 for hidden doctor profiles", async () => {
    const published = await get("doctors/demo-doctor-a");
    expect(published.status).toBe(200);
    expect(await published.json()).toMatchObject({ data: { id: "doc_demo_a" } });

    for (const slug of ["draft-doctor", "hidden-doctor", "unknown-doctor"]) {
      const hidden = await get(`doctors/${slug}`);
      expect(hidden.status).toBe(404);
      expect(await hidden.json()).toEqual({
        error: { code: "NOT_FOUND", message: "Resource not found." },
        requestId: hidden.headers.get("X-Request-Id"),
      });
    }
  });

  it.each(["limit=101", "limit=1&limit=2", "q=%20", "cursor=invalid_cursor"])(
    "rejects invalid doctor list query %s",
    async (query) => {
      const response = await get(`doctors?${query}`);
      expect(response.status).toBe(422);
      expect(await response.json()).toMatchObject({ error: { code: "VALIDATION_FAILED" } });
    },
  );
});
