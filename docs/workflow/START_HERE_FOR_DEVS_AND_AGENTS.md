# Start Here For Devs And Agents

Status: Active  
Owner: Platform + DX  
Last Updated: 2026-02-19

## 1. Read Order

1. `docs/README.md`
2. `docs/workflow/DEV_WORKFLOW_CANONICAL.md`
3. `docs/architecture/ARCHITECTURE_CANONICAL.md`
4. `docs/standards/CODE_QUALITY_CONSTITUTION.md`
5. `docs/standards/AI_AGENT_DEVELOPMENT_RULES.md`

## 2. First Commands

```bash
pnpm install --frozen-lockfile
pnpm run doctor
pnpm run dev:prodlike:up
```

## 3. Mandatory Checks Before Commit

```bash
pnpm run docs:check
pnpm run check:all:mono
pnpm run smoke:prodlike
```

## 4. Quick Architecture Summary

1. `apps/frontend` -> UI and product workflows.
2. `apps/backend` -> Nest API + infra gateway.
3. `apps/agent` -> desktop execution agent.
4. `packages/*` -> shared contracts, schema types, utilities.

## 5. Non-Negotiables

1. Keep API compatibility at `/api/v1/*`.
2. Keep contract-first and Zod validation boundaries.
3. Keep UI boundaries and styling standards.
4. Do not reintroduce legacy naming or runtime layers.
5. Use `pnpm-lock.yaml` as the only lockfile in active tree.
6. Keep observability/debuggability first-class: structured logs + correlation context + reproducible bugfix flow.
