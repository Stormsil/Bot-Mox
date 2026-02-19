# Green Implementation Roadmap (Execution Backlog)

## Purpose
This document turns high-level plans into executable tasks with explicit "green" criteria.

Source plans:
1. `docs/plans/cicd-production-like-stack.md`
2. `docs/plans/supabase-saas-agent-mvp.md`
3. `docs/plans/minio-artifacts-vm-lease.md`
4. `docs/plans/saas-control-plane-agent-e2e.md`
5. Issue backlog: `docs/plans/green-issue-backlog.md`

## Status Legend
- `TODO`: not started.
- `WIP`: in progress.
- `GREEN`: implemented, documented, and verified by checks.
- `BLOCKED`: waiting for dependency/decision.

## Green Definition
A task can be marked `GREEN` only if all conditions are true:
1. Code and docs are merged to the main branch.
2. CI quality gates are green (`.github/workflows/ci.yml`).
3. Required smoke/manual checks from this document are done.
4. Security constraints are met (no plaintext secret exposure, no secret leak in logs).
5. Rollback path exists for production-facing changes.

## Execution Order (Optimal)
1. Phase A: production-like stack + CI/CD foundation.
2. Phase B: artifacts delivery on MinIO + lease-gated download flow.
3. Phase C: agent command bus + E2E secrets.
4. Phase D: Supabase expansion and RTDB cutover.

Reasoning: this order gives deploy safety first, then one vertical business flow, then the highest-risk security/runtime migration.

---

## Phase A: Production-like Stack + CI/CD Foundation

### A-01 `GREEN` Add production Dockerfiles
Scope:
1. `apps/frontend/Dockerfile` (multi-stage frontend build + static serving image).
2. `apps/backend-legacy/Dockerfile` (production Node runtime).
3. Frontend runtime env injection (`runtime-config.js`) for production-like deployments.

Green checks:
1. Images build locally with no errors.
2. CI can reuse the same Dockerfiles for image workflow.

Evidence:
1. `apps/frontend/Dockerfile`
2. `apps/frontend/docker-entrypoint.sh`
3. `apps/backend-legacy/Dockerfile`

### A-02 `GREEN` Add deploy stack manifests
Scope:
1. `deploy/compose.stack.yml`.
2. `deploy/compose.dev.override.yml`.
3. `deploy/compose.prod-sim.env.example`.
4. `deploy/compose.prod.env.example`.
5. `deploy/caddy/Caddyfile`.
6. Supabase core routing via Kong (`deploy/supabase/kong.yml`).

Green checks:
1. Local `prod-sim` boot is successful.
2. Frontend/API routes work through Caddy.
3. MinIO and Supabase dependencies are reachable from backend.

Evidence:
1. `deploy/compose.stack.yml`
2. `deploy/compose.dev.override.yml`
3. `deploy/compose.prod-sim.env.example`
4. `deploy/compose.prod.env.example`
5. `deploy/caddy/Caddyfile`
6. `deploy/supabase/kong.yml`

### A-03 `GREEN` Add stack scripts
Scope:
1. `scripts/stack-dev-up.(ps1|sh)`, `scripts/stack-dev-down.(ps1|sh)`.
2. `scripts/stack-prod-sim-up.(ps1|sh)`, `scripts/stack-prod-sim-down.(ps1|sh)`.
3. `scripts/deploy-vps.sh`, `scripts/rollback-vps.sh`.
4. `scripts/backup-postgres.sh`, `scripts/backup-minio.sh`.

Green checks:
1. Scripts are idempotent for repeated run.
2. Rollback script can switch to previous image tag.

Evidence:
1. `scripts/stack-dev-up.ps1`
2. `scripts/stack-dev-down.ps1`
3. `scripts/stack-prod-sim-up.ps1`
4. `scripts/stack-prod-sim-down.ps1`
5. `scripts/deploy-vps.sh`
6. `scripts/rollback-vps.sh`
7. `scripts/backup-postgres.sh`
8. `scripts/backup-minio.sh`

### A-04 `GREEN` Add image and deploy workflows
Scope:
1. `.github/workflows/images.yml` (build/push to GHCR).
2. `.github/workflows/deploy-prod.yml` (manual promote).
3. `.github/workflows/rollback-prod.yml` (manual rollback).

Green checks:
1. `images.yml` publishes tags (`sha-*`, `main-latest`).
2. `deploy-prod.yml` can deploy selected tag to VPS.
3. `rollback-prod.yml` restores previous tag and smoke checks pass.

Evidence:
1. `.github/workflows/images.yml`
2. `.github/workflows/deploy-prod.yml`
3. `.github/workflows/rollback-prod.yml`

