import type { PublicDoctor } from "./types";

export class ApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

type ErrorBody = { error?: { code?: string; message?: string } };

export async function api<T>(path: string, init?: { method?: string; body?: unknown; idempotencyKey?: string }): Promise<T> {
  const headers = new Headers();
  if (init?.body !== undefined) headers.set("Content-Type", "application/json");
  if (init?.idempotencyKey) headers.set("Idempotency-Key", init.idempotencyKey);
  const response = await fetch(path, {
    method: init?.method ?? (init?.body !== undefined ? "POST" : "GET"),
    headers,
    body: init?.body !== undefined ? JSON.stringify(init.body) : undefined,
    credentials: "same-origin",
  });
  const payload = (await response.json().catch(() => null)) as (T & ErrorBody) | null;
  if (!response.ok) {
    throw new ApiError(
      response.status,
      payload?.error?.code ?? "REQUEST_FAILED",
      payload?.error?.message ?? "The clinic service could not complete that request.",
    );
  }
  return payload as T;
}

export async function publicDoctors() {
  const rows: PublicDoctor[] = [];
  let cursor = "";
  for (let page = 0; page < 10; page += 1) {
    const query = new URLSearchParams({ limit: "100" });
    if (cursor) query.set("cursor", cursor);
    const body = await api<{ data: PublicDoctor[]; meta: { nextCursor: string | null } }>(`/api/v1/public/doctors?${query}`);
    rows.push(...body.data);
    if (!body.meta.nextCursor) break;
    cursor = body.meta.nextCursor;
  }
  return rows;
}

export function failureMessage(error: unknown) {
  return error instanceof ApiError ? error.message : "The clinic service is unavailable.";
}
