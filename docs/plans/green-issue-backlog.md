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
1. Add `bot-mox/Dockerfile` (multi-stage build + static runtime).
2. Add `proxy-server/Dockerfile` (production Node runtime).

DoD:
1. Both images build locally.
2. Runtime containers start without interactive setup.
3. Build args/env are documented.

Validation:
1. `docker build -f bot-mox/Dockerfile .`
2. `docker build -f proxy-server/Dockerfile .`

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

DoD:
1. `prod-sim` stack starts locally.
2. `app.<domain>` routes to frontend.
3. `api.<domain>` routes to backend.
4. `s3.<domain>` routes to MinIO API.

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
Status: `WIP`

Scope:
1. Document required secrets and where they are stored.
2. Document deploy/rollback sequence.
3. Document backup schedule and restore drill.

DoD:
1. Teammate can run deploy from runbook only.
2. Restore drill documented with real output artifacts.

Validation:
1. Dry-run by another teammate.

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
Status: `WIP`

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

## Phase C (P0): Agent Command Bus + E2E Secrets

### Issue C-01: Agents API (register/heartbeat/revoke/list)
Type: `backend`  
Priority: `P0`  
Depends on: `A-05`  
Estimate: `2d`

Scope:
1. Add `POST /api/v1/agents/pairings`.
2. Add `POST /api/v1/agents/register`.
3. Add `POST /api/v1/agents/heartbeat`.
4. Add `GET /api/v1/agents`.
5. Add `POST /api/v1/agents/:id/revoke`.

DoD:
1. Tenant isolation is enforced.
2. Revoke blocks future command execution.

Validation:
1. AuthZ tests across tenant A/B.
2. Heartbeat stale/online status checks.

### Issue C-02: Agent WSS channel + command lifecycle
Type: `backend`  
Priority: `P0`  
Depends on: `C-01`  
Estimate: `3d`

Scope:
1. Add `wss /ws/v1/agents/connect`.
2. Add command queue and statuses (`queued/running/succeeded/failed`).
3. Add fail-fast error when agent is offline.

DoD:
1. Command lifecycle visible via API.
2. Offline agent does not silently queue forever.

Validation:
1. Integration tests for connect/disconnect cases.
2. Manual command execution with online/offline agent.

### Issue C-03: Ciphertext-only secrets APIs + bindings
Type: `security`  
Priority: `P0`  
Depends on: `C-01`  
Estimate: `3d`

Scope:
1. Add `POST /api/v1/secrets`.
2. Add `GET /api/v1/secrets/:id/meta`.
3. Add `POST /api/v1/secrets/:id/rotate`.
4. Add secret bindings for bot/vm scopes.
5. Add redaction middleware for logs/errors.

DoD:
1. Backend stores and returns only ciphertext metadata.
2. Plaintext secret cannot be obtained via API/logs.

Validation:
1. Security regression tests for log/API outputs.
2. Rotation test confirms new `secret_ref` usage.

### Issue C-04: VM ops migration to agent command bus
Type: `backend`  
Priority: `P0`  
Depends on: `C-02`, `C-03`  
Estimate: `2-3d`

Scope:
1. Add `/api/v1/vm-ops/proxmox/*` and `/api/v1/vm-ops/syncthing/*`.
2. Restrict legacy `/api/v1/infra/*` to internal/admin.
3. Keep customer flow only through agent path.

DoD:
1. Tenant user cannot execute direct legacy infra operations.
2. VM ops require online agent + valid auth context.

Validation:
1. RBAC tests for infra endpoints.
2. End-to-end VM op through agent.

### Issue C-05: Frontend migration from plaintext passwords to `secret_ref`
Type: `frontend`  
Priority: `P0`  
Depends on: `C-03`, `C-04`  
Estimate: `2d`

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

## Phase D (P1): Supabase Expansion + RTDB Cutover

### Issue D-01: Repository interfaces for all domains
Type: `backend`  
Priority: `P1`  
Depends on: `C-05`  
Estimate: `2d`

Scope:
1. Define storage interfaces for `resources`, `workspace`, `bots`, `finance`, `settings`.
2. Keep API contracts unchanged.

DoD:
1. Route handlers are backend-agnostic.
2. RTDB path remains fallback during migration.

Validation:
1. Backend smoke checks in both backend modes.

### Issue D-02: Supabase repositories for remaining domains
Type: `backend`  
Priority: `P1`  
Depends on: `D-01`  
Estimate: `4-6d`

Scope:
1. Implement Supabase repositories and schemas per domain.
2. Add indexes and tenant constraints.

DoD:
1. Domain parity tests pass for agreed fields.
2. No tenant data bleed.

Validation:
1. Contract-level API regression tests.
2. Manual parity spot checks.

### Issue D-03: RTDB -> Supabase migration toolkit
Type: `data`  
Priority: `P1`  
Depends on: `D-02`  
Estimate: `3d`

Scope:
1. Add idempotent migration scripts.
2. Add parity report tooling.
3. Add cutover checklist.

DoD:
1. Multiple runs are safe and deterministic.
2. Parity report supports release decision.

Validation:
1. Repeat migration run on same dataset.
2. Review parity mismatches and thresholds.

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
1. `A-06`.
2. `B-04`.

Sprint success criteria:
1. Stack and CD are operational.
2. Health/readiness contract is live.
3. Runner artifacts download flow is verified end-to-end (lease + sha256).
