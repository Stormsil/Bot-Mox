# Production Hardening Rollout Readiness

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-22  
Applies To: `apps/backend`, `apps/agent`, `apps/frontend`

## Summary

- Overall status: `PASS` (baseline readiness checks are green).

## Environment Checks

- PASS: AUTH_MODE is set (AUTH_MODE=enforced)
- PASS: AGENT_TRANSPORT is set (AGENT_TRANSPORT=ws)
- PASS: SECRETS_VAULT_MODE is set (SECRETS_VAULT_MODE=enforced)
- PASS: ADMIN_ORIGIN_ENFORCEMENT is set (ADMIN_ORIGIN_ENFORCEMENT=true)
- PASS: ADMIN_ORIGIN_STRICT is set (ADMIN_ORIGIN_STRICT=true)
- PASS: ADMIN_CORS_ORIGIN is set (set)
- PASS: BILLING_STUB_SELF_ACTIVATE is not true (BILLING_STUB_SELF_ACTIVATE=false)
- PASS: SUPABASE_URL present for enforced vault mode (set)
- PASS: SUPABASE_SERVICE_ROLE_KEY present for enforced vault mode (set)
- PASS: SUPABASE_VAULT_RPC_NAME present for enforced vault mode (set)
- PASS: SUPABASE_VAULT_ROTATE_RPC_NAME present for enforced vault mode (set)

## Command Checks

- PASS: pnpm run migration:check:strict (exit=0)
- PASS: pnpm run docs:check (exit=0)
- PASS: pnpm run check:admin:surface-isolation (exit=0)
- PASS: pnpm run smoke:admin-origin:e2e (exit=0)
- PASS: pnpm run smoke:admin-rbac:e2e (exit=0)
- PASS: pnpm run smoke:tenant-isolation:e2e (exit=0)
- PASS: pnpm run smoke:agents-tenant-isolation:e2e (exit=0)
- PASS: pnpm run check:db:rls (exit=0)
- PASS: pnpm run backend:test (exit=0)
- PASS: pnpm run agent:test (exit=0)
- PASS: pnpm run smoke:admin-projects:e2e (exit=0)
- PASS: pnpm run smoke:billing-admin:e2e (exit=0)

## Notes

- This report is a rollout-readiness snapshot and must be paired with the runbook: `docs/runbooks/production-hardening-rollout-checklist.md`.
- If running with `--with-checks`, command outputs should be reviewed in CI logs or local terminal output.

