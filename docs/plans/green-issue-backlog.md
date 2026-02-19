# Green Roadmap Issue Backlog

## Usage
1. Create one tracker issue per item below.
2. Keep issue IDs aligned with roadmap task IDs (`A-01 ... D-04`).
3. Do not mark issue as done until all DoD checks are green.

## Labels (Recommended)
- `phase:A|B|C|D`
- `priority:P0|P1|P2`
- `type:infra|backend|frontend|security|ops|data`
- `status:todo|wip|blocked|green`

## Phase A (P0): Production-like Stack + CI/CD

### Issue A-01: Production Dockerfiles for frontend/backend
Type: `infra`  
Priority: `P0`  
Depends on: none  
Estimate: `1-2d`
Status: `GREEN`

Scope:
1. Add `apps/frontend/Dockerfile` (multi-stage build + static runtime).
2. Add `apps/backend-legacy/Dockerfile` (production Node runtime).
3. Add frontend runtime-config injection (`runtime-config.js`) for Docker deployments.

DoD:
1. Both images build locally.
2. Runtime containers start without interactive setup.
3. Frontend runtime env can be configured without rebuilding the image.
4. Build args/env are documented.

Validation:
1. `docker build -f apps/frontend/Dockerfile .`
2. `docker build -f apps/backend-legacy/Dockerfile .`

### Issue A-02: Deploy stack manifests + Caddy routing
Type: `infra`  
Priority: `P0`  
Depends on: `A-01`  
Estimate: `2d`
Status: `GREEN`

Scope:
1. Add `deploy/compose.stack.yml`.
2. Add `deploy/compose.dev.override.yml`.
3. Add `deploy/compose.prod-sim.env.example`.
4. Add `deploy/compose.prod.env.example`.
5. Add `deploy/caddy/Caddyfile`.
6. Add Supabase core routing config (`deploy/supabase/kong.yml`).

DoD:
1. `prod-sim` stack starts locally.
2. `app.<domain>` routes to frontend.
3. `api.<domain>` routes to backend.
4. `s3.<domain>` routes to MinIO API.
5. `supabase.<domain>` routes to Supabase core (`/auth/v1`, `/rest/v1`, `/storage/v1`).

Validation:
1. `docker compose -f deploy/compose.stack.yml --env-file deploy/compose.prod-sim.env.example up -d`
2. Manual smoke on frontend/API routes.

### Issue A-03: Stack lifecycle and backup scripts
Type: `ops`  
Priority: `P1`  
Depends on: `A-02`  
Estimate: `2d`
Status: `GREEN`

Scope:
1. Add `scripts/stack-dev-up.(ps1|sh)` and `scripts/stack-dev-down.(ps1|sh)`.
2. Add `scripts/stack-prod-sim-up.(ps1|sh)` and `scripts/stack-prod-sim-down.(ps1|sh)`.
3. Add `scripts/deploy-vps.sh` and `scripts/rollback-vps.sh`.
4. Add `scripts/backup-postgres.sh` and `scripts/backup-minio.sh`.

DoD:
1. Scripts are idempotent.
2. Rollback script accepts target tag.
3. Backup scripts produce timestamped archives.

Validation:
1. Run each script twice and verify stable behavior.
2. Test restore on temporary volume/container.

### Issue A-04: Image pipeline + deploy + rollback workflows
Type: `infra`  
Priority: `P0`  
Depends on: `A-01`, `A-02`  
Estimate: `2d`
Status: `GREEN`

Scope:
1. Add `.github/workflows/images.yml`.
2. Add `.github/workflows/deploy-prod.yml`.
3. Add `.github/workflows/rollback-prod.yml`.

DoD:
1. `images.yml` pushes tags `sha-*` and `main-latest`.
2. `deploy-prod.yml` deploys selected tag via `workflow_dispatch`.
3. `rollback-prod.yml` restores previous tag and runs smoke checks.

Validation:
1. Run workflow in test branch/repo and inspect published tags.
2. Perform one deploy and one rollback on non-production target.

### Issue A-05: Health/live/ready contract
Type: `backend`  
Priority: `P0`  
Depends on: `A-02`  
Estimate: `1d`
Status: `GREEN`

