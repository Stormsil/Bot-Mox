#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/deploy/compose.prod-sim.env.example"

cd "${REPO_ROOT}"
docker compose \
  -f deploy/compose.stack.yml \
  -f deploy/compose.dev.override.yml \
  --env-file "${ENV_FILE}" \
  down --remove-orphans
