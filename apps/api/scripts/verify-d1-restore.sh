#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# != 3 ]]; then
  printf 'Usage: verify-d1-restore.sh backup.cms recipient-cert.pem private-key.pem\n' >&2
  exit 2
fi

archive=$(realpath "$1")
certificate=$(realpath "$2")
key=$(realpath "$3")
cd "$(dirname "$0")/.."
scratch=$(mktemp -d "${TMPDIR:-/tmp}/clinic-restore.XXXXXXXX")
trap 'rm -rf -- "$scratch"' EXIT

# OpenSSL can emit partial plaintext before checking the tag. Import only on success.
openssl cms -decrypt -binary -inform DER -recip "$certificate" -inkey "$key" \
  -in "$archive" -out "$scratch/database.sql"
pnpm exec wrangler d1 execute DB --local --persist-to "$scratch/d1" --file "$scratch/database.sql" >/dev/null
# D1 disallows these PRAGMAs; check the restored local SQLite file directly.
shopt -s nullglob
databases=("$scratch"/d1/v3/d1/miniflare-D1DatabaseObject/[0-9a-f]*.sqlite)
if [[ ${#databases[@]} != 1 ]] ||
   [[ $(sqlite3 -readonly "${databases[0]}" 'PRAGMA integrity_check;') != ok ]] ||
   [[ -n $(sqlite3 -readonly "${databases[0]}" 'PRAGMA foreign_key_check;') ]]; then
  printf 'Isolated D1 restore failed integrity checks.\n' >&2
  exit 1
fi

migrations=$(sqlite3 -readonly "${databases[0]}" 'SELECT COUNT(*) FROM d1_migrations;')
[[ $migrations =~ ^[0-9]+$ && $migrations -ge 10 ]]
printf 'Isolated D1 restore passed with %s migrations. Reconciliation totals:\n' "$migrations"
sqlite3 -readonly -header -column "${databases[0]}" \
  'SELECT (SELECT COUNT(*) FROM appointments) AS appointments,
          (SELECT COUNT(*) FROM payments) AS payments,
          (SELECT COUNT(*) FROM encounters) AS encounters,
          (SELECT COUNT(*) FROM audit_events) AS audit_events;'
