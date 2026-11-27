import { describe, expect, it, vi } from "vitest";
import app from "../src/index";

app.get("/test/unhandled-error", () => {
  throw new Error("Sensitive test detail");
});

describe("API foundation", () => {
  it("serves a minimal, non-cacheable health response", async () => {
    const response = await app.request("/api/v1/health", {
      headers: { "X-Request-Id": "untrusted-client-value" },
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toMatch(/^application\/json\b/);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(response.headers.get("X-Request-Id")).toMatch(/^[\da-f-]{36}$/);
    expect(await response.json()).toEqual({ data: { status: "ok" } });
  });

  it.each(["/api/v1/missing", "/api/auth/missing"])(
    "returns a correlated JSON 404 for %s",
    async (path) => {
      const response = await app.request(path);
      const requestId = response.headers.get("X-Request-Id");

      expect(response.status).toBe(404);
      expect(requestId).toBeTruthy();
      expect(response.headers.get("Cache-Control")).toBe("no-store");
      expect(await response.json()).toEqual({
        error: { code: "NOT_FOUND", message: "Resource not found." },
        requestId,
      });
    },
  );

  it("keeps unexpected exception details out of responses and logs", async () => {
    const logger = vi.spyOn(console, "error").mockImplementation(() => {});

    try {
      const response = await app.request("/test/unhandled-error");
      const requestId = response.headers.get("X-Request-Id");

      expect(response.status).toBe(500);
      expect(requestId).toBeTruthy();
      expect(await response.json()).toEqual({
        error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
        requestId,
      });
      expect(logger.mock.calls).toEqual([[{ event: "api.unhandled_error", requestId }]]);
    } finally {
      logger.mockRestore();
    }
  });
});
