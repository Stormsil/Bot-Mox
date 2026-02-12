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
npm run supabase:generate-keys -- --jwt-secret "<32+ char secret>" --issuer "supabase"
```

### `supabase-create-user.js`

Создает первого пользователя Supabase Auth (email/password) через admin endpoint GoTrue.
Требует `SUPABASE_PUBLIC_URL` и `SUPABASE_SERVICE_ROLE_KEY`.

Запуск:

```bash
npm run supabase:create-user -- --email "admin@example.com" --password "ChangeMeNow!" --tenant "default"
```

## Deployment and rollback

- `scripts/deploy-vps.sh`
- `scripts/rollback-vps.sh`

`deploy-vps.sh` поддерживает `--dry-run` (валидация compose-конфига без запуска).

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

## `cleanup-database.js`

Ручной maintenance-скрипт для Firebase RTDB (очистка/нормализация данных).
Используется точечно и требует валидной конфигурации доступа к базе.

Запуск:

```bash
node scripts/cleanup-database.js
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
npm run smoke:artifacts:e2e
```

## Removed Legacy

Одноразовые миграции, legacy Firebase upload-утилиты и локальные backup/node_modules из `scripts/` удалены в рамках зачистки репозитория.