Scope:
1. Add `GET /api/v1/health/live`.
2. Add `GET /api/v1/health/ready`.
3. Extend `GET /api/v1/health` with `supabase_ready` and `s3_ready`.

DoD:
1. Liveness does not depend on external deps.
2. Readiness reflects Supabase/MinIO state.
3. API docs updated.

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. Manual curl checks with dep up/down conditions.

### Issue A-06: VPS runbook (deploy/rollback/backups)
Type: `ops`  
Priority: `P1`  
Depends on: `A-03`, `A-04`, `A-05`  
Estimate: `1d`
Status: `GREEN`

Scope:
1. Document required secrets and where they are stored.
2. Document deploy/rollback sequence.
3. Document backup schedule and restore drill.

DoD:
1. Teammate can run deploy from runbook only.
2. Restore drill documented with real output artifacts.

Validation:
1. Dry-run by another teammate.

Evidence:
1. `docs/runbooks/vps-operations.md`

## Phase B (P0): MinIO Artifacts + Lease-Gated Delivery

### Issue B-01: Supabase schema for artifacts domain
Type: `data`  
Priority: `P0`  
Depends on: `A-02`  
Estimate: `1-2d`
Status: `GREEN`

Scope:
1. Add migrations for `artifact_releases`.
2. Add migrations for `artifact_assignments`.
3. Add migrations for `artifact_download_audit`.
4. Add indexes and constraints for tenant/module lookups.

DoD:
1. Tables are tenant-scoped and constrained.
2. Migration is repeatable across environments.

Validation:
1. `supabase db reset` with migrations applied.
2. SQL sanity queries for expected lookup patterns.

### Issue B-02: S3 storage provider abstraction + MinIO adapter
Type: `backend`  
Priority: `P0`  
Depends on: `A-02`  
Estimate: `2d`
Status: `GREEN`

Scope:
1. Add storage provider interface in backend.
2. Implement MinIO adapter (presign + stat + metadata).
3. Add strict env validation for S3 settings.

DoD:
1. Backend can generate short-lived presigned URLs.
2. No anonymous/public read path exists.
3. Failures return typed API errors.

Validation:
1. Unit/integration checks for presign path.
2. Manual verification that bucket is private.

### Issue B-03: Artifacts API module
Type: `backend`  
Priority: `P0`  
Depends on: `B-01`, `B-02`  
Estimate: `2-3d`
Status: `GREEN`

Scope:
1. Add `POST /api/v1/artifacts/releases`.
2. Add `POST /api/v1/artifacts/assign`.
3. Add `GET /api/v1/artifacts/assign/:userId/:module`.
4. Add `POST /api/v1/artifacts/resolve-download`.

DoD:
1. Resolve endpoint validates lease token and VM ownership.
2. Expired/revoked lease is rejected.
3. Resolve attempt is always written to audit table.

Validation:
1. Positive flow with valid entitlement.
2. Negative matrix from `minio-artifacts-vm-lease.md`.

### Issue B-04: Runner E2E download flow (UUID + lease + sha256)
Type: `backend`  
Priority: `P1`  
Depends on: `B-03`  
Estimate: `2d`
Status: `GREEN`

Scope:
1. Wire `vm/register` + `license/lease` + `artifacts/resolve-download`.
2. Document runner request sequence and retry behavior.

DoD:
1. Download works on active lease.
2. Expired URL requires new resolve request.
3. SHA-256 verification is enforced in flow docs/examples.

Validation:
1. Run `npm run smoke:artifacts:e2e` with valid env/secrets and an existing assignment (or set `E2E_RELEASE_ID`).
2. Audit records confirm each resolve/download attempt.

Evidence:
1. `scripts/artifacts-e2e-smoke.js` (complete flow with sha256, expired token, revoked lease, VM/module mismatch)
2. `scripts/README.md` (runner request sequence + retry behavior table + heartbeat docs)

## Phase C (P0): Agent Command Bus + E2E Secrets

