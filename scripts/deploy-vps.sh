#!/usr/bin/env bash
set -euo pipefail

DRY_RUN=false
SKIP_PULL=false
SKIP_HEALTHCHECK=false
WAIT_TIMEOUT_SECONDS="${WAIT_TIMEOUT_SECONDS:-120}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --skip-pull)
      SKIP_PULL=true
      shift
      ;;
    --skip-healthcheck)
      SKIP_HEALTHCHECK=true
      shift
      ;;
    --wait-timeout)
      WAIT_TIMEOUT_SECONDS="${2:-}"
      shift 2
      ;;
    --wait-timeout=*)
      WAIT_TIMEOUT_SECONDS="${1#*=}"
      shift
      ;;
    *)
      echo "[deploy-vps] Unknown argument: $1"
      exit 1
      ;;
  esac
done

DEPLOY_PATH="${DEPLOY_PATH:-$(pwd)}"
COMPOSE_FILE="${COMPOSE_FILE:-deploy/compose.stack.yml}"
ENV_FILE="${ENV_FILE:-.env.prod}"
IMAGE_TAG="${IMAGE_TAG:-}"
API_HEALTHCHECK_URL="${API_HEALTHCHECK_URL:-}"

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
      echo "[deploy-vps] Healthcheck passed on attempt ${attempt}"
      return 0
    fi
    sleep 3
  done

  echo "[deploy-vps] Healthcheck timed out after ${timeout_seconds}s: ${url}"
  return 1
}

cd "${DEPLOY_PATH}"

if [[ ! -f "${COMPOSE_FILE}" ]]; then
  echo "[deploy-vps] Compose file not found: ${COMPOSE_FILE}"
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "[deploy-vps] Env file not found: ${ENV_FILE}"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "[deploy-vps] docker is required but was not found"
  exit 1
fi

FRONTEND_IMAGE_REPO="${FRONTEND_IMAGE_REPO:-$(read_env_value FRONTEND_IMAGE_REPO)}"
BACKEND_IMAGE_REPO="${BACKEND_IMAGE_REPO:-$(read_env_value BACKEND_IMAGE_REPO)}"

if [[ -n "${IMAGE_TAG}" ]]; then
  if [[ -z "${FRONTEND_IMAGE_REPO}" ]]; then
    FRONTEND_IMAGE_REPO="$(derive_repo_from_image "${FRONTEND_IMAGE:-$(read_env_value FRONTEND_IMAGE)}")"
  fi
  if [[ -z "${BACKEND_IMAGE_REPO}" ]]; then
    BACKEND_IMAGE_REPO="$(derive_repo_from_image "${BACKEND_IMAGE:-$(read_env_value BACKEND_IMAGE)}")"
  fi

  : "${FRONTEND_IMAGE_REPO:?FRONTEND_IMAGE_REPO (or FRONTEND_IMAGE in env file) is required when IMAGE_TAG is set}"
  : "${BACKEND_IMAGE_REPO:?BACKEND_IMAGE_REPO (or BACKEND_IMAGE in env file) is required when IMAGE_TAG is set}"

  export FRONTEND_IMAGE="${FRONTEND_IMAGE_REPO}:${IMAGE_TAG}"
  export BACKEND_IMAGE="${BACKEND_IMAGE_REPO}:${IMAGE_TAG}"
  echo "[deploy-vps] Using image tag ${IMAGE_TAG}"
  echo "[deploy-vps] FRONTEND_IMAGE=${FRONTEND_IMAGE}"
  echo "[deploy-vps] BACKEND_IMAGE=${BACKEND_IMAGE}"
fi

compose_cmd=(docker compose -f "${COMPOSE_FILE}" --env-file "${ENV_FILE}")

echo "[deploy-vps] Preflight: validating docker compose config..."
"${compose_cmd[@]}" config >/dev/null

if [[ "${DRY_RUN}" == "true" ]]; then
  echo "[deploy-vps] DRY RUN"
  echo "[deploy-vps] Compose config is valid."
  exit 0
fi

if [[ "${SKIP_PULL}" == "true" ]]; then
  echo "[deploy-vps] Skipping image pull (--skip-pull)"
else
  echo "[deploy-vps] Pulling images..."
  "${compose_cmd[@]}" pull
fi

echo "[deploy-vps] Starting stack..."
"${compose_cmd[@]}" up -d --remove-orphans

if [[ "${SKIP_HEALTHCHECK}" == "true" ]]; then
  echo "[deploy-vps] Skipping healthcheck (--skip-healthcheck)"
elif [[ -n "${API_HEALTHCHECK_URL}" ]]; then
  echo "[deploy-vps] Running health check: ${API_HEALTHCHECK_URL}"
  run_healthcheck "${API_HEALTHCHECK_URL}" "${WAIT_TIMEOUT_SECONDS}"
fi

echo "[deploy-vps] Done."
