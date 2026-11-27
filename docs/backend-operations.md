# Backend operations

## Staging and production

The checked-in Worker uses a local-emulation D1 identifier. Use an
environment-specific Wrangler configuration and new D1 database for staging.
Keep the API on the portal origin so session cookies and request origins work.
Set `AUTH_BASE_URL` to that origin and provision a high-entropy
`BETTER_AUTH_SECRET` through the Worker secret store. Configure an approved
`AUTH_EMAIL_FROM` sender and `AUTH_EMAIL_API_KEY` after provider review.
Use synthetic staging data to check real email delivery and the connected portal
before release. Never import development fixtures into production.

Production requires an approved Cloudflare account and data jurisdiction,
domain/routing, authorized administrator bootstrap, and a backup destination.

## Encrypted D1 backups

Use OpenSSL 3, Bash, SQLite CLI, and the pinned Wrangler version. `backup-d1.sh` exports D1
and seals the SQL using AES-256-GCM in a CMS envelope for an approved X.509
recipient. Store the private key separately; the export runner only needs the
certificate. Set `TMPDIR` to a private encrypted filesystem or dedicated
RAM-backed directory for real data. Temporary plaintext is removed on shell exit.

```bash
bash apps/api/scripts/backup-d1.sh --local /secure/restore-cert.pem /secure/new-backup.cms
bash apps/api/scripts/verify-d1-restore.sh /secure/new-backup.cms /secure/restore-cert.pem /secure/restore-key.pem
```

For an approved remote source use `--remote` and set `CLINIC_D1_CONFIG` and
`CLINIC_D1_ENV` explicitly. The verifier decrypts and restores only into a fresh
local D1 instance. Run real-data restore drills only on an authorized isolated host.

Schedule daily exports on the approved runner and send only encrypted archives
to an independent, access-controlled destination. Apply clinic retention and
key-rotation policies. Alert on failures. Retrieve an archive from that destination
for a restore drill, compare totals to the expected recovery point, then rehearse
isolated service recovery and record measured RPO/RTO. The admin API reports
`not_configured` until a trusted scheduled-job status source is connected.
Coverage is D1 only; add independent object recovery before storing private files externally.
