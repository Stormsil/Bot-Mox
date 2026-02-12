#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/compose.stack.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
PREVIOUS_TAG="${PREVIOUS_TAG:-}"
API_HEALTHCHECK_URL="${API_HEALTHCHECK_URL:-}"

if [[ -z "${PREVIOUS_TAG}" ]]; then
  echo "[rollback-vps] PREVIOUS_TAG is required"
  exit 1
fi

cd "${DEPLOY_PATH}"

: "${FRONTEND_IMAGE_REPO:?FRONTEND_IMAGE_REPO is required}"
: "${BACKEND_IMAGE_REPO:?BACKEND_IMAGE_REPO is required}"
export FRONTEND_IMAGE="${FRONTEND_IMAGE_REPO}:${PREVIOUS_TAG}"
export BACKEND_IMAGE="${BACKEND_IMAGE_REPO}:${PREVIOUS_TAG}"

compose_cmd=(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}")

echo "[rollback-vps] Pulling rollback images..."
"${compose_cmd[@]}" pull

echo "[rollback-vps] Applying rollback..."
"${compose_cmd[@]}" up -d --remove-orphans

if [[ -n "${API_HEALTHCHECK_URL}" ]]; then
  echo "[rollback-vps] Running health check: ${API_HEALTHCHECK_URL}"
  curl --fail --silent --show-error "${API_HEALTHCHECK_URL}" >/dev/null
fi

echo "[rollback-vps] Done."
