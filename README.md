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
Set `AUTH_EMAIL_FROM` to an approved Resend sender and supply `AUTH_EMAIL_API_KEY`
as a secret to enable patient signup and email recovery. Without both, those
endpoints return 503. Read `/api/v1/me` for the current clinic scope.

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
Self-registration creates a new record after email verification. It never
matches by name, email or phone to an existing clinic chart. Existing patients
should ask the clinic to provision their linked account. Unverified staff and
administratively provisioned accounts require staff-assisted recovery.
New patients must sign in with the credentials they registered before opening
the verification link in the same browser. Until they verify, their session
cannot access clinic records.

The audit API returns action and resource metadata, not passwords, drafts or
clinical notes. Backup status reports `not_configured` until a verified backup
integration exists. Published website pages use a separate snapshot from drafts.

## API integration

The OpenAPI document covers booking, check-in, queue, clinical records,
prescriptions, billing, and administration. Portal calls use the same origin
and cookies; send JSON and the portal `Origin` on mutations. For auth, sign in
at `/api/auth/sign-in/email`, follow the authenticator challenge for staff,
then use `/api/v1/me` for the authoritative role and record scope. Pass the
same `Idempotency-Key` when retrying an identical booking, payment, refund, or
prescription approval; after a version conflict, reload the resource.

Patients see their own appointments, released summaries and prescriptions,
and invoice receipts. Reception handles demographics, the queue, and payment
recording without clinical notes. Doctors can start and finalize their assigned
encounters; publication to the patient requires separate release actions.
Administrators manage accounts, catalogs, rooms, and non-overlapping slots,
and can view totals, issue refunds, and inspect redacted audit events. The
public queue display returns room name and token state only. Display the
`displayToken` on both staff and waiting-room screens; it is unique for that
Karachi business date even when doctors share a room.

The patient notification feed includes booking changes and release notices.
It also displays a reminder during the 48 hours before a confirmed slot;
cancelled or rescheduled visits stop showing the old reminder. These notices
are in-app only and contain no clinical message text.

Local PDFs are rendered on demand and require authorization on every request.
Issued prescriptions and receipts retain the names recorded at approval or payment.
The current English print font returns `DOCUMENT_FONT_UNSUPPORTED` for text
it cannot render; it never substitutes or drops clinical text.

For email recovery, send `{email}` to `POST /api/auth/request-password-reset`.
If eligible, the patient receives `/reset-password#token=…`; the portal should
read the fragment, remove it from the address bar, and submit `{token,
newPassword}` to `POST /api/auth/reset-password`. The fragment is not sent to
the page server. Tokens expire after 30 minutes, and reset revokes existing
sessions. The reset screen still needs to be connected by the frontend owner.

See [backend operations](docs/backend-operations.md) for deployment and the
encrypted backup and restore drill, or to run the portal bundle and API on the
same local origin.

## Verify changes

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` from the repository root.
The build bundles the Worker with Wrangler's dry-run mode for local verification.

## Frontend

`apps/website` is the public Astro site and `apps/portal` is the React role portal.
Shared visual tokens live in `packages/ui`. These screens use fictional demo records
and the placeholder “Clinic Name”. They do not reserve appointments or read clinical data.

```sh
pnpm dev:website
pnpm dev:portal
```

- Website: http://127.0.0.1:4321
- Portal: http://127.0.0.1:5173

Set `PUBLIC_PORTAL_URL` when the portal is not on that address. Do not commit `.env`,
`.dev.vars`, secrets, or real patient records.