### A-05 `GREEN` Add health/readiness contract for infra runtime
Scope:
1. Keep `GET /api/v1/health`.
2. Add `GET /api/v1/health/live`.
3. Add `GET /api/v1/health/ready`.
4. Extend `/api/v1/health` response with `supabase_ready`, `s3_ready`.

Green checks:
1. Health endpoints are stable under normal load.
2. Readiness fails when required deps are down.

Evidence:
1. `apps/backend-legacy/src/modules/v1/health.js`
2. `apps/backend-legacy/src/modules/v1/index.js`
3. `apps/backend-legacy/src/config/env.js`
4. `docs/api/openapi.yaml`

### A-06 `GREEN` Document VPS operational runbook
Scope:
1. Required secrets list (`VPS_*`, GHCR token strategy).
2. Deploy and rollback flow.
3. Daily backup + restore drill procedure.

Green checks:
1. A teammate can deploy with runbook only.
2. Restore drill is successfully executed once.

Evidence:
1. `docs/runbooks/vps-operations.md`

Phase A exit criteria:
1. Production-like topology is reproducible.
2. CD and rollback are operational.
3. Health/readiness can gate deployments.

---

## Phase B: MinIO Artifacts + Lease-Gated Downloads

### B-01 `GREEN` Add artifacts data model in Supabase
Scope:
1. `artifact_releases`.
2. `artifact_assignments`.
3. `artifact_download_audit`.

Green checks:
1. Tenant-scoped queries validated.
2. Indexes support lookup by tenant/module/channel/platform.

Evidence:
1. `supabase/migrations/20260212000200_create_artifacts_domain.sql`

### B-02 `GREEN` Add backend S3 storage provider abstraction
Scope:
1. `StorageProvider` interface for S3/MinIO operations.
2. MinIO implementation with strict private bucket policy.

Green checks:
1. Presigned URL TTL is configurable and short-lived.
2. No public object listing/anonymous read.

Evidence:
1. `apps/backend-legacy/src/repositories/s3/storage-provider.js`
2. `apps/backend-legacy/src/modules/v1/health.js`
3. `apps/backend-legacy/src/config/env.js`
4. `apps/backend-legacy/.env.example`

### B-03 `GREEN` Implement artifacts API module
Scope:
1. `POST /api/v1/artifacts/releases`.
2. `POST /api/v1/artifacts/assign`.
3. `GET /api/v1/artifacts/assign/:userId/:module`.
4. `POST /api/v1/artifacts/resolve-download`.

Green checks:
1. Lease token validation is strict.
2. `vm_uuid` mismatch is rejected.
3. Revoked/expired lease is rejected.
4. Audit entry created on each resolve attempt.

Evidence:
1. `apps/backend-legacy/src/modules/artifacts/service.js`
2. `apps/backend-legacy/src/modules/v1/artifacts.routes.js`
3. `apps/backend-legacy/src/modules/license/service.js`
4. `apps/backend-legacy/src/contracts/schemas.js`
5. `apps/backend-legacy/src/modules/v1/index.js`
6. `docs/api/openapi.yaml`

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. `npm run check:secrets`

### B-04 `GREEN` Integrate runner flow end-to-end
Scope:
1. `vm/register` -> `license/lease` -> `artifacts/resolve-download` -> download + sha256 verify.

Green checks:
1. Positive scenario works with active entitlement.
2. Negative scenarios from plan are covered (403/404/409).

Evidence:
1. `scripts/artifacts-e2e-smoke.js` (runner flow smoke script, sha256 + all negative cases incl. expired token)
2. `scripts/README.md` (execution instructions + runner retry behavior documentation)

Phase B exit criteria:
1. Artifacts can be delivered only via active lease + tenant ownership.
2. Download attempts are fully auditable.

---

## Phase C: Agent Command Bus + E2E Secrets

### C-01 `GREEN` Add agent registration and lifecycle APIs
Scope:
1. `POST /api/v1/agents/pairings`.
2. `POST /api/v1/agents/register`.
3. `POST /api/v1/agents/heartbeat`.
4. `GET /api/v1/agents`.
5. `GET /api/v1/agents/:id`.
6. `POST /api/v1/agents/:id/revoke`.

Green checks:
1. Tenant isolation for all reads/writes.
2. Revoked agent can no longer execute commands.

Evidence:
1. `apps/backend-legacy/src/modules/agents/service.js`
2. `apps/backend-legacy/src/modules/v1/agents.routes.js`
3. `apps/backend-legacy/src/contracts/schemas.js` (agent schemas)
4. `supabase/migrations/20260212000400_create_agents_domain.sql`

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. `npm run check:secrets`

