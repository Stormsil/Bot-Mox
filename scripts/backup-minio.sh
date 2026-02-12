#!/usr/bin/env bash
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-./backups/minio}"
MINIO_VOLUME_NAME="${MINIO_VOLUME_NAME:-botmox-stack_minio-data}"
TS="$(date +%Y%m%d-%H%M%S)"
OUT_FILE="${BACKUP_DIR}/minio-${TS}.tar.gz"

mkdir -p "${BACKUP_DIR}"

if ! docker volume inspect "${MINIO_VOLUME_NAME}" >/dev/null 2>&1; then
  echo "[backup-minio] Volume '${MINIO_VOLUME_NAME}' does not exist. Skip."
  exit 0
fi

echo "[backup-minio] Creating archive ${OUT_FILE}"
docker run --rm \
  -v "${MINIO_VOLUME_NAME}:/data:ro" \
  -v "$(cd "${BACKUP_DIR}" && pwd):/backup" \
  alpine:3.22 \
  sh -c "tar -C /data -czf /backup/$(basename "${OUT_FILE}") ."

echo "[backup-minio] Done."
