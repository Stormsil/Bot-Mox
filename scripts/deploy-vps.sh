#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
  DRY_RUN=true
fi

DEPLOY_PATH="${DEPLOY_PATH:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/compose.stack.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
IMAGE_TAG="${IMAGE_TAG:-}"
API_HEALTHCHECK_URL="${API_HEALTHCHECK_URL:-}"

cd "${DEPLOY_PATH}"

if [[ -n "${IMAGE_TAG}" ]]; then
  : "${FRONTEND_IMAGE_REPO:?FRONTEND_IMAGE_REPO is required when IMAGE_TAG is set}"
  : "${BACKEND_IMAGE_REPO:?BACKEND_IMAGE_REPO is required when IMAGE_TAG is set}"
  export FRONTEND_IMAGE="${FRONTEND_IMAGE_REPO}:${IMAGE_TAG}"
  export BACKEND_IMAGE="${BACKEND_IMAGE_REPO}:${IMAGE_TAG}"
fi

compose_cmd=(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}")

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[deploy-vps] DRY RUN"
  "${compose_cmd[@]}" config
  exit 0
fi

echo "[deploy-vps] Pulling images..."
"${compose_cmd[@]}" pull

echo "[deploy-vps] Starting stack..."
"${compose_cmd[@]}" up -d --remove-orphans

if [[ -n "${API_HEALTHCHECK_URL}" ]]; then
  echo "[deploy-vps] Running health check: ${API_HEALTHCHECK_URL}"
  curl --fail --silent --show-error "${API_HEALTHCHECK_URL}" >/dev/null
fi

echo "[deploy-vps] Done."
