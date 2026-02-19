#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/deploy/compose.prod-sim.env.example"

cd "${REPO_ROOT}"
docker build -f apps/frontend/Dockerfile -t botmox/frontend:prod-sim .
docker build -f apps/backend/Dockerfile -t botmox/backend:prod-sim .

docker compose \
  -f deploy/compose.stack.yml \
  --env-file "${ENV_FILE}" \
  up -d --remove-orphans
