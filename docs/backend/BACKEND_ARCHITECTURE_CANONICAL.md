# Backend Architecture Canonical

Status: Active  
Owner: Backend Platform  
Last Updated: 2026-02-20  
Applies To: `apps/backend`  
Non-goals: Legacy runtime support  
Related Checks: `check:zod:boundaries`, `check:infra:gateway`, `contract:check`, `check:backend:syntax`

## Stack

1. NestJS 11
2. TypeScript strict mode
3. Zod-based boundary validation via shared contracts
4. Supabase/Postgres runtime data backend

## Runtime Rules

1. Public API namespace is `/api/v1/*`.
2. Controllers remain thin; business logic lives in services/use-case helpers.
3. All request/response payload boundaries are validated through contract/shared schemas.
4. No new Express runtime or legacy adapters in active backend runtime.
5. Auth mode is runtime-configurable via `AUTH_MODE` (default: `enforced`):
   - `shadow`: allow requests without hard-fail, attach shadow identity (`BOTMOX_SHADOW_TENANT_ID`, default `shadow-tenant`).
   - `enforced`: reject missing/invalid bearer token.
   - JWTs without explicit tenant claim are rejected in all modes (shadow fallback identity is applied by guard only when token verification fails).
6. Agent transport mode is runtime-configurable via `AGENT_TRANSPORT` (default: `ws`):
   - `longpoll`, `ws`, `hybrid`.
7. Backend runtime persistence is repository-only (Prisma/Postgres). In-memory Map fallback is not allowed in active modules.
8. Secrets material mode is runtime-configurable via `SECRETS_VAULT_MODE` (default: `enforced`):
   - `shadow`, `enforced`.
   - Missing Vault RPC config is fail-fast (no local fallback in active runtime).
   - `local-vault://` references are forbidden.
   - Strict migration profile (`migration:check:strict`) requires:
     - `SUPABASE_URL`
     - `SUPABASE_SERVICE_ROLE_KEY`
     - `SUPABASE_VAULT_RPC_NAME`
9. VM command lease reliability limits are runtime-configurable:
   - `BOTMOX_VMOPS_RUNNING_MAX_MS` (running lease timeout, min 60000)
   - `BOTMOX_VMOPS_DISPATCHED_MAX_MS` (dispatched/ack timeout, min 15000)
   - `BOTMOX_VMOPS_DISPATCH_MAX_REQUEUES` (max stale-dispatched requeues before dead-letter, default 2)
10. Artifact download resolution requires an active lease token bound to:
   - tenant,
   - vm UUID,
   - module.
11. HTTP exceptions are normalized by a global error filter to contract-friendly envelope:
   - `{ success: false, error: { code, message, details? } }`.

## Module Organization

Backend modules are organized by domain in `src/modules/*` and wired in app module.
Cross-cutting concerns:
1. `auth`
2. `observability`
3. `infra-gateway`
4. `health`

## Infra Gateway

`infra-gateway` owns HTTP reverse proxy routes and websocket upgrade handling for infra UI integration.
No duplicate proxy implementation is allowed outside this module.

## Agent WS Channel

1. Backend exposes websocket endpoint `GET /api/v1/agents/ws`.
2. Bearer auth is required via header or `token` query for agent handshake.
3. Supported message types:
   - `connected` (server handshake event)
   - `error` (server envelope for invalid WS messages/state)
   - `next_command` (server replies with `agent.command.assigned`)
   - `heartbeat` (server replies with `agent.heartbeat`)
   - `agent.command.ack` (server moves command to `running`, replies `agent.command.ack`)
   - `agent.command.progress` (server refreshes `running` status, replies `agent.command.progress`)
   - `agent.command.result` (server stores terminal result, replies `agent.command.result`)
4. HTTP `vm-ops/commands/next` remains valid as fallback for hybrid rollout.
5. Reliability sweeper:
   - expires stale `running` commands,
   - requeues stale `dispatched` commands up to configured retry limit,
   - then dead-letters stale `dispatched` commands after max retries,
   and emits structured warning logs.

## Logging and Observability

1. Use structured logs only.
2. Avoid `console.*` in backend source.
3. Preserve trace/correlation identifiers across request handling.

## RU Notes

1. NestJS — единственный backend framework в активном контуре.
2. Любой новый endpoint сначала фиксируется в контрактном пакете.
