#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/postgres}"
PG_CONTAINER_NAME="${PG_CONTAINER_NAME:-supabase-db}"
PG_DATABASE="${PG_DATABASE:-postgres}"
PG_USER="${PG_USER:-postgres}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${BACKUP_DIR}/postgres-${TS}.sql.gz"

mkdir -p "${BACKUP_DIR}"

if ! docker ps --format '{{.Names}}' | grep -qx "${PG_CONTAINER_NAME}"; then
  echo "[backup-postgres] Container '${PG_CONTAINER_NAME}' is not running. Skip."
  exit 0
fi

echo "[backup-postgres] Creating dump ${OUT_FILE}"
docker exec "${PG_CONTAINER_NAME}" pg_dump -U "${PG_USER}" "${PG_DATABASE}" | gzip >"${OUT_FILE}"

echo "[backup-postgres] Done."
