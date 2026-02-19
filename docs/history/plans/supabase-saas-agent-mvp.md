# Supabase + SaaS + Local Agent (WSS) Implementation Plan

## Goal
Move Bot-Mox from RTDB-first runtime to a staged hybrid architecture:

1. SaaS control-plane on VPS (frontend + backend).
2. Local customer agent for secrets and local infra operations (Proxmox/SyncThing).
3. Self-hosted Supabase (PostgreSQL-based) as the primary cloud data platform.

The migration must be incremental, without breaking existing `/api/v1/*` contracts.

## Scope For Current Iteration

### Included
1. Persist this plan as a shared source of truth.
2. Add local developer stack entrypoints for:
   - local Supabase via CLI (Docker-backed),
   - frontend/backend local containers.
3. Introduce backend data-backend switch:
   - `DATA_BACKEND=rtdb` (default),
   - `DATA_BACKEND=supabase` (opt-in).
4. Implement first production-safe Supabase integration for tenant storage policy:
   - `GET|PUT|PATCH /api/v1/settings/storage_policy`.

### Excluded (next phases)
1. Full migration of all resource/workspace/bots/finance domains.
2. Agent WSS command protocol implementation.
3. Full RTDB -> PostgreSQL backfill and cutover.

## Target Runtime Topology

### VPS (Cloud)
1. `apps/frontend` frontend.
2. `apps/backend-legacy` backend API.
3. Supabase stack (self-hosted) for cloud operational data.

### Customer Local Machine
1. Bot-Mox Agent.
2. Local secret vault (credentials never leave local machine in MVP policy).
3. Outbound WSS tunnel to control-plane (no inbound ports, NAT-safe).

## Data Policy
1. `secrets`: local-only (agent vault).
2. `operational`: cloud by default, local mode optional per tenant.
3. `billing/license/audit`: cloud only.

## API and Contract Principles
1. Keep all existing `/api/v1/*` routes stable for frontend compatibility.
2. Introduce backend storage adapter strategy behind existing route handlers.
3. Enforce tenant-scoped data access in all backends.

## Implementation Steps (Detailed)

### Step 1: Dev Infrastructure
1. Add root scripts for `supabase start|stop|status`.
2. Add bootstrap script to auto-write backend Supabase env (`dev:supabase:bootstrap-env`).
3. Add local Docker compose for frontend/backend development.
4. Add Supabase config and initial SQL migration for `storage_policies`.

### Step 2: Backend Switch
1. Extend backend env config with:
   - `DATA_BACKEND`,
   - `SUPABASE_URL`,
   - `SUPABASE_SERVICE_ROLE_KEY`.
2. Add Supabase client factory and repository module for storage policy.
3. Update settings route to dispatch `storage_policy` reads/writes to Supabase when enabled.
4. Keep RTDB fallback for all other settings paths.

### Step 3: Validation
1. Backend syntax/smoke checks.
2. Frontend typecheck/lint/build checks.
3. Manual API sanity checks:
   - read/write `storage_policy` in RTDB mode,
   - read/write `storage_policy` in Supabase mode.

## Acceptance Criteria For This Iteration
1. A new teammate can run local Supabase and app stack from documented commands.
2. Backend boots with `DATA_BACKEND=rtdb` and behaves exactly as before.
3. Backend boots with `DATA_BACKEND=supabase` and stores `storage_policy` in Supabase.
4. Frontend settings page remains functional without API contract changes.

## Risks and Mitigations
1. Risk: Partial migration complexity.
   - Mitigation: path-by-path adapter routing, no big-bang rewrite.
2. Risk: Misconfigured Supabase env.
   - Mitigation: explicit config validation + clear API errors.
3. Risk: Drift between RTDB and Supabase.
   - Mitigation: strict feature-flag routing and phased cutover plan.

## Follow-up Phases
1. Agent registration and WSS tunnel protocol.
2. Supabase adapters for resources/workspace/bots/finance domains.
3. Migration tooling and cutover checklist.
4. VPS production hardening: backups, observability, rollout strategy.
