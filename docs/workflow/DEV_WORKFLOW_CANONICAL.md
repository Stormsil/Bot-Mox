# Development Workflow Canonical

Status: Active  
Owner: Platform + DX  
Last Updated: 2026-02-19  
Applies To: Developers and AI agents  
Non-goals: Production runbook  
Related Checks: `docs:check`, `check:all:mono`

## Primary Workflow

Default local mode is production-like localhost through Caddy.

1. Start prod-like dev stack:
```bash
pnpm run dev:prodlike:up
```
2. Observe status:
```bash
pnpm run dev:prodlike:ps
pnpm run dev:prodlike:logs
```
3. Stop stack:
```bash
pnpm run dev:prodlike:down
```

## Fast Inner Loop (without full stack)

1. Backend:
```bash
pnpm run dev:backend
```
2. Frontend:
```bash
pnpm run dev:frontend
```
3. Agent:
```bash
pnpm run agent:dev
```

## Required Quality Gates Before Merge

1. `pnpm run check:all:mono`
2. `pnpm run docs:check`
3. `pnpm run contract:check`
4. `pnpm turbo run typecheck`
5. `pnpm turbo run build`
6. `pnpm run check:lockfiles`
7. `pnpm run smoke:prodlike` for cross-app/runtime changes (frontend/backend/infra/auth flows).

Documentation must be updated in the same PR for architecture/workflow-critical changes.
This is enforced by `pnpm run docs:change:policy`.

## Database and Contract Flow

1. Create/update migration in `supabase/migrations`.
2. Regenerate/check DB types:
```bash
pnpm run db:types
pnpm run db:types:check
```
3. Validate API contract package:
```bash
pnpm run contract:check
```

## PR Rules

1. If architecture/module boundaries changed, update canonical docs in same PR.
2. If new domain endpoint added, update `packages/api-contract` first.
3. If new page/feature added, follow frontend architecture + styling rules.
4. No merge with failing quality gates.
5. Refresh AI ingest maps when structure changes:
```bash
pnpm run repo:reports
```

## Continuous Delivery Cadence

1. Do not batch unrelated work for a weekly mega-PR.
2. Open PR immediately after a meaningful completed slice.
3. “Meaningful slice” means a self-contained change with passing checks and clear intent.
4. If hotspot warning appears for touched file, include split action now or create follow-up PR as the next slice.
5. Do not defer architecture/workflow doc updates to “later cleanup”.

## Agentic Debugging Workflow (Required for Bugfixes)

1. Reproduce issue with deterministic command or scenario.
2. Capture diagnostic context (correlation id, route/module, relevant logs/traces).
3. Isolate root cause and affected boundary (frontend/backend/agent/contract/db).
4. Add regression guard (test/check/invariant validation).
5. Apply fix with smallest safe scope.
6. Re-run mandatory gates + relevant smoke.
7. Document cause, fix, and guard in PR notes.

## Suggested Pre-Push Routine

```bash
pnpm run check:lockfiles
pnpm run check:file-size:budgets
pnpm run docs:check
```

## RU Notes

1. Каноничный режим разработки: через `pnpm` из корня монорепозитория.
2. Все архитектурные изменения сопровождаются обновлением canonical docs.
3. Lock policy: только `pnpm-lock.yaml`; `package-lock.json` запрещен.
