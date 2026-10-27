#!/usr/bin/env bash
# =====================================================================
# ECUlytics / TrustSense-BMS: Production Database Backup Script
# Usage: ./backup_db.sh [TARGET_DIR]
# Requires: pg_dump (or docker-exec access to postgres container)
# =====================================================================
set -euo pipefail

BACKUP_DIR="${1:-${BACKUP_DIR:-./Production/backups}}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/eculytics_backup_${TIMESTAMP}.dump"
CHECKSUM_FILE="${BACKUP_FILE}.sha256"

mkdir -p "${BACKUP_DIR}"

echo "=== [1/4] Starting PostgreSQL Backup ==="
echo "Destination: ${BACKUP_FILE}"

# If DATABASE_URL is set, use it; otherwise check POSTGRES container
if [ -n "${DATABASE_URL:-}" ]; then
  echo "Connecting via DATABASE_URL..."
  pg_dump "${DATABASE_URL}" -Fc --no-owner --no-acl -f "${BACKUP_FILE}"
elif docker ps --format '{{.Names}}' | grep -q 'trustsense-staging-postgres'; then
  echo "Executing pg_dump inside container trustsense-staging-postgres..."
  docker exec -t trustsense-staging-postgres pg_dump -U eculytics_staging -d eculytics_staging -Fc --no-owner --no-acl > "${BACKUP_FILE}"
elif docker ps --format '{{.Names}}' | grep -q 'trustsense-postgres'; then
  echo "Executing pg_dump inside container trustsense-postgres..."
  docker exec -t trustsense-postgres pg_dump -U postgres -d eculytics -Fc --no-owner --no-acl > "${BACKUP_FILE}"
else
  # Default to local localhost:5432
  echo "Connecting to localhost:5432/eculytics as postgres..."
  PGPASSWORD="${POSTGRES_PASSWORD:-postgres}" pg_dump -h "${PGHOST:-localhost}" -p "${PGPORT:-5432}" -U "${PGUSER:-postgres}" -d "${PGDATABASE:-eculytics}" -Fc --no-owner --no-acl -f "${BACKUP_FILE}"
fi

# Verify backup file exists and is non-empty
if [ ! -s "${BACKUP_FILE}" ]; then
  echo "ERROR: Backup file ${BACKUP_FILE} was not created or is empty!" >&2
  exit 1
fi

FILESIZE=$(wc -c < "${BACKUP_FILE}" | tr -d ' ')
echo "=== [2/4] Backup Created Successfully (${FILESIZE} bytes) ==="

echo "=== [3/4] Generating Cryptographic SHA-256 Checksum ==="
if command -v sha256sum >/dev/null 2>&1; then
  sha256sum "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
else
  shasum -a 256 "${BACKUP_FILE}" > "${CHECKSUM_FILE}"
fi
cat "${CHECKSUM_FILE}"

echo "=== [4/4] Verifying Archive Integrity ==="
if command -v pg_restore >/dev/null 2>&1; then
  pg_restore -l "${BACKUP_FILE}" > /dev/null
  echo "Archive integrity verified: Table catalog parsed successfully."
else
  echo "pg_restore not in PATH; skipping catalog header parse verification."
fi

echo "=== SUCCESS: Backup complete: ${BACKUP_FILE} ==="
