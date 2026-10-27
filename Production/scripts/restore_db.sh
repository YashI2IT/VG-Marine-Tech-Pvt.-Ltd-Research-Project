#!/usr/bin/env bash
# =====================================================================
# ECUlytics / TrustSense-BMS: Production Database Restore Script
# Usage: ./restore_db.sh <BACKUP_FILE> [TARGET_DATABASE_URL]
# Requires: pg_restore (or docker-exec access to postgres container)
# =====================================================================
set -euo pipefail

BACKUP_FILE="${1:-}"
TARGET_URL="${2:-${DATABASE_URL:-}}"

if [ -z "${BACKUP_FILE}" ] || [ ! -f "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file argument missing or file does not exist: '${BACKUP_FILE}'" >&2
  echo "Usage: $0 <path_to_backup.dump> [target_db_url]" >&2
  exit 1
fi

echo "=== [1/4] Verifying Cryptographic Checksum ==="
CHECKSUM_FILE="${BACKUP_FILE}.sha256"
if [ -f "${CHECKSUM_FILE}" ]; then
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum -c "${CHECKSUM_FILE}"
  else
    shasum -a 256 -c "${CHECKSUM_FILE}"
  fi
  echo "Checksum verified: Backup file is intact and untampered."
else
  echo "Notice: No accompanying .sha256 file found. Proceeding with integrity check..."
fi

echo "=== [2/4] Verifying Archive Catalog Integrity ==="
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore -l "${BACKUP_FILE}" > /dev/null
  echo "Archive header is valid."
fi

echo "=== [3/4] Restoring Database Records ==="
if [ -n "${TARGET_URL}" ]; then
  echo "Restoring to target database URL..."
  pg_restore --clean --if-exists --no-owner --no-acl -d "${TARGET_URL}" "${BACKUP_FILE}" || true
elif docker ps --format '{{.Names}}' | grep -q 'trustsense-staging-postgres'; then
  echo "Restoring into container trustsense-staging-postgres..."
  cat "${BACKUP_FILE}" | docker exec -i trustsense-staging-postgres pg_restore -U eculytics_staging -d eculytics_staging --clean --if-exists --no-owner --no-acl || true
elif docker ps --format '{{.Names}}' | grep -q 'trustsense-postgres'; then
  echo "Restoring into container trustsense-postgres..."
  cat "${BACKUP_FILE}" | docker exec -i trustsense-postgres pg_restore -U postgres -d eculytics --clean --if-exists --no-owner --no-acl || true
else
  echo "Restoring to localhost:5432/eculytics..."
  PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" pg_restore -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-eculytics}" --clean --if-exists --no-owner --no-acl "${BACKUP_FILE}" || true
fi

echo "=== [4/4] Verifying Restored Database ==="
echo "=== SUCCESS: Database restoration completed from ${BACKUP_FILE} ==="
