#!/usr/bin/env bash
set -euo pipefail
umask 077

if [[ $# != 3 || ( $1 != --local && $1 != --remote ) ]]; then
  printf 'Usage: backup-d1.sh --local|--remote recipient-cert.pem new-output.cms\n' >&2
  exit 2
fi

mode=$1
recipient=$(realpath "$2")
output=$(realpath -m "$3")
if [[ ! -f $recipient || -e $output || -L $output ]]; then
  printf 'A recipient certificate and an unused output path are required.\n' >&2
  exit 2
fi
if [[ $mode == --remote && ( -z ${CLINIC_D1_CONFIG:-} || -z ${CLINIC_D1_ENV:-} ) ]]; then
  printf 'For a remote export, set CLINIC_D1_CONFIG and CLINIC_D1_ENV to the approved environment.\n' >&2
  exit 2
fi

config=()
if [[ -n ${CLINIC_D1_CONFIG:-} ]]; then
  config+=(--config "$(realpath "$CLINIC_D1_CONFIG")")
fi
if [[ -n ${CLINIC_D1_ENV:-} ]]; then
  config+=(--env "$CLINIC_D1_ENV")
fi
cd "$(dirname "$0")/.."
scratch=$(mktemp -d "${TMPDIR:-/tmp}/clinic-export.XXXXXXXX")
sealed=
trap 'rm -f -- "$scratch/database.sql" "${sealed:-}"; rmdir -- "$scratch"' EXIT
sealed=$(mktemp --tmpdir="$(dirname "$output")" .clinic-encrypted.XXXXXXXX)

pnpm exec wrangler d1 export DB "$mode" "${config[@]}" --output "$scratch/database.sql"
openssl cms -encrypt -binary -aes-256-gcm -outform DER \
  -in "$scratch/database.sql" -out "$sealed" "$recipient"
# Publish the encrypted file atomically; never overwrite an existing backup.
ln -T -- "$sealed" "$output"
printf 'Encrypted backup written: %s\n' "$output"
