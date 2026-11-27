import { Hono } from "hono";
import { publicCatalog } from "./public-catalog";
import { handleAuth, requireActor, type ApiEnv } from "./identity";

const app = new Hono<ApiEnv>();

app.use("*", async (c, next) => {
  const requestId = crypto.randomUUID();
  c.set("requestId", requestId);
  c.header("X-Request-Id", requestId);
  c.header("Cache-Control", "no-store");
  c.header("X-Content-Type-Options", "nosniff");
  await next();
});

app.get("/api/v1/health", (c) => c.json({ data: { status: "ok" } }));
app.route("/api/v1/public", publicCatalog);
app.on(["GET", "POST"], "/api/auth/*", handleAuth);
app.get("/api/v1/me", requireActor, (c) => c.json({ data: c.get("actor") }));

app.notFound((c) =>
  c.json(
    {
      error: { code: "NOT_FOUND", message: "Resource not found." },
      requestId: c.get("requestId"),
    },
    404,
  ),
);

app.onError((_error, c) => {
  const requestId = c.get("requestId");
  // Exceptions can contain sensitive values from future request handlers.
  console.error({ event: "api.unhandled_error", requestId });

  return c.json(
    {
      error: { code: "INTERNAL_ERROR", message: "An unexpected error occurred." },
      requestId,
    },
    500,
  );
});

export default app;
