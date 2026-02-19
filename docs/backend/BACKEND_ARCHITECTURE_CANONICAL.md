# Backend Architecture Canonical

Status: Active  
Owner: Backend Platform  
Last Updated: 2026-02-19  
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

## Logging and Observability

1. Use structured logs only.
2. Avoid `console.*` in backend source.
3. Preserve trace/correlation identifiers across request handling.

## RU Notes

1. NestJS — единственный backend framework в активном контуре.
2. Любой новый endpoint сначала фиксируется в контрактном пакете.
