# Production Hardening Smoke Window

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-20  
Applies To: `apps/backend`, `apps/agent`, `apps/frontend`

## Purpose

Operational evidence log for sustained prod-like smoke window before final strict-mode cutover.

## Entries

| Timestamp (UTC) | AUTH_MODE | AGENT_TRANSPORT | SECRETS_VAULT_MODE | Checks | Details |
| --- | --- | --- | --- | --- | --- |

| 2026-02-20T19:47:40.266Z | shadow | hybrid | shadow | not-run | checks not executed |
| 2026-02-20T19:52:38.635Z | shadow | hybrid | shadow | fail | 4 failed; first: pnpm run docs:check (exit=null) |
| 2026-02-20T19:53:08.896Z | shadow | hybrid | shadow | fail | 4 failed; first: pnpm.cmd run docs:check (exit=null) |
| 2026-02-20T19:53:33.793Z | shadow | hybrid | shadow | fail | 1 failed; first: pnpm run backend:test (exit=1) |
| 2026-02-20T19:58:18.888Z | shadow | hybrid | shadow | pass | 4/4 passed |
| 2026-02-20T20:13:55.643Z | shadow | hybrid | shadow | pass | 4/4 passed |
| 2026-02-20T20:16:45.757Z | shadow | hybrid | shadow | pass | 4/4 passed |
| 2026-02-20T20:23:14.192Z | shadow | hybrid | shadow | pass | 4/4 passed |
| 2026-02-20T20:25:59.642Z | shadow | hybrid | shadow | pass | 4/4 passed |
| 2026-02-20T20:30:12.051Z | shadow | hybrid | shadow | pass | 4/4 passed |
| 2026-02-20T20:32:49.332Z | (unset) | (unset) | (unset) | pass | 4/4 passed |
| 2026-02-20T20:33:53.996Z | shadow | hybrid | shadow | pass | 4/4 passed |
