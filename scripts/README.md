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
- `scripts/stack-one-up.ps1` (single-command deterministic bring-up)
- `scripts/stack-one-up-strict.ps1` (strict deterministic wrapper)
- `scripts/stack-one-up-strict-full.ps1` (strict + admin lifecycle smoke wrapper)

NPM aliases:

- `pnpm run stack:up` -> canonical strict profile (recommended single command)
- `pnpm run stack:one:up` -> alias to `stack:up`
- `pnpm run stack:one:up:strict` -> alias to `stack:up`
- `pnpm run stack:one:up:strict:full` -> alias for strict profile (kept for backward compatibility)
- `pnpm run stack:one:up:relaxed` -> direct base script (`stack-one-up.ps1`)

Скрипт `up` собирает локальные образы:

- `botmox/frontend:prod-sim`
- `botmox/admin:prod-sim`
- `botmox/backend:prod-sim`

и поднимает стек по `deploy/compose.stack.yml`.

`stack-one-up.ps1` выполняет полный deterministic цикл:

1. `docker compose down --remove-orphans` (опционально `-v`).
2. Rebuild frontend/backend образов (опционально `--no-cache`).
3. Поднятие infra + миграции + app сервисов.
4. Health-check (`/api/v1/health`, `/live`, `/ready`).
5. `pnpm run doctor`.
6. Опционально `pnpm run smoke:auth-access:e2e`.

`stack-one-up-strict.ps1` включает строгий профиль и затем запускает `stack-one-up.ps1`:

- `BOTMOX_STACK_FULL_RESET=true`
- `BOTMOX_BUILD_NO_CACHE=true`
- `BOTMOX_RUN_AUTH_SMOKE=true`
- `BOTMOX_RUN_ADMIN_ORIGIN_SMOKE=true`
- `BOTMOX_RUN_ADMIN_RBAC_SMOKE=true`
- `BOTMOX_RUN_TENANT_ISOLATION_SMOKE=true`
- `BOTMOX_RUN_AGENTS_TENANT_ISOLATION_SMOKE=true`
- `BOTMOX_RUN_ADMIN_PROJECTS_SMOKE=true`
- `BOTMOX_RUN_BILLING_ADMIN_SMOKE=true`
- `BOTMOX_RUN_DATA_ENCRYPTION_SMOKE=true`
- `BOTMOX_RUN_SETTINGS_SURFACE_SMOKE=true`
- `BOTMOX_RUN_RUNTIME_METRICS_RECORD=true`

Запуск:

```bash
pnpm run stack:one:up:strict
```

Полезные флаги окружения для `stack:one:up`:

- `BOTMOX_STACK_FULL_RESET=true`  
  Добавляет `docker compose down -v` (очистка named volumes).
- `BOTMOX_BUILD_NO_CACHE=true`  
  Собирает frontend/backend образы с `--no-cache`.
- `BOTMOX_RUN_AUTH_SMOKE=true`  
  После doctor запускает auth/access smoke.
- `BOTMOX_RUN_ADMIN_ORIGIN_SMOKE=true`  
  После auth smoke запускает admin origin policy smoke (только доверенный origin может обращаться к admin endpoints).
  - разрешенный origin для smoke берется из `BOTMOX_ADMIN_ORIGIN_SMOKE_ALLOWED`, иначе автоматически из `ADMIN_DOMAIN` (`http://<ADMIN_DOMAIN>`), fallback: `http://admin.localhost`.
- `BOTMOX_RUN_ADMIN_RBAC_SMOKE=true`  
  После admin origin smoke запускает admin RBAC smoke (проверка, что non-admin не может вызвать admin endpoints).
- `BOTMOX_RUN_TENANT_ISOLATION_SMOKE=true`  
  После admin RBAC smoke запускает multi-domain tenant isolation smoke (bots/resources/workspace/finance).
- `BOTMOX_RUN_AGENTS_TENANT_ISOLATION_SMOKE=true`  
  После tenant isolation smoke запускает agents tenant isolation smoke (repair/heartbeat cross-tenant deny).
- `BOTMOX_RUN_ADMIN_PROJECTS_SMOKE=true`  
  После tenant isolation smoke запускает admin lifecycle smoke (catalog -> canary rollout -> wave -> tenant rollback).
- `BOTMOX_RUN_BILLING_ADMIN_SMOKE=true`  
  После admin lifecycle smoke запускает billing admin smoke (`/api/v1/billing/admin/mock-payment` flow).
- `BOTMOX_RUN_DATA_ENCRYPTION_SMOKE=true`  
  После billing admin smoke запускает data-encryption rotation smoke (dry-run для `workspace/finance/settings/resources/playbooks/bots/artifacts/theme/license/provisioning/infra/vmops`).
- `BOTMOX_RUN_SETTINGS_SURFACE_SMOKE=true`  
  После data encryption smoke запускает settings surface smoke (GET/PUT/PATCH critical `settings/*` endpoints).
- `BOTMOX_RUN_RUNTIME_METRICS_RECORD=true`  
  После smoke-проверок записывает runtime diagnostics snapshot (`pnpm run hardening:runtime:record:strict`) в monthly audit.
- `BOTMOX_BOOTSTRAP_ENSURE_ADMIN=true`  
  Включает bootstrap оператора через Supabase admin API (по умолчанию отключено).

После `pnpm run stack:up` strict-full wrapper печатает итоговый статус и сохраняет локальный отчёт:

- `docs/audits/stack-up-latest.txt`
- `docs/audits/stack-up-<timestamp>.txt`
- `docs/audits/post-start-diagnostics-latest.txt` (агрегированный summary: stack-up + runtime metrics + smoke/crypto evidence, если доступны)

В отчёте есть `STACK_STATUS`, health-check (`ui/api/admin`) и `docker compose ps` snapshot.

Optional strict-fail policy for `stack-one-up-strict-full.ps1` (disabled by default):

- `BOTMOX_STRICT_FULL_FAIL_ON_CORRELATION_MODES=<csv>`
  - Example: `startup_issue,mixed_fail`
  - Uses `startup_runtime_correlation_mode` from post-start summary.
- `BOTMOX_STRICT_FULL_FAIL_ON_POST_START_SEVERITIES=<csv>`
  - Example: `critical,high`
  - Uses `post_start_severity` from post-start summary.

Если policy включен и найден match, wrapper печатает:

