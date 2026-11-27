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

The health endpoint reports Worker liveness only. The API currently has no
database or other service bindings.

## Verify changes

Run `pnpm typecheck`, `pnpm test`, and `pnpm build` from the repository root.
The build bundles the Worker with Wrangler's dry-run mode for local verification.
