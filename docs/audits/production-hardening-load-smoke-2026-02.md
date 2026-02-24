# Production Hardening Load Smoke

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-22  
Applies To: `apps/backend`, `apps/frontend`

## Purpose

Operational evidence log for multi-tenant load smoke gates before and after rollout waves.

## Entries

| Timestamp (UTC) | Users | Iterations | AUTH_MODE | AGENT_TRANSPORT | SECRETS_VAULT_MODE | Status | Details |
| --- | --- | --- | --- | --- | --- | --- | --- |

| 2026-02-22T01:09:25.392Z | 20 | 25 | (unset) | (unset) | (unset) | not-run | load smoke not executed |
| 2026-02-22T10:06:33.947Z | 20 | 25 | enforced | ws | enforced | fail | load smoke failed (exit=3221226505) |
| 2026-02-22T10:07:09.168Z | 20 | 25 | enforced | ws | enforced | pass | p99=97ms; 5xx=0.00%; 401=0.00%; sse_fail=0.00% |