- `STRICT_FAIL_POLICY_ENABLED=true`
- `STRICT_FAIL_POLICY_MATCH=true`
- `STRICT_FAIL_POLICY_MATCH_REASONS=...`

и завершает запуск с `exit code 1`.

## Supabase helpers

### `supabase-generate-keys.js`

Генерирует `SUPABASE_ANON_KEY` и `SUPABASE_SERVICE_ROLE_KEY` из `SUPABASE_JWT_SECRET` (HS256).

Запуск:

```bash
pnpm run supabase:generate-keys -- --jwt-secret "<32+ char secret>" --issuer "supabase"
```

### `supabase-create-user.js`

Идемпотентно создает или обновляет пользователя Supabase Auth (email/password) через admin endpoint GoTrue.
Если email уже существует, скрипт обновляет пароль и `app_metadata` (tenant/roles), а не падает.
Если `--tenant` не передан, скрипт сохраняет существующий `tenant_id` пользователя; для нового пользователя генерируется `t_<uuid>`.
Если `--roles` не передан, скрипт сохраняет существующие роли пользователя (или ставит `user` для нового).
Требует `SUPABASE_PUBLIC_URL` и `SUPABASE_SERVICE_ROLE_KEY`.

Опции:

- `--upsert true|false` (default: `true`)
- env fallback: `SUPABASE_CREATE_USER_UPSERT=true|false`

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
и `ADMIN_IMAGE_REPO` из `.env.prod` и fallback-ить к `FRONTEND_IMAGE`/`ADMIN_IMAGE`/`BACKEND_IMAGE`, поэтому ручная передача repo-переменных обычно не требуется.

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

## Lockfile and ingest hygiene

### `check-lockfiles.js`

Enforces pnpm-only lockfile policy:

1. `pnpm-lock.yaml` is the only allowed active lockfile.
2. Any `package-lock.json` outside `docs/history/**` fails the check.

Run:

```bash
pnpm run check:lockfiles
```

### `check-backend-tenant-defaults.js`

Guards backend multi-tenant hygiene by blocking runtime tenant fallback patterns:

1. `?? 'default'`
2. `|| 'default'`
3. `tenantId: 'default'`

Scope: `apps/backend/src/modules/**/*.ts` (tests excluded).  

Run:

```bash
pnpm run check:backend:tenant-defaults
```

### `check-db-rls-coverage.js`

Guards tenant RLS coverage for Prisma tenant-scoped tables:

1. Reads `apps/backend/prisma/schema.prisma` and collects models with `tenantId` field.
2. Verifies each mapped table has RLS policy coverage via:
   - explicit SQL (`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` + `CREATE POLICY ...`), or
   - inclusion in `20260221000300_enable_tenant_rls.sql` dynamic `tenant_tables` list.

Run:

```bash
pnpm run check:db:rls
```

### `check-data-encryption-coverage.js`

Guards data-at-rest encryption coverage across tenant-scoped domains:

1. Validates encryption markers in target backend service/repository files (`DataAtRestCrypto`, `__enc_payload_v1`, `encrypt*` patterns).
2. Validates encryption-related test signal exists for each domain.
3. Validates rotation endpoint coverage for each domain in:
   - `scripts/data-encryption-rotation-runner.js`
   - `apps/backend/src/modules/admin-data-encryption/admin-data-encryption.controller.ts`

Covered domains:

- `workspace`, `finance`, `settings`, `resources`, `playbooks`, `bots`
- `provisioning`, `infra`, `vmops`, `theme`, `license`, `artifacts`

Run:

```bash
pnpm run check:data-encryption:coverage
```

### `check-runtime-metrics-coverage.js`

Guards runtime metrics observability wiring for prod-like diagnostics:

1. Verifies core runtime metric counters exist (`auth.failures.401/403`, `http.failures.5xx`, `sse.*`, `ws.*`).
2. Verifies instrumentation wiring remains present in:
   - HTTP error envelope filter
   - agents WS server
   - vm-ops SSE controller path
   - app bootstrap filter wiring
   - admin diagnostics endpoint (`/api/v1/diag/runtime-metrics`)
3. Verifies test signal exists for observability/ws lifecycle coverage.

Run:

```bash
pnpm run check:runtime-metrics:coverage
```

### `post-start-diagnostics-summary.js`

Собирает единый post-start summary по последним audit/report файлам:

- `docs/audits/stack-up-latest.txt`
- `docs/audits/production-hardening-runtime-metrics-latest.md`
- latest monthly `production-hardening-smoke-window-YYYY-MM.md` (если есть)
- `docs/audits/crypto-rotation-latest.txt` (если есть)
- `docs/audits/tenant-isolation-smoke-latest.txt` (если есть, direct audit)
- `docs/audits/agents-tenant-isolation-smoke-latest.txt` (если есть, direct audit)
- `docs/audits/auth-access-smoke-latest.txt` (если есть, direct audit)
- `docs/audits/settings-surface-smoke-latest.txt` (если есть, direct audit)
- `docs/audits/admin-rbac-smoke-latest.txt` (если есть, direct audit)
- `docs/audits/admin-origin-smoke-latest.txt` (если есть, direct audit)
- `docs/audits/billing-admin-smoke-latest.txt` (если есть, direct audit)
- `docs/audits/data-encryption-smoke-latest.txt` (если есть, direct audit)

Источник для tenant-isolation smoke сигналов:

- приоритетно direct audit files (`tenant-isolation-smoke-latest.txt`, `agents-tenant-isolation-smoke-latest.txt`)
- fallback: inference из latest monthly `production-hardening-smoke-window-YYYY-MM.md`
- для `auth_access_smoke` и `settings_surface_smoke`: direct audit only (без fallback из smoke-window)
- для `admin_rbac_smoke` и `admin_origin_smoke`: direct audit only (без fallback из smoke-window)
- для `billing_admin_smoke` и `data_encryption_smoke`: direct audit only (без fallback из smoke-window)

Сохраняет:

- `docs/audits/post-start-diagnostics-latest.txt`
- `docs/audits/post-start-diagnostics-<timestamp>.txt`

Ключевые поля summary (для быстрого чтения/скриптов):