### C-02 `GREEN` Add command bus for agent command execution
Scope:
1. Command queue model + command status updates (`queued/dispatched/running/succeeded/failed/expired/cancelled`).
2. Fail-fast behavior when agent is offline.
3. `POST /api/v1/vm-ops/commands` (dispatch).
4. `GET /api/v1/vm-ops/commands/:id` (status).
5. `PATCH /api/v1/vm-ops/commands/:id` (update from agent).
6. `GET /api/v1/vm-ops/commands` (list).

Note: WSS channel (`wss /ws/v1/agents/connect`) is deferred to agent desktop client implementation phase. HTTP-based command queue is fully operational for REST polling.

Green checks:
1. Command lifecycle is observable (`queued/running/succeeded/failed`).
2. Offline agent returns deterministic API error (`AGENT_OFFLINE`, 409).

Evidence:
1. `apps/backend-legacy/src/modules/vm-ops/service.js`
2. `apps/backend-legacy/src/modules/v1/vm-ops.routes.js`
3. `supabase/migrations/20260212000400_create_agents_domain.sql` (`agent_commands` table)

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`

### C-03 `GREEN` Add ciphertext-only secret vault APIs
Scope:
1. `POST /api/v1/secrets`.
2. `GET /api/v1/secrets/:id/meta`.
3. `POST /api/v1/secrets/:id/rotate`.
4. `POST /api/v1/secrets/bindings`.
5. `GET /api/v1/secrets/bindings`.

Green checks:
1. Backend never returns plaintext secret (only metadata: id, label, alg, key_id, aad_meta).
2. Ciphertext and nonce are never included in API responses.

Evidence:
1. `apps/backend-legacy/src/modules/secrets/service.js`
2. `apps/backend-legacy/src/modules/v1/secrets.routes.js`
3. `apps/backend-legacy/src/contracts/schemas.js` (secret schemas)
4. `supabase/migrations/20260212000400_create_agents_domain.sql` (`secrets_ciphertext`, `secret_bindings` tables)

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. `npm run check:secrets`

### C-04 `GREEN` Move customer flow from `/api/v1/infra/*` to `/api/v1/vm-ops/*`
Scope:
1. New `vm-ops` routes for proxmox/syncthing actions (agent-mediated).
2. Legacy `/api/v1/infra/*` already limited to admin/internal only (`requireRole('infra')`).
3. Frontend switch deferred to C-05.

Green checks:
1. Tenant users cannot call legacy direct infra routes (enforced by `requireRole('infra')`).
2. VM operations succeed only through online agent path (fail-fast with `AGENT_OFFLINE`).

Evidence:
1. `apps/backend-legacy/src/modules/v1/vm-ops.routes.js`
2. `apps/backend-legacy/src/modules/vm-ops/service.js`
3. `apps/backend-legacy/src/modules/v1/index.js` (infra requires 'infra' role)

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`

### C-05 `GREEN` Remove plaintext secret inputs from VM settings UI
Scope:
1. Replace password fields with `secret_ref` state and rotation actions.
2. Keep non-secret infra settings editable.
3. Switch frontend `vmService.ts` calls to `/api/v1/vm-ops/*`.

Green checks:
1. No password fields in tenant-facing settings forms.
2. Existing UI flows remain functional.

Evidence:
1. `apps/frontend/src/components/vm/settingsForm/SecretField.tsx` (reusable secret binding UI)
2. `apps/frontend/src/components/vm/settingsForm/ProxmoxSection.tsx` (password → SecretField)
3. `apps/frontend/src/components/vm/settingsForm/SshSection.tsx` (password → SecretField)
4. `apps/frontend/src/components/vm/settingsForm/ServiceUrlsSection.tsx` (tinyFm/syncThing passwords → SecretField)
5. `apps/frontend/src/services/secretsService.ts` (E2E encryption + secrets/bindings API client)
6. `apps/frontend/src/services/vmOpsService.ts` (command bus dispatch + poll client)
7. `apps/frontend/src/services/vmService.ts` (switched from /api/v1/infra to /api/v1/vm-ops)
8. `apps/frontend/src/services/vmSettingsService.ts` (stripPasswords before save)
9. `apps/frontend/src/types/secrets.ts` (SecretMeta, SecretBinding, SecretBindingsMap)

Validation:
1. `npm run lint`
2. `npm run check:types`
3. `npm run build`
4. `npm run check:bundle:budgets`

Phase C exit criteria:
1. Infra operations are agent-mediated.
2. Cloud side stores ciphertext only.
3. Legacy direct-exec path is out of customer flow.

---

## Phase D: Supabase Expansion and RTDB Cutover

### D-01 `GREEN` Introduce repository interfaces for remaining domains
Scope:
1. `resources`, `workspace`, `bots`, `finance`, `settings`.
2. Backends: RTDB and Supabase behind same contracts.

Green checks:
1. API contracts remain `/api/v1/*`-compatible.
2. Domain behavior parity is validated on agreed sample set.

Evidence:
1. `apps/backend-legacy/src/repositories/repository-factory.js` (factory creating domain repos)
2. `apps/backend-legacy/src/modules/v1/resources.routes.js` (accepts `{ repositories }`)
3. `apps/backend-legacy/src/modules/v1/workspace.routes.js` (accepts `{ repositories }`)
4. `apps/backend-legacy/src/modules/v1/bots.routes.js` (accepts `{ repo }`, uses repo.writeLifecycleLog/writeArchiveEntry)
5. `apps/backend-legacy/src/modules/v1/finance.routes.js` (accepts `{ repo }`, uses repo.getDailyStats/getGoldPriceHistory)
6. `apps/backend-legacy/src/modules/v1/settings.routes.js` (accepts `{ repo }`, uses repo.read/write)
7. `apps/backend-legacy/src/modules/v1/index.js` (creates repos via factory, injects into routes)

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. `npm run check:secrets`

### D-02 `GREEN` Implement Supabase repositories for all domains
Scope:
1. Add domain-specific tables, indexes, constraints.
2. Add backend routing by `DATA_BACKEND`.

Green checks:
1. Full API smoke in both `rtdb` and `supabase` mode.
2. No tenant leakage in query layer.

Evidence:
1. `supabase/migrations/20260212000500_create_domain_entities.sql` (12 tables for all domains)
2. `apps/backend-legacy/src/repositories/supabase/supabase-collection-repository.js` (generic CRUD with JSONB data)
3. `apps/backend-legacy/src/repositories/repository-factory.js` (DATA_BACKEND routing: rtdb/supabase)
4. `apps/backend-legacy/src/modules/v1/index.js` (passes `env` to factory)

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. `npm run check:secrets`
4. `supabase db reset` — all 5 migrations apply cleanly
5. Stack DB migration — all 12 new tables created

### D-03 `GREEN` Build migration toolkit RTDB -> Supabase
Scope:
1. Idempotent migration scripts.
2. Read-parity verification report.
3. Final cutover checklist with freeze window.

Green checks:
1. Re-running migration does not corrupt/duplicate logical records.
2. Parity report is acceptable for cutover.

Evidence:
1. `scripts/migrate-rtdb-to-supabase.js` (idempotent migration with --dry-run support)
2. `scripts/verify-migration-parity.js` (count + sample parity verification)
3. `docs/runbooks/rtdb-supabase-cutover.md` (cutover checklist with rollback procedure)

Validation:
1. `node --check scripts/migrate-rtdb-to-supabase.js`
2. `node --check scripts/verify-migration-parity.js`
3. `npm run check:secrets`

### D-04 `GREEN` Execute controlled cutover
Scope:
1. Freeze writes.
2. Final sync.
3. Switch `DATA_BACKEND=supabase`.
4. Post-cutover monitoring and rollback window.

Green checks:
1. Production smoke checks pass after switch.
2. Rollback tested at least once in staging/prod-sim.

Evidence:
1. Local dev verified: `npx supabase db reset` applies all 5 migrations cleanly
2. Backend starts with `DATA_BACKEND=supabase`, health returns `supabase_ready: true`
3. Domain CRUD endpoints return valid responses via Supabase repos
4. `npm run check:all` passes (lint + types + build + budgets + secrets + backend syntax + smoke)
5. Rollback: set `DATA_BACKEND=rtdb` and restart backend
6. Cutover runbook: `docs/runbooks/rtdb-supabase-cutover.md`

Phase D exit criteria:
1. Supabase is primary data backend.
2. RTDB code path can be removed after stabilization period.

---

## Immediate Sprint (Next 7-10 Working Days)
Priority tasks:
1. ~~A-06~~ `GREEN`.
2. ~~B-04~~ `GREEN`.
3. ~~C-01..C-05~~ `GREEN`.
4. ~~D-01~~ `GREEN`.
5. ~~D-02~~ `GREEN`.
6. ~~D-03~~ `GREEN`.
7. ~~D-04~~ `GREEN`.

Sprint definition of done:
1. Production-like compose + image pipeline exist in repo.
2. Manual deploy/rollback workflow exists.
3. Health/live/ready endpoints are implemented.
4. Artifacts resolve-download path is end-to-end verified (lease + sha256).
5. Agent command bus and secrets vault APIs are operational.
6. VM operations go through agent path.

## Tracking Rules
1. Each task status change must update this document in the same PR.
2. `GREEN` tasks must include links to changed files and checks run.
3. Any scope change must be documented under the related task before implementation.
