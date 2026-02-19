# Bot-Mox Architecture (Current State)

This document describes the implemented architecture in the repository (not only target plans).

Last review date: **2026-02-15**.

## 1. Development Stage Snapshot

Based on `docs/plans/green-implementation-roadmap.md` and code state:

1. **Phase A (platform/runtime foundation)**: `GREEN`
   - production-like stack, Dockerfiles, CI/CD workflows, health/live/ready endpoints.
2. **Phase B (artifacts + lease-gated delivery)**: `GREEN`
   - MinIO/S3 adapter, artifacts API, end-to-end smoke flow.
3. **Phase C (agents + vm-ops + secrets)**: `GREEN`
   - pairing/register/heartbeat/revoke APIs, command bus, ciphertext-only secret vault, frontend migration to `secret_ref`.
4. **Phase D (Supabase expansion/cutover)**: `GREEN`
   - controlled cutover executed in runtime configuration (`DATA_BACKEND=supabase` by default),
   - Firebase/RTDB decommission completed for active runtime and tooling, with live audit tracking.

Practical meaning:

1. The runtime is **Supabase-first** across business and operational domains.
2. Firebase is no longer required for normal backend runtime.
3. Legacy Firebase artifacts are removed from active code/docs and archived under `docs/history/*`.

## 2. Runtime Topology

Core runtime components:

1. **Frontend control plane**: `bot-mox/` (`React + TypeScript + Vite + Refine + Ant Design`).
2. **Backend API**: `proxy-server/` (`Express`, canonical API namespace `/api/v1/*`).
3. **Desktop agent**: `agent/` (`Electron + TypeScript`, Windows tray app for VM execution).
4. **Production-like edge stack**: `deploy/compose.stack.yml` (`caddy + frontend + backend + supabase + minio`).

Entry points:

1. Backend start path: `proxy-server/server.js` -> `proxy-server/src/index.js` -> `proxy-server/src/legacy-app.js`.
2. Frontend entry: `bot-mox/src/main.tsx` + `bot-mox/src/App.tsx`.
3. Agent entry: `agent/src/main/index.ts`.

## 3. Backend Architecture

Main wiring:

1. Router composition: `proxy-server/src/modules/v1/index.js`.
2. Auth + tenant context: `proxy-server/src/middleware/auth.js`.
3. Health checks: `proxy-server/src/modules/v1/health.js`.
4. Supabase repository composition: `proxy-server/src/repositories/repository-factory.js`.

### 3.1 API Domains

Main domain routes under `/api/v1`:

1. `auth`, `resources`, `workspace`, `settings`, `bots`, `finance`.
2. `vm` (VM UUID registry), `license` (lease issuance/heartbeat/revoke).
3. `artifacts` (release/assignment/resolve-download).
4. `agents` (pairing/register/heartbeat/revoke/list).
5. `secrets` (ciphertext-only vault + bindings).
6. `vm-ops` (agent command dispatch/status lifecycle).
7. `unattend-profiles` + `provisioning` (per-VM ISO generation, provisioning tokens, setup progress).
8. `infra` remains legacy and is role-gated to `infra` only.

### 3.2 Data Layer

1. Runtime repositories are Supabase-only for:
   - `resources`, `workspace`, `bots`, `finance`, `settings`.
2. Supabase-native operational domains:
   - `artifact_*`, `agents`, `agent_commands`, `secrets_ciphertext`, `secret_bindings`,
   - `vm_registry`, `execution_leases`, `tenant_licenses`, `tenant_entitlements`.
3. Decommission status is validated continuously via `docs/audits/firebase-decommission-audit.md`.

## 4. Agent and VM Operations Flow

Agent runtime loop (`agent/src/core/agent-loop.ts`):

0. Bootstrap pairing: one-time `pairing_code` exchange on `POST /api/v1/agents/register` returns scoped `agent_token`.
   - `POST /api/v1/agents/pairings` additionally returns `pairing_bundle` / `pairing_uri` / `pairing_url` helpers
     so agent onboarding can be done with a single paste (no manual URL typing in normal flow).
   - Pairing bundle may include `proxmox_defaults` (URL/username/node hints, no password) for agent autofill.