- `post_start_severity=critical|high|medium|ok`
- `post_start_summary_line=...` (компактный one-line итог для консоли/CI)
- `startup_runtime_correlation_mode=healthy|startup_issue|runtime_degradation|mixed_fail|startup_warning|runtime_warning|mixed_warn`
- `startup_runtime_correlation_startup_gate=pass|warn|fail`
- `startup_runtime_correlation_runtime_gate=pass|warn|fail`
- `startup_runtime_correlation_summary_line=...`
- `readiness_gate=pass|fail`
- `runtime_gate=pass|fail`
- `runtime_hotspot_gate=pass|warn|fail|unknown`
- `runtime_trend_gate=pass|warn|fail|unknown`
- `agent_flow_gate=pass|warn|unknown`
- `agent_flow_trend_gate=pass|warn|fail|unknown`
- `vmops_sse_flow_gate=pass|warn|unknown`
- `vmops_sse_flow_trend_gate=pass|warn|fail|unknown`
- `stack_trend_gate=pass|warn|fail|unknown`
- `smoke_trend_gate=pass|warn|fail|unknown`
- `tenant_isolation_smoke_gate=pass|fail|unknown`
- `agents_tenant_isolation_smoke_gate=pass|fail|unknown`
- `tenant_isolation_smoke_trend_gate=pass|warn|fail|unknown`
- `agents_tenant_isolation_smoke_trend_gate=pass|warn|fail|unknown`
- `auth_access_smoke_gate=pass|fail|unknown`
- `auth_access_smoke_trend_gate=pass|warn|fail|unknown`
- `settings_surface_smoke_gate=pass|fail|unknown`
- `settings_surface_smoke_trend_gate=pass|warn|fail|unknown`
- `admin_rbac_smoke_gate=pass|fail|unknown`
- `admin_rbac_smoke_trend_gate=pass|warn|fail|unknown`
- `admin_origin_smoke_gate=pass|fail|unknown`
- `admin_origin_smoke_trend_gate=pass|warn|fail|unknown`
- `billing_admin_smoke_gate=pass|fail|unknown`
- `billing_admin_smoke_trend_gate=pass|warn|fail|unknown`
- `data_encryption_smoke_gate=pass|fail|unknown`
- `data_encryption_smoke_trend_gate=pass|warn|fail|unknown`
- `diagnostics_reason_codes=...`
- `diagnostics_reason_levels=startup|runtime|audit|...`
- `startup_runtime_correlation_reason_codes=...`
- `startup_runtime_correlation_startup_fail_codes=...`
- `startup_runtime_correlation_runtime_fail_codes=...`
- `runtime_hotspot_flags=...`
- `runtime_hotspot_fail_flags=...`
- `runtime_trend_reason_codes=...`
- `runtime_trend_summary_line=...`
- `agent_flow_reason_codes=...`
- `agent_flow_summary_line=...`
- `agent_flow_trend_reason_codes=...`
- `agent_flow_trend_summary_line=...`
- `vmops_sse_flow_reason_codes=...`
- `vmops_sse_flow_summary_line=...`
- `vmops_sse_flow_trend_reason_codes=...`
- `vmops_sse_flow_trend_summary_line=...`
- `stack_trend_reason_codes=...`
- `stack_trend_summary_line=...`
- `smoke_trend_reason_codes=...`
- `smoke_trend_info_codes=...` (non-blocking signals, e.g. `not-run` rows in history)
- `smoke_trend_summary_line=...`
- `tenant_isolation_smoke_reason_codes=...`
- `agents_tenant_isolation_smoke_reason_codes=...`
- `tenant_isolation_smoke_summary_line=...`
- `tenant_isolation_smoke_trend_reason_codes=...`
- `agents_tenant_isolation_smoke_trend_reason_codes=...`
- `tenant_isolation_smoke_trend_summary_line=...`
- `agents_tenant_isolation_smoke_trend_summary_line=...`
- `auth_access_smoke_reason_codes=...`
- `auth_access_smoke_trend_reason_codes=...`
- `auth_access_smoke_trend_summary_line=...`
- `settings_surface_smoke_reason_codes=...`
- `settings_surface_smoke_trend_reason_codes=...`
- `settings_surface_smoke_trend_summary_line=...`
- `admin_rbac_smoke_reason_codes=...`
- `admin_rbac_smoke_trend_reason_codes=...`
- `admin_rbac_smoke_trend_summary_line=...`
- `admin_origin_smoke_reason_codes=...`
- `admin_origin_smoke_trend_reason_codes=...`
- `admin_origin_smoke_trend_summary_line=...`
- `billing_admin_smoke_reason_codes=...`
- `billing_admin_smoke_trend_reason_codes=...`
- `billing_admin_smoke_trend_summary_line=...`
- `data_encryption_smoke_reason_codes=...`
- `data_encryption_smoke_trend_reason_codes=...`
- `data_encryption_smoke_trend_summary_line=...`
- `source.tenant_isolation_smoke=...` (какой источник использован: direct audit / smoke window fallback)
- `source.agents_tenant_isolation_smoke=...`
- `source.auth_access_smoke=...`
- `source.settings_surface_smoke=...`
- `source.admin_rbac_smoke=...`
- `source.admin_origin_smoke=...`
- `source.billing_admin_smoke=...`
- `source.data_encryption_smoke=...`

Severity semantics:

- `critical`: stack/readiness не готов (`readiness_gate=fail`)
- `high`: runtime fail / runtime hotspot fail / runtime trend fail
- `medium`: runtime hotspot warn / runtime trend warn / stack|smoke trend warn / общий diagnostics degradation без readiness/runtime fail
- `medium`: также используется при `agent_flow_warn` / `vmops_sse_flow_warn` и их trend-`warn`
- `high`: дополнительно используется при `agent_flow_trend_fail` / `vmops_sse_flow_trend_fail`
- `high`: также при fail-сигнале tenant-isolation smoke (`tenant_isolation_smoke` / `agents_tenant_isolation_smoke`)
- `high`: также при fail-тренде tenant-isolation smoke (`*_tenant_isolation_smoke_trend`)
- `medium`: при warn-тренде tenant-isolation smoke (`*_tenant_isolation_smoke_trend`)
- `high`: также при fail snapshot/trend сигнале `auth_access_smoke` / `settings_surface_smoke`
- `medium`: при warn trend сигнале `auth_access_smoke` / `settings_surface_smoke`
- `high`: также при fail snapshot/trend сигнале `admin_rbac_smoke` / `admin_origin_smoke`
- `medium`: при warn trend сигнале `admin_rbac_smoke` / `admin_origin_smoke`
- `high`: также при fail snapshot/trend сигнале `billing_admin_smoke` / `data_encryption_smoke`
- `medium`: при warn trend сигнале `billing_admin_smoke` / `data_encryption_smoke`
- `ok`: все ключевые post-start сигналы в норме

