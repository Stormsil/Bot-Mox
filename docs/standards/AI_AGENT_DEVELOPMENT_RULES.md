# AI Agent Development Rules

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-19  
Applies To: Any AI agent operating in this repository  
Non-goals: Product management instructions  
Related Checks: `docs:legacy:check`, `check:ui:boundaries`, `check:all:mono`, `smoke:prodlike`

## Mandatory Technology Baseline

1. Frontend: React 19 + Vite 7 + Refine 5 + Ant Design 5 + TanStack Query 5.
2. Backend: NestJS 11.
3. Agent: Electron + TypeScript.
4. Contracts: `@botmox/api-contract`.
5. Validation: Zod schemas from shared packages.

Do not introduce alternate frameworks without explicit architectural approval.

## Observability and Debugging (Mandatory)

1. AI agent must preserve and extend structured logging, not bypass it with ad-hoc `console.*`.
2. New operational paths must propagate correlation context (`x-correlation-id`, trace/span where available).
3. For backend and agent flows, failures must emit machine-readable error context.
4. Bugfix work must follow an agentic debugging loop:
   - reproduce,
   - isolate root cause,
   - add/adjust regression guard (test/check),
   - implement fix,
   - verify via checks and smoke.
5. “Fix without verification” is forbidden.

## Development Boundaries

1. Do not add direct API/service access inside pure UI components.
2. Do not add new legacy directories or names in active files.
3. Do not bypass contract package with duplicated DTO definitions.
4. Do not add global `.ant-*` overrides and avoid raw CSS literals when semantic tokens exist.

## Required Commands Before Handover

1. `pnpm run docs:check`
2. `pnpm run check:all:mono`
3. `pnpm run smoke:prodlike` for cross-app/runtime touching changes (frontend/backend/infra flows).

## PR Hygiene

1. Keep changes scoped and atomic.
2. Update canonical docs when boundaries/architecture change.
3. If introducing temporary workaround, include explicit removal plan.
4. After each completed semantic slice, open a PR immediately.
5. If touched file is hotspot-level, either split now or make split the very next PR.
6. Do not postpone documentation updates for architecture/workflow changes.

## Hotspot Response Rule

1. AI agent must treat oversized files as active debt, not background debt.
2. New logic should be added in extracted modules, not appended to existing hotspots.
3. If file-size warning is triggered, agent must include hotspot mitigation note in PR.

## RU Notes

1. ИИ-агент обязан следовать зафиксированному стеку.
2. Любое отклонение от стандартов должно быть явно обосновано и ограничено по времени.