1. Send heartbeat every 30s (`POST /api/v1/agents/heartbeat`).
2. Long-poll next queued command (`GET /api/v1/vm-ops/commands/next?agent_id=...&timeout_ms=...`).
3. Mark command `running` -> execute -> mark `succeeded|failed`.
4. Stop on revoke (`AGENT_REVOKED` / `403`).

Execution model:

1. Customer VM operations are dispatched via `/api/v1/vm-ops/*`.
2. Backend enforces fail-fast if agent is offline (`AGENT_OFFLINE`, `409`).
3. Dispatch is allowed only for the same `owner_user_id` user (or `admin/infra`).
4. Agent executors call local Proxmox API from customer network.
5. SSH-only actions (`proxmox.ssh-status`, `proxmox.ssh-read-config`, `proxmox.ssh-write-config`, `proxmox.ssh-exec`) run through agent-local SSH transport and return explicit SSH error codes (`SSH_REQUIRED`, `SSH_AUTH_FAILED`, `SSH_UNREACHABLE`) when unavailable.

## 5. Security Model

Core controls:

1. Bearer token auth for `/api/v1/*`.
2. Supported token sources: internal tokens + Supabase Auth JWT + scoped agent tokens.
3. Tenant scoping (`tenant_id`) attached to auth context and propagated in service/repository queries.
4. Role gates:
   - `infra` role required for legacy infra routes.
   - admin/infra requirements on agent pairing/revoke and generic command dispatch.
5. Secrets policy:
   - backend stores ciphertext + metadata only; plaintext is never returned by API.

Infra hardening:

1. CORS/helmet/rate-limit middleware in HTTP bootstrap.
2. Readiness probes for Supabase and S3 dependencies.
3. Audit logging for infra mutating endpoints.

## 6. Artifacts Delivery Flow

Lease-gated flow:

1. VM register (`/api/v1/vm/register`) and license lease (`/api/v1/license/lease`).
   - VM Generator registers infrastructure resources only (`vm_registry`), and does not create/update bot entities in `/api/v1/bots`.
2. Resolve download (`/api/v1/artifacts/resolve-download`) validates lease token, VM UUID, module scope.
3. Backend issues short-lived presigned URL from S3/MinIO adapter.
4. Every resolve attempt is written into `artifact_download_audit`.

Primary implementation:

1. Service: `proxy-server/src/modules/artifacts/service.js`.
2. Storage provider: `proxy-server/src/repositories/s3/storage-provider.js`.
3. E2E smoke: `scripts/artifacts-e2e-smoke.js`.

## 7. Per-VM Provisioning & Unattend Profiles

Система персонализированной установки Windows на виртуальные машины.

### 7.1 Обзор

При создании VM генерируется уникальный маленький ISO ("config ISO"), содержащий:
- Кастомный `autounattend.xml` (имя юзера, ПО для удаления, таймзона и т.д.)
- `provision.json` (IP, provisioning token, S3 endpoint, VM UUID)
- `START.ps1` (bootstrap-скрипт для первого запуска)

### 7.2 Компоненты

**Backend:**
1. Миграция: `supabase/migrations/20260215001000_create_unattend_provisioning.sql`
   - `unattend_profiles` — пользовательские шаблоны autounattend.xml
   - `provisioning_tokens` — JWT-токены привязанные к VM (active/used/expired/revoked)
   - `vm_setup_progress` — трекинг шагов установки
2. Сервис: `proxy-server/src/modules/provisioning/service.js` — CRUD профилей, выдача/валидация токенов, прогресс
3. XML-генератор: `proxy-server/src/modules/unattend/xml-builder.js` — полный autounattend.xml из профиля
4. S3 сервис: `proxy-server/src/modules/provisioning/s3-service.js` — presigned URLs для софта
5. Маршруты: `proxy-server/src/modules/v1/provisioning.routes.js`

**API-эндпоинты:**

| Метод | Путь | Аутентификация | Описание |
|-------|------|----------------|----------|
| GET | `/api/v1/unattend-profiles` | user | Список профилей |
| POST | `/api/v1/unattend-profiles` | user | Создать профиль |
| PUT | `/api/v1/unattend-profiles/:id` | user | Обновить профиль |
| DELETE | `/api/v1/unattend-profiles/:id` | user | Удалить профиль |
| POST | `/api/v1/provisioning/generate-iso-payload` | user | Генерация XML + provision.json |
| POST | `/api/v1/provisioning/validate-token` | public (token в body) | VM валидирует токен |
| POST | `/api/v1/provisioning/report-progress` | public (token в body) | VM отчитывается о прогрессе |
| GET | `/api/v1/provisioning/progress/:vmUuid` | user | Получить прогресс установки VM |