Startup vs runtime correlation:

- `startup_runtime_correlation_*` helps quickly distinguish startup/perimeter smoke issues from post-start runtime degradation.
- `startup_gate` aggregates readiness + startup/smoke/perimeter signals.
- `runtime_gate` aggregates runtime metrics/hotspots/trends + agent/vmops flow signals.
- This is diagnostic classification only; it does not replace `post_start_severity`.

Runtime hotspot/trend tuning (env, optional):

- Hotspot warn thresholds (snapshot):
  - `POST_START_RUNTIME_HOTSPOT_WARN_HTTP_5XX` (default `1`)
  - `POST_START_RUNTIME_HOTSPOT_WARN_SSE_GAP` (default `1`)
  - `POST_START_RUNTIME_HOTSPOT_WARN_WS_GAP` (default `1`)
  - `POST_START_RUNTIME_HOTSPOT_WARN_WS_REJECTED` (default `1`)
- Hotspot fail thresholds (snapshot):
  - `POST_START_RUNTIME_HOTSPOT_FAIL_HTTP_5XX` (default `10`)
  - `POST_START_RUNTIME_HOTSPOT_FAIL_SSE_GAP` (default `50`)
  - `POST_START_RUNTIME_HOTSPOT_FAIL_WS_GAP` (default `50`)
  - `POST_START_RUNTIME_HOTSPOT_FAIL_WS_REJECTED` (default `20`)
- Trend window behavior (recent rows from `production-hardening-runtime-metrics-latest.md`):
- Trend window behavior (recent rows from `production-hardening-runtime-metrics-latest.md`):
  - `POST_START_RUNTIME_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_RUNTIME_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_RUNTIME_TREND_WARN_ROWS` (default `1`)
- Smoke trend (recent rows from latest monthly `production-hardening-smoke-window-YYYY-MM.md`):
  - `POST_START_SMOKE_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_SMOKE_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_SMOKE_TREND_WARN_ROWS` (default `1`)
- Stack trend (recent `docs/audits/stack-up-*.txt` reports, excluding `stack-up-latest.txt`):
  - `POST_START_STACK_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_STACK_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_STACK_TREND_WARN_ROWS` (default `1`)
- Agent flow trend (recent rows from runtime metrics audit):
  - `POST_START_AGENT_FLOW_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_AGENT_FLOW_TREND_FAIL_ROWS` (default `2`)  // rows with `agent_flow=warn`
  - `POST_START_AGENT_FLOW_TREND_WARN_ROWS` (default `1`)
- VMOps SSE flow trend (recent rows from runtime metrics audit):
  - `POST_START_VMOPS_SSE_FLOW_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_VMOPS_SSE_FLOW_TREND_FAIL_ROWS` (default `2`)  // rows with `vmops_sse_flow=warn`
  - `POST_START_VMOPS_SSE_FLOW_TREND_WARN_ROWS` (default `1`)
- Tenant isolation smoke trend (recent direct audit files `tenant-isolation-smoke-*.txt`):
  - `POST_START_TENANT_ISOLATION_SMOKE_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_TENANT_ISOLATION_SMOKE_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_TENANT_ISOLATION_SMOKE_TREND_WARN_ROWS` (default `1`)
- Agents tenant isolation smoke trend (recent direct audit files `agents-tenant-isolation-smoke-*.txt`):
  - `POST_START_AGENTS_TENANT_ISOLATION_SMOKE_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_AGENTS_TENANT_ISOLATION_SMOKE_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_AGENTS_TENANT_ISOLATION_SMOKE_TREND_WARN_ROWS` (default `1`)
- Auth access smoke trend (recent direct audit files `auth-access-smoke-*.txt`):
  - `POST_START_AUTH_ACCESS_SMOKE_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_AUTH_ACCESS_SMOKE_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_AUTH_ACCESS_SMOKE_TREND_WARN_ROWS` (default `1`)
- Settings surface smoke trend (recent direct audit files `settings-surface-smoke-*.txt`):
  - `POST_START_SETTINGS_SURFACE_SMOKE_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_SETTINGS_SURFACE_SMOKE_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_SETTINGS_SURFACE_SMOKE_TREND_WARN_ROWS` (default `1`)
- Admin RBAC smoke trend (recent direct audit files `admin-rbac-smoke-*.txt`):
  - `POST_START_ADMIN_RBAC_SMOKE_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_ADMIN_RBAC_SMOKE_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_ADMIN_RBAC_SMOKE_TREND_WARN_ROWS` (default `1`)
- Admin origin smoke trend (recent direct audit files `admin-origin-smoke-*.txt`):
  - `POST_START_ADMIN_ORIGIN_SMOKE_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_ADMIN_ORIGIN_SMOKE_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_ADMIN_ORIGIN_SMOKE_TREND_WARN_ROWS` (default `1`)
- Billing admin smoke trend (recent direct audit files `billing-admin-smoke-*.txt`):
  - `POST_START_BILLING_ADMIN_SMOKE_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_BILLING_ADMIN_SMOKE_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_BILLING_ADMIN_SMOKE_TREND_WARN_ROWS` (default `1`)
- Data encryption smoke trend (recent direct audit files `data-encryption-smoke-*.txt`):
  - `POST_START_DATA_ENCRYPTION_SMOKE_TREND_WINDOW_SIZE` (default `10`)
  - `POST_START_DATA_ENCRYPTION_SMOKE_TREND_FAIL_ROWS` (default `2`)
  - `POST_START_DATA_ENCRYPTION_SMOKE_TREND_WARN_ROWS` (default `1`)

Запуск:

```bash
pnpm run hardening:post-start:summary
```

### `check-admin-surface-isolation.js`

Guards admin surface isolation between `apps/frontend` and `apps/admin`:

1. Forbids direct admin API calls from `apps/frontend/src`:
   - `/api/v1/admin/*`
   - `/api/v1/auth/admin/*`
   - `/api/v1/billing/admin/*`
2. Forbids admin auth token storage keys in main frontend (`botmox.admin.auth.*`).

Run:

```bash
pnpm run check:admin:surface-isolation
```

### `generate-repo-map.js`

Builds a high-level repository tree for AI/dev onboarding.

Run:

```bash
pnpm run repo:map
```

### `generate-hotspots-report.js`

Builds a CSV with file line/byte hotspots and inferred ownership layer.

Run:

```bash
pnpm run repo:hotspots
```

### `generate-llm-ingest-profile.js`

