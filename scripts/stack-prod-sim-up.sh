#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${REPO_ROOT}/deploy/compose.prod-sim.env.example"

cd "${REPO_ROOT}"
docker build -t bot-mox/frontend:prod-sim ./bot-mox
docker build -t bot-mox/backend:prod-sim ./proxy-server

docker compose \
  -f deploy/compose.stack.yml \
  --env-file "${ENV_FILE}" \
  up -d --remove-orphans
