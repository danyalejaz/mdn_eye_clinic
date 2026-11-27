# Mardan Eye Clinic

The Hono API Worker lives in [`apps/api`](apps/api). Its versioned HTTP contract
is in [`contracts/openapi.yaml`](contracts/openapi.yaml).

## Run the backend locally

Use Node.js 24 and pnpm 10.28.2. No Cloudflare credentials are needed for local development.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

```sh
curl -i http://localhost:8787/api/v1/health
```

The health endpoint reports Worker liveness only.

## Public clinic catalog

Apply the schema to local D1 and optionally load fictional sample records:

```sh
pnpm --dir apps/api db:migrate:local
pnpm --dir apps/api db:seed:local
```

The read-only catalog provides `/clinic`, `/services`, `/doctors`, and
`/doctors/{slug}` under the `/api/v1/public` prefix. Lists return
published rows with a department filter and cursor pagination. The doctor list
also accepts `q` for name or specialty search. Store catalog slugs as lowercase
alphanumeric segments separated by hyphens. Use the same filters when
following `meta.nextCursor`.

The checked-in D1 ID is for local emulation. Production requires an
environment-specific D1 binding and approved catalog content; never apply the
fictional seed remotely.

## Identity

Set `AUTH_BASE_URL` to the exact portal origin and set `BETTER_AUTH_SECRET` to
a random secret of at least 32 characters (an ignored `apps/api/.dev.vars` is
appropriate for local use). Staff must complete authenticator MFA on each
session before using clinic APIs. Application roles come from `clinic_accounts`.
The public Better Auth signup route is disabled; accounts must be provisioned
through a trusted server workflow. See `/api/v1/me` for the current clinic scope.

## Appointments

`GET /api/v1/public/availability` uses inclusive `from` and `to` business dates
in Asia/Karachi and an optional `doctorId`. `GET /api/v1/appointments` and
`GET /api/v1/appointments/{id}` scope results to the linked patient or assigned
doctor. `POST /api/v1/appointments` requires an `Idempotency-Key` and a doctor
and slot ID; reception also supplies a patient ID. Cancellation and same-doctor
rescheduling take `expectedVersion` to prevent concurrent overwrites.

## Bootstrap a local administrator

Apply local migrations, then run `pnpm --dir apps/api admin:bootstrap:local`
with `CLINIC_BOOTSTRAP_EMAIL`, `CLINIC_BOOTSTRAP_NAME`, and
`CLINIC_BOOTSTRAP_PASSWORD` in the process environment. This command writes
only to local D1 and refuses to create a second bootstrap administrator.
Sign in, enroll an authenticator, then use `/api/v1/admin/accounts` to
provision staff or link a patient account to a record after staff verify identity.
Public signup is disabled; the API does not infer identity from a shared phone.

The audit API returns action and resource metadata, not passwords, drafts or
clinical notes. Backup status reports `not_configured` until a verified backup
integration exists. Published website pages use a separate snapshot from drafts.

## Verify changes

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` from the repository root.
The build bundles the Worker with Wrangler's dry-run mode for local verification.
