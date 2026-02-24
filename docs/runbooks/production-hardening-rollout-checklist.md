# Production Hardening Rollout Checklist

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-22  
Applies To: `apps/backend`, `apps/agent`, `apps/frontend`

## Purpose

This runbook defines the final rollout and stabilization loop for production-hardening changes before enabling strict modes by default.

## Preflight

0. Rebuild and start local prod-like stack in strict deterministic mode:
   - `pnpm run stack:one:up`
   - (`stack:one:up` is strict by default: full reset + no-cache rebuild + auth/access smoke + admin projects lifecycle smoke + billing admin smoke)
   - optional backward-compatible alias: `pnpm run stack:one:up:strict:full`
1. Ensure `pnpm run check:all:mono` is green on the target branch.
2. Ensure `pnpm run backend:test` and `pnpm run agent:test` are green on the target branch.
3. Ensure tenant RLS guard is green:
   - `pnpm run check:db:rls`
4. Generate rollout readiness snapshot:
   - quick env-only snapshot: `pnpm run hardening:rollout:readiness`
   - full snapshot with command checks: `pnpm run hardening:rollout:readiness:checks`
   - with admin creds, `hardening:rollout:readiness:checks` also enforces:
     - `hardening:data:record:strict` in dry-run mode
     - `hardening:secrets:record:strict` in dry-run mode
   - output file: `docs/audits/production-hardening-rollout-readiness-YYYY-MM-DD.md`
5. Confirm current deployment flags are explicitly set:
   - `AUTH_MODE`
   - `AGENT_TRANSPORT`
   - `SECRETS_VAULT_MODE`
6. Confirm Supabase Vault envs are present for enforced mode:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_VAULT_RPC_NAME`
   - `SUPABASE_VAULT_ROTATE_RPC_NAME`
7. Confirm content encryption envs are present:
   - `BOTMOX_DATA_ENCRYPTION_KEY`
   - `BOTMOX_DATA_ENCRYPTION_KEY_ID`
   - optional during rotation window: `BOTMOX_DATA_ENCRYPTION_KEYRING` (legacy decrypt keys)
8. Run multi-tenant load smoke before strict cutover:
   - `BOTMOX_ADMIN_EMAIL=admin@localhost BOTMOX_ADMIN_PASSWORD=<password> pnpm run smoke:load:multi-tenant`
9. Run admin projects lifecycle smoke (canary -> wave -> tenant rollback):
   - `BOTMOX_ADMIN_EMAIL=admin@localhost BOTMOX_ADMIN_PASSWORD=<password> pnpm run smoke:admin-projects:e2e`
10. Run billing admin smoke (revoke -> non-admin denied -> admin mock payment -> access restore):
   - `BOTMOX_ADMIN_EMAIL=admin@localhost BOTMOX_ADMIN_PASSWORD=<password> pnpm run smoke:billing-admin:e2e`
11. Run admin RBAC smoke (non-admin is denied across admin API surface):
   - `pnpm run smoke:admin-rbac:e2e`
12. Run admin origin policy smoke (admin endpoints are blocked for missing/foreign origin):
   - `pnpm run smoke:admin-origin:e2e`
13. Run tenant isolation smoke (data domains are isolated per tenant):
   - `pnpm run smoke:tenant-isolation:e2e`
14. Run agents tenant isolation smoke (cross-tenant agent operations are denied):
   - `pnpm run smoke:agents-tenant-isolation:e2e`

## Enforced Baseline

1. Use enforced defaults in dev/prod-like/CI:
   - `AUTH_MODE=enforced`
   - `AGENT_TRANSPORT=ws`
   - `SECRETS_VAULT_MODE=enforced`
2. Verify Vault env is present and valid in all environments.
3. Monitor auth failure rates, WS reconnect/latency, and vault RPC errors.
4. Any fallback profile usage is break-glass only and must be documented in the PR/runbook update.

## Observability Signals

Track these metrics during rollout:

1. Auth verification failures per minute.
2. WS reconnect attempts and median reconnect duration.
3. VM command lifecycle latency:
   - dispatch -> ack
   - ack -> terminal result
4. Reliability sweep counters:
   - stale dispatched requeues
   - dead-letter transitions
5. Vault adapter failures and RPC timeout/error rates.
6. Multi-tenant load smoke gates:
   - `status_5xx_rate <= 3%`
   - `status_401_rate <= 2%`
   - `sse_fail_rate <= 5%`
   - overall `p99 <= 2500ms` (adjust per infra class)
7. Runtime metrics snapshot endpoint:
   - `GET /api/v1/diag/runtime-metrics`
   - watch counters: `auth.failures.401`, `auth.failures.403`, `http.failures.5xx`, `sse.opened/sse.closed`, `ws.opened/ws.closed/ws.rejected`.

## Daily Smoke Evidence Loop

1. Record one smoke-window entry at least once per day:
   - light record: `pnpm run hardening:smoke:record`
   - strict record with command checks: `pnpm run hardening:smoke:record:checks`
   - with admin creds, `hardening:smoke:record:checks` also enforces:
     - `hardening:data:record:strict` in dry-run mode
     - `hardening:secrets:record:strict` in dry-run mode
2. Verify entries are appended to:
   - `docs/audits/production-hardening-smoke-window-YYYY-MM.md`
3. Investigate immediately if any entry has `Checks = fail`.
4. Track current strict-pass streak:
   - `pnpm run hardening:smoke:streak`
5. Record one load-smoke entry at least for each rollout wave:
   - metadata only: `pnpm run hardening:load:record`
   - run + strict gate: `pnpm run hardening:load:record:checks`
6. Verify load entries are appended to:
   - `docs/audits/production-hardening-load-smoke-YYYY-MM.md`
7. Record one data-encryption rotation audit entry for each planned key rotation window:
   - metadata/audit only: `pnpm run hardening:data:record`
   - strict gate: `pnpm run hardening:data:record:strict`
   - expected domain coverage in report details:
     - `workspace`, `finance`, `settings`, `resources`, `playbooks`, `bots`, `artifacts`, `theme`, `license`, `provisioning`, `infra`, `vmops`
8. Verify data-encryption audit entries are appended to:
   - `docs/audits/data-encryption-rotation-YYYY-MM.md`
9. Record one runtime-metrics snapshot entry for auth/http/ws/sse counters:
   - metadata/audit only: `pnpm run hardening:runtime:record`
   - strict gate: `pnpm run hardening:runtime:record:strict`
10. Verify runtime-metrics audit entries are appended to:
   - `docs/audits/production-hardening-runtime-metrics-YYYY-MM.md`
11. Record one secrets-rotation audit entry for each planned secret key rotation window:
   - metadata/audit only: `pnpm run hardening:secrets:record`
   - strict gate: `pnpm run hardening:secrets:record:strict`
12. Verify secrets-rotation audit entries are appended to:
   - `docs/audits/secrets-rotation-YYYY-MM.md`

## Exit Criteria

1. Seven consecutive days with:
   - no tenant isolation incidents,
   - no auth regression spikes,
   - stable WS command delivery,
   - no secret leakage incidents.
2. Smoke-window audit contains at least seven consecutive `pass` entries from strict records.
3. All strict gates continue passing in CI.
4. Audit record updated with final cutover note.