### Issue C-01: Agents API (register/heartbeat/revoke/list)
Type: `backend`
Priority: `P0`
Depends on: `A-05`
Estimate: `2d`
Status: `GREEN`

Scope:
1. Add `POST /api/v1/agents/pairings`.
2. Add `POST /api/v1/agents/register`.
3. Add `POST /api/v1/agents/heartbeat`.
4. Add `GET /api/v1/agents`.
5. Add `GET /api/v1/agents/:id`.
6. Add `POST /api/v1/agents/:id/revoke`.

DoD:
1. Tenant isolation is enforced.
2. Revoke blocks future command execution.

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. `npm run check:secrets`

Evidence:
1. `apps/backend-legacy/src/modules/agents/service.js`
2. `apps/backend-legacy/src/modules/v1/agents.routes.js`
3. `supabase/migrations/20260212000400_create_agents_domain.sql`

### Issue C-02: Agent command bus + command lifecycle
Type: `backend`
Priority: `P0`
Depends on: `C-01`
Estimate: `3d`
Status: `GREEN`

Scope:
1. Command queue model and statuses (`queued/dispatched/running/succeeded/failed/expired/cancelled`).
2. Fail-fast error when agent is offline (`AGENT_OFFLINE`, 409).
3. HTTP-based command dispatch and status polling.
4. WSS channel deferred to agent desktop client phase.

