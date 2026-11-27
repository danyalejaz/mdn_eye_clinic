import type { Context } from "hono";
import type { ApiEnv } from "./identity";

export function audit(c: Context<ApiEnv>, action: string, resourceType: string, resourceId: string) {
  return c.env.DB.prepare(`
    INSERT INTO audit_events(actor_id, action, resource_type, resource_id, request_id, created_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).bind(c.get("actor").userId, action, resourceType, resourceId, c.get("requestId"), new Date().toISOString());
}