Builds a reusable external LLM ingest exclude profile.

Run:

```bash
pnpm run repo:ingest:profile
```

## Production hardening rollout helpers

### `production-hardening-rollout-readiness.js`

Генерирует dated readiness snapshot по migration flags и (опционально) checks.
Всегда фиксирует базовые security-флаги среды (`AUTH_MODE`, `AGENT_TRANSPORT`, `SECRETS_VAULT_MODE`, `ADMIN_ORIGIN_*`, `ADMIN_CORS_ORIGIN`, `BILLING_STUB_SELF_ACTIVATE`).
При `--with-checks` дополнительно запускает admin smoke-пакет:

- `check:admin:surface-isolation`
- `smoke:admin-origin:e2e`
- `smoke:admin-rbac:e2e`
- `smoke:tenant-isolation:e2e`
- `smoke:agents-tenant-isolation:e2e`
- `smoke:admin-projects:e2e`
- `smoke:billing-admin:e2e`
- `hardening:data:record:strict` (dry-run)
- `hardening:secrets:record:strict` (dry-run)
- `hardening:runtime:record:strict`

если доступны admin credentials (`ADMIN_BEARER_TOKEN` или `BOTMOX_ADMIN_EMAIL` + `BOTMOX_ADMIN_PASSWORD`).

Run:

```bash
pnpm run hardening:rollout:readiness
pnpm run hardening:rollout:readiness:checks
```

### `production-hardening-smoke-window.js`

Добавляет запись в monthly smoke-window audit.
При `--with-checks` выполняет те же gate-check команды, включая:

- `check:admin:surface-isolation`
- `smoke:admin-origin:e2e`
- `smoke:admin-rbac:e2e`
- `smoke:tenant-isolation:e2e`
- `smoke:agents-tenant-isolation:e2e`
- `smoke:admin-projects:e2e`
- `smoke:billing-admin:e2e`
- `hardening:data:record:strict` (dry-run)
- `hardening:secrets:record:strict` (dry-run)
- `hardening:runtime:record:strict`

если доступны admin credentials (`ADMIN_BEARER_TOKEN` или `BOTMOX_ADMIN_EMAIL` + `BOTMOX_ADMIN_PASSWORD`).

Run:

```bash
pnpm run hardening:smoke:record
pnpm run hardening:smoke:record:checks
```

### `production-hardening-smoke-streak.js`

Показывает текущий подряд strict `pass` и остаток до целевого streak (default `7`).

Run:

```bash
pnpm run hardening:smoke:streak
pnpm run hardening:smoke:streak -- --target=7
```

### `production-hardening-load-smoke-window.js`

Ведет monthly audit лог для multi-tenant load smoke:

- файл: `docs/audits/production-hardening-load-smoke-YYYY-MM.md`
- сохраняет профиль флагов (`AUTH_MODE`, `AGENT_TRANSPORT`, `SECRETS_VAULT_MODE`)
- при `--run-load` запускает `smoke:load:multi-tenant` и пишет метрики (`p99`, `5xx`, `401`, `sse_fail`)

Run:

```bash
pnpm run hardening:load:record
pnpm run hardening:load:record:checks
```

### `production-hardening-runtime-metrics-window.js`

Ведет monthly audit лог runtime-метрик auth/http/ws/sse:

- файл: `docs/audits/production-hardening-runtime-metrics-YYYY-MM.md`
- источник: `GET /api/v1/diag/runtime-metrics` (admin token)
- counters: `auth.failures.401`, `auth.failures.403`, `http.failures.5xx`, `sse.opened/closed`, `ws.opened/closed/rejected`

Threshold enforcement:

- по умолчанию только запись snapshot (`pass`, thresholds not enforced)
- включение порогов: `RUNTIME_METRICS_ENFORCE_THRESHOLDS=true`
- настраиваемые лимиты:
  - `RUNTIME_METRICS_MAX_AUTH_401` (default `1000`)
  - `RUNTIME_METRICS_MAX_AUTH_403` (default `1000`)
  - `RUNTIME_METRICS_MAX_HTTP_5XX` (default `10`)
  - `RUNTIME_METRICS_MAX_WS_REJECTED` (default `20`)
  - `RUNTIME_METRICS_MAX_SSE_GAP` (default `50`)
  - `RUNTIME_METRICS_MAX_WS_GAP` (default `50`)

Run:

```bash
pnpm run hardening:runtime:record
pnpm run hardening:runtime:record:strict
```

## `check-secrets.js`

Проверяет tracked + untracked файлы (`git ls-files --cached --others --exclude-standard`) на признаки утечки секретов.
Gitignored файлы (например, локальные `.env`/secrets) в скане не участвуют.

Запуск:

```bash
node scripts/check-secrets.js
```

## `auth-access-e2e-smoke.js`

Smoke-сценарий auth/access lifecycle:

1. signup нового tenant (получает `trial`),
2. проверка, что write-доступ в trial работает,
3. admin revoke premium/trial (`/api/v1/admin/access/revoke-premium`),
4. проверка, что write-доступ блокируется (`PREMIUM_REQUIRED`),
5. (если `BILLING_STUB_SELF_ACTIVATE=false`) проверка, что self-activate запрещен,
6. admin mock payment (`/api/v1/billing/admin/mock-payment`) и возврат write-доступа.

Требуемые env:

- `BOTMOX_ADMIN_EMAIL`
- `BOTMOX_ADMIN_PASSWORD`

Опциональные env:

- `API_BASE_URL` (default: `http://localhost`)
- `BILLING_MODE` (должен быть `stub`)
- `BILLING_STUB_SELF_ACTIVATE` (default: `false`)

Запуск:

```bash
pnpm run smoke:auth-access:e2e
```

## `billing-admin-e2e-smoke.js`

Smoke-сценарий для admin billing stub-flow:

1. signup нового tenant,
2. admin revoke premium/trial и проверка `PREMIUM_REQUIRED` на write,
3. проверка, что non-admin не может вызвать `/api/v1/billing/admin/mock-payment`,
4. admin вызывает `/api/v1/billing/admin/mock-payment`,
5. проверка, что write-доступ снова открыт.

Требуемые env:

- `BOTMOX_ADMIN_EMAIL`
- `BOTMOX_ADMIN_PASSWORD`

Опциональные env:

- `API_BASE_URL` (default: `http://localhost`)
- `BILLING_MODE` (должен быть `stub`)

Запуск:

