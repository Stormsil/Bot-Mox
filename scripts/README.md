# Scripts

Актуальный набор скриптов репозитория сведен к maintenance, quality-check и deploy задачам.

## Stack lifecycle

### Dev profile (hot reload)

- `scripts/stack-dev-up.ps1` / `scripts/stack-dev-up.sh`
- `scripts/stack-dev-down.ps1` / `scripts/stack-dev-down.sh`

Запускают `deploy/compose.stack.yml` c `deploy/compose.dev.override.yml`.

### Prod-sim profile (production-like)

- `scripts/stack-prod-sim-up.ps1` / `scripts/stack-prod-sim-up.sh`
- `scripts/stack-prod-sim-down.ps1` / `scripts/stack-prod-sim-down.sh`

Скрипт `up` собирает локальные образы:

- `bot-mox/frontend:prod-sim`
- `bot-mox/backend:prod-sim`

и поднимает стек по `deploy/compose.stack.yml`.

## Supabase helpers

### `supabase-generate-keys.js`

Генерирует `SUPABASE_ANON_KEY` и `SUPABASE_SERVICE_ROLE_KEY` из `SUPABASE_JWT_SECRET` (HS256).

Запуск:

```bash
pnpm run supabase:generate-keys -- --jwt-secret "<32+ char secret>" --issuer "supabase"
```

### `supabase-create-user.js`

Создает первого пользователя Supabase Auth (email/password) через admin endpoint GoTrue.
Требует `SUPABASE_PUBLIC_URL` и `SUPABASE_SERVICE_ROLE_KEY`.

Запуск:

```bash
pnpm run supabase:create-user -- --email "admin@example.com" --password "ChangeMeNow!" --tenant "default"
```

## Deployment and rollback

- `scripts/deploy-vps.sh`
- `scripts/rollback-vps.sh`

`deploy-vps.sh` поддерживает:

- `--dry-run` (валидация compose-конфига без запуска)
- `--skip-pull`
- `--skip-healthcheck`
- `--wait-timeout <seconds>` (таймаут healthcheck, default `120`)

Оба скрипта (`deploy-vps.sh`, `rollback-vps.sh`) умеют резолвить `FRONTEND_IMAGE_REPO`/`BACKEND_IMAGE_REPO`
из `.env.prod` и fallback-ить к `FRONTEND_IMAGE`/`BACKEND_IMAGE`, поэтому ручная передача repo-переменных обычно не требуется.

## Backups

- `scripts/backup-postgres.sh`
- `scripts/backup-minio.sh`

По умолчанию создают архивы в `./backups/postgres` и `./backups/minio`.

## `check-bundle-budgets.js`

Проверяет размер frontend bundle относительно заданных бюджетов.

Запуск:

```bash
node scripts/check-bundle-budgets.js
```

## `check-secrets.js`

Проверяет tracked + untracked файлы (`git ls-files --cached --others --exclude-standard`) на признаки утечки секретов.
Gitignored файлы (например, локальные `.env`/secrets) в скане не участвуют.

Запуск:

```bash
node scripts/check-secrets.js
```

## `check-style-guardrails.js`

Проверяет style guardrails для фронтенда:

1. Нет глобальных `.ant-*` селекторов в shared стилях (`global.css`, `index.css`, `App.css`).
2. Количество `!important` не превышает зафиксированный baseline-порог.

Запуск:

```bash
node scripts/check-style-guardrails.js
```

## `generate-firebase-decommission-audit.js`

Генерирует живой аудит статуса полного удаления Firebase/RTDB из активного контура проекта.

Запуск:

```bash
pnpm run audit:firebase:decommission
```

## `artifacts-e2e-smoke.js`

Smoke-сценарий для цепочки `vm/register -> license/lease -> artifacts/resolve-download -> download + sha256`.
Также проверяет негативные кейсы:

- `VM_UUID_MISMATCH` (`403`)
- `MODULE_MISMATCH` (`403`)
- `LEASE_INACTIVE` после revoke (`409`)

Минимальные env:

```bash
RUNNER_BEARER_TOKEN=<token>
E2E_USER_ID=<user-id>
```

Где брать токены:
- `RUNNER_BEARER_TOKEN`: обычно это `INTERNAL_API_TOKEN` (роль `api`) или Supabase `access_token` (JWT) после login.
- `ADMIN_BEARER_TOKEN`: обычно это `INTERNAL_INFRA_TOKEN` (роли `admin+infra`) или Supabase `access_token` пользователя, который allowlisted как admin/infra.

Опциональные env:

- `ADMIN_BEARER_TOKEN` (нужен для `artifacts/assign` и `license/revoke` в smoke-сценарии)
- `API_BASE_URL` (default: `http://localhost:3001`)
- `E2E_VM_UUID` (default: random generated)
- `E2E_MODULE` (default: `runner-installer`)
- `E2E_PLATFORM` (default: `windows`)
- `E2E_CHANNEL` (default: `stable`)
- `E2E_AGENT_ID` / `E2E_RUNNER_ID`
- `E2E_RELEASE_ID` (если задан и есть `ADMIN_BEARER_TOKEN`, скрипт делает `POST /api/v1/artifacts/assign`)
- Legacy: `API_BEARER_TOKEN` (alias for `RUNNER_BEARER_TOKEN`)

Запуск:

```bash
pnpm run smoke:artifacts:e2e
```

## Runner Request Sequence and Retry Behavior

### Flow

```
1. POST /api/v1/vm/register        { vm_uuid, user_id, vm_name, status }
2. POST /api/v1/license/lease       { vm_uuid, user_id, agent_id, runner_id, module, version }
   -> { lease_id, token, expires_at }
3. POST /api/v1/artifacts/resolve-download  { lease_token, vm_uuid, module, platform, channel }
   -> { download_url, sha256, version, size_bytes, url_expires_at }
4. GET  <download_url>              (presigned, short-lived)
5. Verify SHA-256 of downloaded file
```

### Retry Rules

| Scenario | HTTP | Code | Runner Action |
|---|---|---|---|
| Lease expired (JWT exp) | 409 | `LEASE_EXPIRED` | Re-issue lease (step 2), then resolve again |
| Lease revoked | 409 | `LEASE_INACTIVE` | Re-issue lease (step 2), then resolve again |
| Presigned URL expired | 403/404 | S3 error | Call resolve-download again (step 3) for a new URL |
| VM not registered | 404 | `VM_NOT_REGISTERED` | Re-register VM (step 1) |
| Module not allowed | 403 | `MODULE_NOT_ALLOWED` | Cannot retry — entitlement required |
| License inactive | 403 | `LICENSE_INACTIVE` | Cannot retry — active subscription required |
| Network error | N/A | N/A | Exponential backoff, max 3 retries per step |

### Heartbeat

While lease is active, runner should call:

```
POST /api/v1/license/heartbeat  { lease_id }
```

Interval: every 30-60 seconds. If no heartbeat for > 2x interval, server may consider agent stale.

### Presigned URL Lifetime

- Configurable via `S3_PRESIGN_TTL_SECONDS` (default: 180s, range: 60-300s).
- If URL expires before download completes, call `resolve-download` again.
- Each resolve attempt is recorded in `artifact_download_audit`.

## Removed Legacy

Legacy Firebase maintenance/migration scripts удалены из активного `scripts/` набора.
