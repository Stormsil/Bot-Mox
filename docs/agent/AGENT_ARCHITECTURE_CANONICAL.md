# Agent Architecture Canonical

Status: Active  
Owner: Agent Platform  
Last Updated: 2026-02-19  
Applies To: `apps/agent`  
Non-goals: Alternate desktop runtimes  
Related Checks: `agent:typecheck`, `contract:check`

## Stack

1. Electron
2. TypeScript
3. Zod validation for command payload boundaries
4. HTTP contract interoperability with backend via `@botmox/api-contract`

## Operational Flow

1. Pair/register against backend APIs.
2. Send heartbeat.
3. Poll command queue.
4. Execute command locally.
5. Report command status/result.

## Hard Rules

1. Agent must not define private ad-hoc API contract types for backend endpoints.
2. Command execution logs must remain structured and machine-readable.
3. Error payloads should preserve code/category details for diagnostics.

## Logging Schema (minimum)

Structured event fields:
1. `timestamp`
2. `severity`
3. `event_name`
4. `agent_id`
5. `command_id` (if applicable)
6. `trace_id`
7. `correlation_id`
8. `message`

## RU Notes

1. Агент работает только через общий контракт API.
2. Логирование должно быть структурированным, без свободного текстового хаоса.