**Агент (новые команды):**
- `proxmox.create-provision-iso` — SSH: base64-файлы → mkisofs/genisoimage → ISO в Proxmox storage
- `proxmox.attach-cdrom` — привязка ISO к VM через Proxmox API (`qm set --ide2`)
- `proxmox.detach-cdrom` — отвязка ISO + опциональное удаление файла

**Frontend:**
1. Сервис: `bot-mox/src/services/unattendProfileService.ts`
2. Редактор профилей: `bot-mox/src/pages/vms/UnattendProfileEditor.tsx` (модалка с табами)
3. Монитор прогресса: `bot-mox/src/components/vm/VMSetupProgress.tsx`

### 7.3 Flow создания VM с провизионингом

```
1. Clone template VM
2. POST /provisioning/generate-iso-payload → base64 файлы (autounattend.xml + provision.json + START.ps1)
3. Agent: proxmox.create-provision-iso → ISO на хосте
4. Agent: proxmox.attach-cdrom → IDE2 CD-ROM
5. Patch VM config (cores, memory, network)
6. Register VM + provisioning token
7. Start VM
8. Windows ставится с кастомным autounattend.xml
9. START.ps1 → читает provision.json → валидирует токен → скачивает софт
10. Приложение отчитывается → ISO отцепляется
```

### 7.4 Env-переменные

```
PROVISION_TOKEN_SECRET=        # HS256 secret (fallback: AGENT_AUTH_SECRET → LICENSE_LEASE_SECRET)
PROVISION_TOKEN_TTL_DAYS=30    # TTL токена в днях
S3_BUCKET_PROVISIONING=        # S3 bucket для софта (fallback: S3_BUCKET_ARTIFACTS)
```

### 7.5 Конфигурация профиля (структура config в unattend_profiles)

- `user` — режим имени (random/fixed/custom), пароль, группа
- `computerName` — режим (random/fixed/custom)
- `locale` — язык, таймзона, раскладка, geo ID
- `softwareRemoval` — режим (fixed/random/mixed), списки пакетов
- `capabilityRemoval` — аналогично для Windows capabilities
- `windowsSettings` — тогглы (Defender, UAC, SmartScreen, Update, и т.д.)
- `visualEffects` — режим (performance/balanced/random)
- `desktopIcons` — Recycle Bin, This PC

Полная реализация плана: `docs/plans/per-vm-provisioning-iso.md`.

## 8. Primary Development Workflow

Daily workflow:

1. Choose runtime mode:
   - light mode (Supabase CLI + backend/frontend local hot reload),
   - full `prod-sim` compose stack.
2. Implement changes in affected package (`bot-mox`, `proxy-server`, `agent`).
3. Run quality gate: `pnpm run check:all`.
4. If DB schema changed: add migration in `supabase/migrations/*` and run `corepack pnpm exec supabase db reset`.
5. Validate feature flow with domain-specific smoke/manual checks.
6. Run decommission audit after architecture/dependency changes: `pnpm run audit:firebase:decommission`.

Team references:

1. `docs/DEV-WORKFLOW.md` (developer operations).
2. `docs/runbooks/vps-operations.md` (deploy/rollback/backups).
3. `docs/audits/firebase-decommission-audit.md` (decommission tracker).

## 9. Source of Truth

1. API contract: `docs/api/openapi.yaml`.
2. Data model notes: `docs/DATABASE.md`.
3. Decommission live audit: `docs/audits/firebase-decommission-audit.md`.
4. Agent ownership policy: `docs/architecture/agent-ownership-policy.md`.
5. Roadmap and statuses: `docs/plans/green-implementation-roadmap.md`.
6. Issue backlog mirror: `docs/plans/green-issue-backlog.md`.
7. Provisioning plan: `docs/plans/per-vm-provisioning-iso.md`.
8. Deploy runtime manifests: `deploy/compose.stack.yml`, `deploy/compose.dev.override.yml`.
