# Production Hardening Rollout Checklist

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-20  
Applies To: `apps/backend`, `apps/agent`, `apps/frontend`

## Purpose

This runbook defines the final rollout and stabilization loop for production-hardening changes before enabling strict modes by default.

## Preflight

1. Ensure `pnpm run check:all:mono` is green on the target branch.
2. Ensure `pnpm run backend:test` and `pnpm run agent:test` are green on the target branch.
3. Generate rollout readiness snapshot:
   - quick env-only snapshot: `pnpm run hardening:rollout:readiness`
   - full snapshot with command checks: `pnpm run hardening:rollout:readiness:checks`
   - output file: `docs/audits/production-hardening-rollout-readiness-YYYY-MM-DD.md`
4. Confirm current deployment flags are explicitly set:
   - `AUTH_MODE`
   - `AGENT_TRANSPORT`
   - `SECRETS_VAULT_MODE`
5. Confirm Supabase Vault envs are present for enforced mode:
   - `SUPABASE_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_VAULT_RPC_NAME`

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

## Daily Smoke Evidence Loop

1. Record one smoke-window entry at least once per day:
   - light record: `pnpm run hardening:smoke:record`
   - strict record with command checks: `pnpm run hardening:smoke:record:checks`
2. Verify entries are appended to:
   - `docs/audits/production-hardening-smoke-window-YYYY-MM.md`
3. Investigate immediately if any entry has `Checks = fail`.
4. Track current strict-pass streak:
   - `pnpm run hardening:smoke:streak`

## Exit Criteria

1. Seven consecutive days with:
   - no tenant isolation incidents,
   - no auth regression spikes,
   - stable WS command delivery,
   - no secret leakage incidents.
2. Smoke-window audit contains at least seven consecutive `pass` entries from strict records.
3. All strict gates continue passing in CI.
4. Audit record updated with final cutover note.