DoD:
1. Command lifecycle visible via API.
2. Offline agent does not silently queue forever.

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`

Evidence:
1. `apps/backend-legacy/src/modules/vm-ops/service.js`
2. `apps/backend-legacy/src/modules/v1/vm-ops.routes.js`
3. `supabase/migrations/20260212000400_create_agents_domain.sql` (`agent_commands` table)

### Issue C-03: Ciphertext-only secrets APIs + bindings
Type: `security`
Priority: `P0`
Depends on: `C-01`
Estimate: `3d`
Status: `GREEN`

Scope:
1. Add `POST /api/v1/secrets`.
2. Add `GET /api/v1/secrets/:id/meta`.
3. Add `POST /api/v1/secrets/:id/rotate`.
4. Add `POST /api/v1/secrets/bindings`.
5. Add `GET /api/v1/secrets/bindings`.

DoD:
1. Backend stores and returns only ciphertext metadata.
2. Plaintext secret cannot be obtained via API (ciphertext/nonce excluded from all responses).

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. `npm run check:secrets`

Evidence:
1. `apps/backend-legacy/src/modules/secrets/service.js`
2. `apps/backend-legacy/src/modules/v1/secrets.routes.js`
3. `supabase/migrations/20260212000400_create_agents_domain.sql` (`secrets_ciphertext`, `secret_bindings`)

### Issue C-04: VM ops migration to agent command bus
Type: `backend`
Priority: `P0`
Depends on: `C-02`, `C-03`
Estimate: `2-3d`
Status: `GREEN`

Scope:
1. Add `/api/v1/vm-ops/proxmox/:action` and `/api/v1/vm-ops/syncthing/:action`.
2. Legacy `/api/v1/infra/*` already restricted to admin/internal only (`requireRole('infra')`).
3. Customer flow only through agent path.

DoD:
1. Tenant user cannot execute direct legacy infra operations.
2. VM ops require online agent + valid auth context.

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`

Evidence:
1. `apps/backend-legacy/src/modules/v1/vm-ops.routes.js`
2. `apps/backend-legacy/src/modules/vm-ops/service.js`
3. `apps/backend-legacy/src/modules/v1/index.js` (infra requires 'infra' role)

### Issue C-05: Frontend migration from plaintext passwords to `secret_ref`
Type: `frontend`
Priority: `P0`
Depends on: `C-03`, `C-04`
Estimate: `2d`
Status: `GREEN`

Scope:
1. Update VM settings UI to show secret binding status, not password input.
2. Switch frontend service calls to `/api/v1/vm-ops/*`.

DoD:
1. No plaintext password fields in tenant-facing VM settings.
2. Existing settings UX remains functional for non-secret fields.

Validation:
1. `npm run lint`
2. `npm run check:types`
3. `npm run build`
4. `npm run check:bundle:budgets`

Evidence:
1. `apps/frontend/src/components/vm/settingsForm/SecretField.tsx`
2. `apps/frontend/src/services/secretsService.ts`
3. `apps/frontend/src/services/vmOpsService.ts`
4. `apps/frontend/src/services/vmService.ts` (switched to vm-ops command bus)
5. `apps/frontend/src/services/vmSettingsService.ts` (stripPasswords)
6. `apps/frontend/src/types/secrets.ts`

## Phase D (P1): Supabase Expansion + RTDB Cutover

### Issue D-01: Repository interfaces for all domains
Type: `backend`
Priority: `P1`
Depends on: `C-05`
Estimate: `2d`
Status: `GREEN`

Scope:
1. Define storage interfaces for `resources`, `workspace`, `bots`, `finance`, `settings`.
2. Keep API contracts unchanged.

DoD:
1. Route handlers are backend-agnostic.
2. RTDB path remains fallback during migration.

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. `npm run check:secrets`

Evidence:
1. `apps/backend-legacy/src/repositories/repository-factory.js`
2. `apps/backend-legacy/src/modules/v1/index.js` (wires factory into routes)

### Issue D-02: Supabase repositories for remaining domains
Type: `backend`
Priority: `P1`
Depends on: `D-01`
Estimate: `4-6d`
Status: `GREEN`

Scope:
1. Implement Supabase repositories and schemas per domain.
2. Add indexes and tenant constraints.

DoD:
1. Domain parity tests pass for agreed fields.
2. No tenant data bleed.

Validation:
1. `npm run check:backend:syntax`
2. `npm run check:backend:smoke`
3. `npm run check:secrets`
4. `supabase db reset` (all 5 migrations clean)
5. Stack DB migration (12 new tables created)

Evidence:
1. `supabase/migrations/20260212000500_create_domain_entities.sql`
2. `apps/backend-legacy/src/repositories/supabase/supabase-collection-repository.js`
3. `apps/backend-legacy/src/repositories/repository-factory.js` (DATA_BACKEND routing)

### Issue D-03: RTDB -> Supabase migration toolkit
Type: `data`
Priority: `P1`
Depends on: `D-02`
Estimate: `3d`
Status: `GREEN`

Scope:
1. Add idempotent migration scripts.
2. Add parity report tooling.
3. Add cutover checklist.

DoD:
1. Multiple runs are safe and deterministic.
2. Parity report supports release decision.

Validation:
1. `node --check scripts/migrate-rtdb-to-supabase.js`
2. `node --check scripts/verify-migration-parity.js`
3. `npm run check:secrets`

Evidence:
1. `scripts/migrate-rtdb-to-supabase.js` (upsert-based, supports --dry-run)
2. `scripts/verify-migration-parity.js` (count + sample parity)
3. `docs/runbooks/rtdb-supabase-cutover.md`

### Issue D-04: Controlled production cutover + stabilization
Type: `ops`  
Priority: `P1`  
Depends on: `D-03`, `A-04`  
Estimate: `2d`

Scope:
1. Freeze writes.
2. Final sync and backend switch (`DATA_BACKEND=supabase`).
3. Observe and rollback if needed.

DoD:
1. Production smoke checks are green.
2. Rollback verified in staging/prod-sim before production run.
3. Post-cutover incident window defined and completed.

Validation:
1. Smoke checks after switch.
2. Documented cutover + rollback evidence.

## Sprint Plan (Immediate)
Sprint target (7-10 working days):
1. ~~`A-06`~~ `GREEN`.
2. ~~`B-04`~~ `GREEN`.
3. ~~`C-01..C-05`~~ `GREEN`.
4. ~~`D-01`~~ `GREEN`.
5. ~~`D-02`~~ `GREEN`.
6. ~~`D-03`~~ `GREEN`.
7. D-04 — controlled cutover when ready.

Sprint success criteria:
1. Stack and CD are operational.
2. Health/readiness contract is live.
3. Runner artifacts download flow is verified end-to-end (lease + sha256).
4. Agent command bus and secrets vault APIs are operational.
5. VM operations flow through agent-mediated path.