```bash
pnpm run smoke:billing-admin:e2e
```

## `admin-rbac-e2e-smoke.js`

Smoke-сценарий для проверки RBAC изоляции admin API:

1. signup обычного пользователя,
2. проверка, что user не может обращаться к admin endpoints:
   - `GET /api/v1/admin/projects/catalog/releases`
   - `GET /api/v1/admin/access/tenants`
   - `POST /api/v1/billing/admin/mock-payment`
   - `POST /api/v1/admin/projects/rollout`

Опциональные env:

- `API_BASE_URL` (default: `http://localhost`)

Важно:
- запускать на свежем strict-стеке (`pnpm run stack:one:up`), иначе возможны ложные `404 NOT_FOUND` от устаревшего backend-процесса.

Запуск:

```bash
pnpm run smoke:admin-rbac:e2e
```

## `tenant-isolation-e2e-smoke.js` and `agents-tenant-isolation-e2e-smoke.js`

Tenant isolation smoke-сценарии:

- `smoke:tenant-isolation:e2e`: проверяет изоляцию `bots/resources/workspace/finance/vm-ops`.
- `smoke:agents-tenant-isolation:e2e`: проверяет изоляцию `agents/repair` и `agents/heartbeat`.

Опциональные env:

- `API_BASE_URL` (default: `http://localhost`)
- `BOTMOX_ADMIN_EMAIL` + `BOTMOX_ADMIN_PASSWORD`:
  - при `AUTH_RATE_LIMITED` на публичном signup скрипты автоматически fallback-ятся на `auth/admin/create-user`.

## `admin-origin-policy-e2e-smoke.js`

Smoke-сценарий для проверки admin origin policy:

1. `GET /api/v1/admin/projects/catalog/releases` без `Origin/Referer` -> `403 ADMIN_ORIGIN_REQUIRED`.
2. Тот же endpoint с чужим `Origin` -> `403 ADMIN_ORIGIN_FORBIDDEN`.
3. Тот же endpoint с разрешенным `Origin` -> проходит origin gate и падает на auth (`401 INVALID_OR_MISSING_BEARER_TOKEN`).

Опциональные env:

- `API_BASE_URL` (default: `http://localhost`)
- `ADMIN_ORIGIN_ALLOWED_FOR_SMOKE` (default: `http://admin.localhost`)
- `ADMIN_ORIGIN_SMOKE_ALLOW_NON_STRICT` (default: `false`, если `true` допускает fallback `401` для legacy/non-strict окружений)

Запуск:

```bash
pnpm run smoke:admin-origin:e2e
```

## `check-style-guardrails.js`

Проверяет style guardrails для фронтенда:

1. Нет глобальных `.ant-*` селекторов в shared стилях (`global.css`, `index.css`, `App.css`).
2. Количество `!important` не превышает зафиксированный baseline-порог.

Запуск:

```bash
node scripts/check-style-guardrails.js
```

## `check-infra-gateway.cjs`

Проверяет Nest `infra-gateway` cutover для UI proxy:

1. HTTP reverse-proxy для `/proxmox-ui`, `/api2`, `/tinyfm-ui`, `/syncthing-ui`.
2. WebSocket upgrade proxy для `/proxmox-ui/*` и service-hint fallback (через `Referer`/`Origin`) для TinyFM.

Скрипт автоматически:
- билдит `@botmox/backend`,
- поднимает локальные mock upstream-сервисы,
- выполняет HTTP + WS smoke/parity проверки.

Запуск:

```bash
pnpm run check:infra:gateway
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
- `API_BASE_URL` (default: `http://localhost:3002`)
- `E2E_VM_UUID` (default: random generated)
- `E2E_MODULE` (default: `runner-installer`)
- `E2E_PLATFORM` (default: `windows`)
- `E2E_CHANNEL` (default: `stable`)
- `E2E_AGENT_ID` / `E2E_RUNNER_ID`
- `E2E_RELEASE_ID` (если задан и есть `ADMIN_BEARER_TOKEN`, скрипт делает `POST /api/v1/artifacts/assign`)
- Deprecated: `API_BEARER_TOKEN` (alias for `RUNNER_BEARER_TOKEN`)

Запуск:

```bash
pnpm run smoke:artifacts:e2e
```

## `secrets-rotation-runner.js`

Операционный скрипт серверной ротации секретов для всех tenant (через админ API).

Требуемые env:

- `SECRETS_ROTATE_KEY_ID` (идентификатор нового ключа/версии ключевого материала)
- `ADMIN_BEARER_TOKEN`  
  или пара `BOTMOX_ADMIN_EMAIL` + `BOTMOX_ADMIN_PASSWORD`

Опциональные env:

- `API_BASE_URL` (default: `http://localhost`)
- `SECRETS_ROTATE_TENANTS_LIMIT` (default: `1000`)
- `SECRETS_ROTATE_PER_TENANT_LIMIT` (default: `1000`)
- `SECRETS_ROTATE_DRY_RUN` (default: `false`, значения: `true/false`, `1/0`, `yes/no`)
- `SECRETS_ROTATE_REASON` (default: `scheduled_rotation`)
- `SECRETS_ROTATE_REPORT_PATH` (если задан, скрипт сохраняет JSON-отчет)
- `SECRETS_ROTATE_REQUIRE_DRY_RUN_PREFLIGHT` (default: `false`, перед боевым запуском делает dry-run и проверяет пороги)
- `SECRETS_ROTATE_MAX_FAILED_TENANTS` (default: `0`, порог для preflight)
- `SECRETS_ROTATE_MAX_FAILED_SECRETS` (default: `0`, порог для preflight)

Запуск:

```bash
SECRETS_ROTATE_KEY_ID=kms-2026q1 pnpm run secrets:rotate:run
```

Dry-run с отчетом:

```bash
SECRETS_ROTATE_KEY_ID=kms-2026q1 SECRETS_ROTATE_DRY_RUN=true SECRETS_ROTATE_REPORT_PATH=logs/secrets-rotation-dry-run.json pnpm run secrets:rotate:run
```

Боевой запуск с обязательным preflight:

```bash
SECRETS_ROTATE_KEY_ID=kms-2026q1 SECRETS_ROTATE_REQUIRE_DRY_RUN_PREFLIGHT=true SECRETS_ROTATE_MAX_FAILED_TENANTS=0 SECRETS_ROTATE_MAX_FAILED_SECRETS=0 pnpm run secrets:rotate:run
```

## `secrets-rotation-audit-window.js`

