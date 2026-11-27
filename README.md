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

## Verify changes

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` from the repository root.
The build bundles the Worker with Wrangler's dry-run mode for local verification.
