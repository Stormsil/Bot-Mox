#!/usr/bin/env bash
set -euo pipefail

DEPLOY_PATH="${DEPLOY_PATH:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/compose.stack.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
PREVIOUS_TAG="${PREVIOUS_TAG:-}"
API_HEALTHCHECK_URL="${API_HEALTHCHECK_URL:-}"
WAIT_TIMEOUT_SECONDS="${WAIT_TIMEOUT_SECONDS:-120}"

read_env_value() {
  local key="$1"
  local line=''
  local value=''

  if [[ ! -f "${ENV_FILE}" ]]; then
    return 0
  fi

  line="$(grep -E "^${key}=" "${ENV_FILE}" | tail -n 1 || true)"
  if [[ -z "${line}" ]]; then
    return 0
  fi

  value="${line#*=}"
  value="${value%$'\r'}"

  if [[ "${value}" == \"*\" && "${value}" == *\" ]]; then
    value="${value:1:${#value}-2}"
  elif [[ "${value}" == \'*\' && "${value}" == *\' ]]; then
    value="${value:1:${#value}-2}"
  fi

  printf '%s' "${value}"
}

derive_repo_from_image() {
  local image="$1"
  if [[ -z "${image}" ]]; then
    return 0
  fi

  if [[ "${image}" == *:* ]]; then
    printf '%s' "${image%:*}"
    return 0
  fi

  printf '%s' "${image}"
}

run_healthcheck() {
  local url="$1"
  local timeout_seconds="$2"
  local deadline=$((SECONDS + timeout_seconds))
  local attempt=0

  while (( SECONDS < deadline )); do
    attempt=$((attempt + 1))
    if curl --fail --silent --show-error "${url}" >/dev/null; then
      echo "[rollback-vps] Healthcheck passed on attempt ${attempt}"
      return 0
    fi
    sleep 3
  done

  echo "[rollback-vps] Healthcheck timed out after ${timeout_seconds}s: ${url}"
  return 1
}

if [[ -z "${PREVIOUS_TAG}" ]]; then
  echo "[rollback-vps] PREVIOUS_TAG is required"
  exit 1
fi

cd "${DEPLOY_PATH}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "[rollback-vps] Compose file not found: ${COMPOSE_FILE}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[rollback-vps] Env file not found: ${ENV_FILE}"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[rollback-vps] docker is required but was not found"
  exit 1
fi

FRONTEND_IMAGE_REPO="${FRONTEND_IMAGE_REPO:-$(read_env_value FRONTEND_IMAGE_REPO)}"
BACKEND_IMAGE_REPO="${BACKEND_IMAGE_REPO:-$(read_env_value BACKEND_IMAGE_REPO)}"

if [[ -z "${FRONTEND_IMAGE_REPO}" ]]; then
  FRONTEND_IMAGE_REPO="$(derive_repo_from_image "${FRONTEND_IMAGE:-$(read_env_value FRONTEND_IMAGE)}")"
fi
if [[ -z "${BACKEND_IMAGE_REPO}" ]]; then
  BACKEND_IMAGE_REPO="$(derive_repo_from_image "${BACKEND_IMAGE:-$(read_env_value BACKEND_IMAGE)}")"
fi

: "${FRONTEND_IMAGE_REPO:?FRONTEND_IMAGE_REPO (or FRONTEND_IMAGE in env file) is required}"
: "${BACKEND_IMAGE_REPO:?BACKEND_IMAGE_REPO (or BACKEND_IMAGE in env file) is required}"

export FRONTEND_IMAGE="${FRONTEND_IMAGE_REPO}:${PREVIOUS_TAG}"
export BACKEND_IMAGE="${BACKEND_IMAGE_REPO}:${PREVIOUS_TAG}"
echo "[rollback-vps] Using rollback tag ${PREVIOUS_TAG}"
echo "[rollback-vps] FRONTEND_IMAGE=${FRONTEND_IMAGE}"
echo "[rollback-vps] BACKEND_IMAGE=${BACKEND_IMAGE}"

compose_cmd=(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}")

echo "[rollback-vps] Preflight: validating docker compose config..."
"${compose_cmd[@]}" config >/dev/null

echo "[rollback-vps] Pulling rollback images..."
"${compose_cmd[@]}" pull

echo "[rollback-vps] Applying rollback..."
"${compose_cmd[@]}" up -d --remove-orphans

if [[ -n "${API_HEALTHCHECK_URL}" ]]; then
  echo "[rollback-vps] Running health check: ${API_HEALTHCHECK_URL}"
  run_healthcheck "${API_HEALTHCHECK_URL}" "${WAIT_TIMEOUT_SECONDS}"
fi

echo "[rollback-vps] Done."
