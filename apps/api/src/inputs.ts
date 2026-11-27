import type { Context } from "hono";
import { apiError, type ApiEnv } from "./identity";

export function invalid(c: Context<ApiEnv>) {
  return apiError(c, 422, "VALIDATION_FAILED", "One or more fields are invalid.");
}

export function conflict(c: Context<ApiEnv>, code = "INVALID_TRANSITION", message = "The operation conflicts with the current state.") {
  return apiError(c, 409, code, message);
}

export async function input(c: Context<ApiEnv>, allowed: readonly string[]) {
  if (c.req.header("Content-Type")?.split(";")[0].trim().toLowerCase() !== "application/json") return null;
  try {
    const value: unknown = await c.req.json();
    if (!value || typeof value !== "object" || Array.isArray(value) ||
        Object.keys(value).some((key) => !allowed.includes(key))) return null;
    return value as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function text(value: unknown, max = 120): value is string {
  return typeof value === "string" && value.trim().length > 0 && value.length <= max;
}

export function id(value: unknown): value is string {
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(value);
}

export function version(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

export function money(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0 && value <= 100_000_000_000;
}

export function operationKey(c: Context<ApiEnv>) {
  const key = c.req.header("Idempotency-Key");
  return key && /^[a-zA-Z0-9._:-]{8,128}$/.test(key) ? key : null;
}

export function timestamp(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value) &&
    Number.isFinite(Date.parse(value)) && new Date(value).toISOString() === value;
}

export function businessDay(value: Date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit" }).format(value);
}

export function dayStart(value: string) {
  if (!/^\d{4}-\d\d-\d\d$/.test(value)) return NaN;
  const utc = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(utc) && new Date(utc).toISOString().slice(0, 10) === value ? utc - 18_000_000 : NaN;
}
