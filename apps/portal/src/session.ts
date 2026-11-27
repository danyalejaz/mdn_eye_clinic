import { api, ApiError } from "./api";
import type { Actor } from "./types";

export type Session =
  | { state: "anonymous" }
  | { state: "mfa" }
  | { state: "ready"; actor: Actor };

let cached: Promise<Session> | null = null;

export function clearSession() {
  cached = null;
}

export function loadSession(force = false) {
  if (force) cached = null;
  cached ??= api<{ data: Actor }>("/api/v1/me")
    .then((body) => ({ state: "ready" as const, actor: body.data }))
    .catch((error: unknown) => {
      if (error instanceof ApiError && error.status === 403) return { state: "mfa" as const };
      return { state: "anonymous" as const };
    });
  return cached;
}