Пишет monthly audit entry по последнему JSON-отчету ротации:

- источник по умолчанию: `logs/secrets-rotation-report.json`
- назначение: `docs/audits/secrets-rotation-YYYY-MM.md`

Поддерживает:

- `SECRETS_ROTATE_REPORT_PATH` (путь к JSON-отчету)
- `--strict` (завершает с non-zero кодом, если статус записи `fail`)

Запуск:

```bash
SECRETS_ROTATE_REPORT_PATH=logs/secrets-rotation-report.json pnpm run hardening:secrets:record
pnpm run hardening:secrets:record:strict
```

## `secrets-rotation-safe-cycle.js`

Один безопасный orchestration-run для ротации:

1. запускает `secrets-rotation-runner.js`,
2. затем `secrets-rotation-audit-window.js`,
3. при live-запуске по умолчанию включает preflight dry-run и строгие пороги:
   - `SECRETS_ROTATE_REQUIRE_DRY_RUN_PREFLIGHT=true`
   - `SECRETS_ROTATE_MAX_FAILED_TENANTS=0`
   - `SECRETS_ROTATE_MAX_FAILED_SECRETS=0`

Также автоматически выставляет `SECRETS_ROTATE_REPORT_PATH`, если не задан:

- `logs/secrets-rotation-report-<timestamp>.json`

Команды:

```bash
SECRETS_ROTATE_KEY_ID=kms-2026q1 pnpm run secrets:rotate:safe
SECRETS_ROTATE_KEY_ID=kms-2026q1 pnpm run secrets:rotate:safe:strict
SECRETS_ROTATE_KEY_ID=kms-2026q1 pnpm run secrets:rotate:safe:dry-run
```

## `data-encryption-rotation-runner.js`

Операционный скрипт ротации ключа шифрования контента через admin API:

- `workspace` (`notes/calendar/kanban`)
- `finance` (`finance_operations.payload`)
- `settings` (`settings_items.payload`)
- `resources` (`resource_items.payload`)
- `playbooks` (`playbook_items.payload`)
- `bots` (`bot_entities.payload`)
- `provisioning` (`provisioning_profile_items.payload`, `provisioning_progress_items.payload`)

Требуемые env:

- `BOTMOX_DATA_ENCRYPTION_KEY` + `BOTMOX_DATA_ENCRYPTION_KEY_ID` должны быть выставлены на backend (новый активный ключ).
- `ADMIN_BEARER_TOKEN`  
  или пара `BOTMOX_ADMIN_EMAIL` + `BOTMOX_ADMIN_PASSWORD`

Опциональные env:

- `API_BASE_URL` (default: `http://localhost`)
- `DATA_ENCRYPTION_ROTATE_KEY_ID` (ожидаемый `key_id`; проверка соответствия активному ключу на сервере)
- `DATA_ENCRYPTION_ROTATE_TENANTS_LIMIT` (default: `1000`)
- `DATA_ENCRYPTION_ROTATE_PER_TENANT_LIMIT` (default: `500`)
- `DATA_ENCRYPTION_ROTATE_DRY_RUN` (default: `false`)
- `DATA_ENCRYPTION_ROTATE_REASON` (default: `scheduled_content_rotation`)
- `DATA_ENCRYPTION_ROTATE_SCOPE` (default: `all`, значения: `workspace|finance|settings|resources|playbooks|bots|artifacts|theme|license|provisioning|infra|vmops|all`)
- `DATA_ENCRYPTION_ROTATE_REPORT_PATH` (если задан, сохраняет JSON-отчет)

Запуск:

```bash
DATA_ENCRYPTION_ROTATE_KEY_ID=kms-2026q2 pnpm run data:rotate:run
```

Dry-run:

```bash
DATA_ENCRYPTION_ROTATE_KEY_ID=kms-2026q2 DATA_ENCRYPTION_ROTATE_DRY_RUN=true pnpm run data:rotate:run
```

## `data-encryption-rotation-safe-cycle.js`

Безопасный orchestration-run для ротации ключа шифрования контента:

1. при live-запуске сначала делает preflight dry-run,
2. затем выполняет live rotate,
3. валидирует пороги ошибок.

Пороговые env:

- `DATA_ENCRYPTION_ROTATE_MAX_FAILED_TENANTS` (default: `0`)
- `DATA_ENCRYPTION_ROTATE_MAX_FAILED_ROWS` (default: `0`)

Команды:

```bash
DATA_ENCRYPTION_ROTATE_KEY_ID=kms-2026q2 pnpm run data:rotate:safe
DATA_ENCRYPTION_ROTATE_KEY_ID=kms-2026q2 pnpm run data:rotate:safe:strict
DATA_ENCRYPTION_ROTATE_KEY_ID=kms-2026q2 pnpm run data:rotate:safe:dry-run
```

## `data-encryption-rotation-audit-window.js`

Пишет monthly audit entry по последнему JSON-отчету ротации:

- источник по умолчанию: `logs/data-encryption-rotation-report.json`
- назначение: `docs/audits/data-encryption-rotation-YYYY-MM.md`

Поддерживает:

- `DATA_ENCRYPTION_ROTATE_REPORT_PATH` (путь к JSON-отчету)
- `--strict` (завершает с non-zero кодом, если статус записи `fail`)

Запуск:

```bash
DATA_ENCRYPTION_ROTATE_REPORT_PATH=logs/data-encryption-rotation-report.json pnpm run hardening:data:record
pnpm run hardening:data:record:strict
```

## `crypto-rotation-safe-cycle.js`

Объединенный безопасный цикл для двух контуров ротации:

1. tenant secrets rotation (`secrets-rotation-safe-cycle.js`)
2. content/data encryption rotation (`data-encryption-rotation-safe-cycle.js`)

Назначение:

- одна команда для planned rotation window,
- единый итоговый summary-файл,
- меньше ручной путаницы при операциях.

Требует оба ключа:

- `SECRETS_ROTATE_KEY_ID`
- `DATA_ENCRYPTION_ROTATE_KEY_ID`

Поддерживает:

- `--strict`
- `--dry-run`

Сохраняет итог:

- `docs/audits/crypto-rotation-latest.txt`
- `docs/audits/crypto-rotation-<timestamp>.txt`

Примеры:

