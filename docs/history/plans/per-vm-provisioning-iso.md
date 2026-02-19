# Plan: Per-VM Provisioning ISO + Unattend Profiles + S3 Artifact Delivery

## Context

**Текущее состояние:** VM создаётся клонированием шаблона (пустой диск + Windows installer ISO с вшитым autounattend.xml). IP берётся из SMBIOS. Нет персонализации установки, нет защиты установщика, нет системы доставки софта.

**Проблемы:**
- autounattend.xml одинаковый для всех VM (одинаковый fingerprint)
- IP через SMBIOS — хрупко, нет гибкости
- Нет токенов/авторизации — любой может воспользоваться установщиком
- Нет персонализации — пользователь не может выбрать ПО, имя, настройки
- Нет системы доставки проприетарного софта с S3

**Целевое состояние:** При создании VM генерируется уникальный маленький ISO ("config ISO"), содержащий:
- Кастомный `autounattend.xml` (имя юзера, ПО для удаления, таймзона и т.д.)
- `provision.json` (IP, provisioning token, S3 endpoint, VM UUID)

После установки Windows bootstrap-скрипт читает `provision.json`, скачивает с S3 верификатор → основное .NET TUI приложение → запускает настройку по playbook пользователя. Приложение отчитывается серверу о прогрессе, в конце сервер через агента отцепляет ISO.

---

## Phase 1: Database & Backend Core

### 1.1 Миграция: `unattend_profiles` + `provisioning_tokens`

**File:** `supabase/migrations/20260215001000_create_unattend_provisioning.sql`

```sql
-- Профили autounattend.xml (шаблоны пользователя)
CREATE TABLE unattend_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL DEFAULT 'default',
  user_id    UUID NOT NULL,
  name       TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  config     JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id, name)
);

-- Provisioning tokens (per-VM, long-lived)
CREATE TABLE provisioning_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  user_id     UUID NOT NULL,
  vm_uuid     TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','used','expired','revoked')),
  issued_at   TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  metadata    JSONB DEFAULT '{}',
  UNIQUE(tenant_id, vm_uuid)
);

-- VM setup progress tracking
CREATE TABLE vm_setup_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  vm_uuid     TEXT NOT NULL,
  token_id    UUID REFERENCES provisioning_tokens(id),
  step        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','completed','failed')),
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX idx_vm_setup_progress_vm ON vm_setup_progress(tenant_id, vm_uuid);
```

### 1.2 Unattend Profile Config Schema (Zod)

Added to `apps/backend-legacy/src/contracts/schemas.js`

### 1.3 Unattend XML Template Engine

**File:** `apps/backend-legacy/src/modules/unattend/xml-builder.js`

- Принимает `unattendProfileConfig` + `provisionConfig` (IP, token, S3 endpoint)
- Генерирует полный XML из шаблонного XML
- Динамические части: LocalAccount, ComputerName, TimeZone, RemovePackages.ps1, etc.

### 1.4 Provisioning Token Service

**File:** `apps/backend-legacy/src/modules/provisioning/service.js`

- `issueToken({ tenantId, userId, vmUuid, expiresInDays })`
- `validateToken(token, vmUuid)`
- `markUsed(tokenId)`
- `revokeToken(tokenId)`
- `revokeByVmUuid({ tenantId, vmUuid })`

### 1.5 API Routes

**File:** `apps/backend-legacy/src/modules/v1/provisioning.routes.js`

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| `GET` | `/api/v1/unattend-profiles` | user | Список профилей |
| `POST` | `/api/v1/unattend-profiles` | user | Создать профиль |
| `PUT` | `/api/v1/unattend-profiles/:id` | user | Обновить профиль |
| `DELETE` | `/api/v1/unattend-profiles/:id` | user | Удалить профиль |
| `POST` | `/api/v1/provisioning/generate-iso-payload` | user | Сгенерировать XML + provision.json |
| `POST` | `/api/v1/provisioning/validate-token` | provision_token | Валидация токена VM |
| `POST` | `/api/v1/provisioning/report-progress` | provision_token | VM отчитывается |
| `GET` | `/api/v1/provisioning/playbook` | provision_token | VM скачивает playbook |

---

## Phase 2: Agent — ISO Generation & Attachment

### 2.1 Новые команды агента

**File:** `agent/src/executors/proxmox.ts`

- `proxmox.create-provision-iso` — SSH: base64 → file, mkisofs → ISO
- `proxmox.attach-cdrom` — `qm set {vmid} --{cdromSlot} {isoPath},media=cdrom`
- `proxmox.detach-cdrom` — `qm set {vmid} --{cdromSlot} none` + rm ISO

### 2.2 Обновлённый flow создания VM

**File:** `apps/frontend/src/hooks/vm/queue/processor.ts`

1. Clone template VM
2. Server: `POST /provisioning/generate-iso-payload`
3. Agent: `proxmox.create-provision-iso`
4. Agent: `proxmox.attach-cdrom`
5. Patch config (cores, memory, network — без IP в SMBIOS)
6. Register bot + Register provisioning token
7. Start VM

---

## Phase 3: S3 Artifact Storage

### 3.1 S3 Bucket Structure

```
botmox-provisioning/
  ├── bootstrap/downloader.exe
  ├── apps/winsible-setup.exe + .sha256
  ├── software/nomachine/... proxifier/...
  └── manifests/latest.json
```

### 3.2 S3 Presigned URL Service

**File:** `apps/backend-legacy/src/modules/provisioning/s3-service.js`

### 3.3 Env Variables

```
S3_BUCKET_PROVISIONING=botmox-provisioning
PROVISION_TOKEN_SECRET=...
PROVISION_TOKEN_TTL_DAYS=30
```

---

## Phase 4: Frontend — Unattend Profile Editor

### 4.1 Unattend Profile Editor

**File:** `apps/frontend/src/pages/vms/UnattendProfileEditor.tsx`

Секции: Account, Computer Name, Locale, Software Removal, Windows Settings, Visual Effects, Save as Template

### 4.2 Интеграция с VM Queue

- `unattendProfileId` в `VMQueueItem`
- Выбор профиля в настройках VM Generator

### 4.3 Setup Progress Monitor

**File:** `apps/frontend/src/components/vm/VMSetupProgress.tsx`

### 4.4 Frontend Service

**File:** `apps/frontend/src/services/unattendProfileService.ts`

---

## Phase 5: VM-Side Bootstrap

### 5.1 provision.json format

```json
{
  "version": 1,
  "vm_uuid": "...",
  "ip": { "address": "...", "netmask": "...", "gateway": "...", "dns": [...] },
  "token": "eyJ...",
  "s3_endpoint": "https://s3.example.com",
  "api_endpoint": "https://api.example.com",
  "bootstrap_url": "/provisioning/validate-token"
}
```

### 5.2 START.ps1 Logic (встраивается в autounattend.xml)

### 5.3 Cleanup — ISO detach after completion

---

## Порядок реализации

1. Phase 1 — DB + Backend
2. Phase 2 — Agent commands
3. Phase 3 — S3 bucket + presigned URLs
4. Phase 4 — Frontend
5. Phase 5 — START.ps1 bootstrap

## Verification

1. `npm run check:backend:syntax && npm run check:backend:smoke`
2. `npm run check:all`
3. `npx supabase db reset`
4. E2E manual test flow