```bash
SECRETS_ROTATE_KEY_ID=kms-secrets-2026q1 DATA_ENCRYPTION_ROTATE_KEY_ID=kms-data-2026q2 pnpm run crypto:rotate:safe
SECRETS_ROTATE_KEY_ID=kms-secrets-2026q1 DATA_ENCRYPTION_ROTATE_KEY_ID=kms-data-2026q2 pnpm run crypto:rotate:safe:strict
SECRETS_ROTATE_KEY_ID=kms-secrets-2026q1 DATA_ENCRYPTION_ROTATE_KEY_ID=kms-data-2026q2 pnpm run crypto:rotate:safe:dry-run
```

## `crypto-rotation-audit-window.js`

Пишет unified monthly audit entry по двум JSON-отчетам ротации:

- `logs/secrets-rotation-report.json`
- `logs/data-encryption-rotation-report.json`

Назначение:

- единая запись операционного окна ротации для secrets + content encryption,
- удобнее вести evidence для чувствительных данных (включая заметки/workspace content).

Поддерживает:

- `SECRETS_ROTATE_REPORT_PATH`
- `DATA_ENCRYPTION_ROTATE_REPORT_PATH`
- `--strict` (non-zero код, если в любом контуре есть failures)

Сохраняет:

- `docs/audits/crypto-rotation-YYYY-MM.md`

Примеры:

```bash
pnpm run hardening:crypto:record
pnpm run hardening:crypto:record:strict
SECRETS_ROTATE_REPORT_PATH=logs/secrets-rotation-report-2026-02-22.json DATA_ENCRYPTION_ROTATE_REPORT_PATH=logs/data-encryption-rotation-report-2026-02-22.json pnpm run hardening:crypto:record
```

## `crypto-rotation-window.js`

Операционный wrapper для полного окна ротации:

1. `crypto-rotation-safe-cycle.js` (выполняет оба safe-cycle)
2. `crypto-rotation-audit-window.js` (пишет unified monthly audit entry)

Назначение:

- одна команда для planned rotation window без ручного запуска нескольких шагов,
- удобнее для runbook и повторяемости в будущем.

Поддерживает:

- `--strict`
- `--dry-run`

Примеры:

```bash
SECRETS_ROTATE_KEY_ID=kms-secrets-2026q1 DATA_ENCRYPTION_ROTATE_KEY_ID=kms-data-2026q2 pnpm run crypto:rotate:window
SECRETS_ROTATE_KEY_ID=kms-secrets-2026q1 DATA_ENCRYPTION_ROTATE_KEY_ID=kms-data-2026q2 pnpm run crypto:rotate:window:strict
SECRETS_ROTATE_KEY_ID=kms-secrets-2026q1 DATA_ENCRYPTION_ROTATE_KEY_ID=kms-data-2026q2 pnpm run crypto:rotate:window:dry-run
```

## `multi-tenant-load-smoke.js`

Нагрузочный smoke для multi-tenant режима с агрегированными p95/p99, статус-кодами и SSE стабильностью.

Скрипт может работать в двух режимах:

1. Готовые токены:
- `LOAD_USER_TOKENS=token1,token2,...`

2. Автогенерация пользователей через админку:
- `BOTMOX_ADMIN_EMAIL`
- `BOTMOX_ADMIN_PASSWORD`

Основные env:

- `API_BASE_URL` (default: `http://localhost`)
- `LOAD_USERS` (default: `20`)
- `LOAD_ITERATIONS` (default: `25`)
- `LOAD_MAX_5XX_RATE` (default: `0.03`)
- `LOAD_MAX_401_RATE` (default: `0.02`)
- `LOAD_MAX_SSE_FAIL_RATE` (default: `0.05`)
- `LOAD_MAX_P99_MS` (default: `2500`)

Запуск:

```bash
BOTMOX_ADMIN_EMAIL=admin@localhost BOTMOX_ADMIN_PASSWORD=BotmoxLocal234 pnpm run smoke:load:multi-tenant
```

## `admin-projects-rollout-e2e-smoke.js`

Smoke-сценарий admin lifecycle для релизов и rollout:

1. Создает 2 тестовых tenant (через signup).
2. Создает `base` и `next` release в `admin/projects/catalog/releases`.
3. Делает baseline wave rollout на оба tenant.
4. Делает canary rollout (`scope=tenant`) только на tenant A.
5. Проверяет, что tenant A на `next`, tenant B остается на `base`.
6. Делает wave rollout `next` на оба tenant.
7. Делает tenant rollback для A и проверяет возврат на `base`.

Требуемые env:

- `BOTMOX_ADMIN_EMAIL`
- `BOTMOX_ADMIN_PASSWORD`

Опциональные env:

- `API_BASE_URL` (default: `http://localhost`)
- `PROJECT_KEY` (default: `botmox-core`)

Запуск:

```bash
BOTMOX_ADMIN_EMAIL=admin@localhost BOTMOX_ADMIN_PASSWORD=BotmoxLocal234 pnpm run smoke:admin-projects:e2e
```

## `data-encryption-rotation-e2e-smoke.js`

Smoke-сценарий для admin data-encryption lifecycle:

1. Создает тестовый tenant.
2. Создает tenant-scoped fixture-данные в:
   - `workspace/notes`
   - `finance/operations`
   - `settings/proxy`
   - `resources/proxies`
   - `playbooks`
   - `bots`
   - `artifacts/releases` + `artifacts/assign`
   - `theme-assets/presign-upload` + `theme-assets/complete`
   - `license/lease`
   - `unattend-profiles`
   - `infra/ssh/vm-config/:vmid`
   - `vm-ops/commands`
3. Выполняет dry-run ротацию для каждого scope:
   - `workspace`, `finance`, `settings`, `resources`, `playbooks`, `bots`, `artifacts`, `theme`, `license`, `provisioning`, `infra`, `vmops`
   - `rotate-<scope>-tenant`
   - `rotate-<scope>-tenants`
4. Проверяет success envelope и ожидаемые счетчики.

Требуемые env:

- `BOTMOX_ADMIN_EMAIL`
- `BOTMOX_ADMIN_PASSWORD`

Опциональные env:

- `API_BASE_URL` (default: `http://localhost`)
- `ADMIN_ORIGIN_ALLOWED_FOR_SMOKE` (default: `http://admin.localhost`)

Запуск:

```bash
BOTMOX_ADMIN_EMAIL=admin@localhost BOTMOX_ADMIN_PASSWORD=BotmoxLocal234 pnpm run smoke:data-encryption:e2e
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

## Removed Deprecated

Deprecated maintenance/migration scripts are removed from the active `scripts/` set.
