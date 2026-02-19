# Bot-Mox

Bot-Mox is a SaaS control-plane and automation toolkit for bot infrastructure.

## Active Stack (Canonical)

1. Frontend: React 19 + Vite 7 + Refine 5 + Ant Design 5 + TanStack Query 5 (`apps/frontend`)
2. Backend: NestJS 11 modular monolith (`apps/backend`)
3. Agent: Electron + TypeScript (`apps/agent`)
4. Data: Supabase/Postgres + shared DB types (`packages/database-schema`)
5. Contract + validation: `@botmox/api-contract` + Zod
6. Monorepo tooling: pnpm + turbo

## Repository Layout

1. `apps/frontend` - web admin/control UI
2. `apps/backend` - API + infra gateway + domain modules
3. `apps/agent` - desktop execution agent
4. `packages/*` - shared contracts/types/utils/ui-kit
5. `docs` - canonical architecture/workflow/standards and audits
6. `deploy` - production-like compose stack + Caddy
7. `scripts` - checks, stack commands, operational tooling

## Quick Start

Prerequisites:
1. Node.js 20+
2. pnpm 10+ (`corepack enable`)
3. Docker Desktop

Install:

```bash
pnpm install --frozen-lockfile
```

Start production-like localhost stack:

```bash
pnpm run dev:prodlike:up
```

Stop:

```bash
pnpm run dev:prodlike:down
```

## Required Quality Gates

```bash
pnpm run docs:check
pnpm run check:all:mono
```

## Canonical Documentation

1. Start here: `docs/workflow/START_HERE_FOR_DEVS_AND_AGENTS.md`
2. Workflow: `docs/workflow/DEV_WORKFLOW_CANONICAL.md`
3. Architecture: `docs/architecture/ARCHITECTURE_CANONICAL.md`
4. Frontend architecture: `docs/frontend/FRONTEND_ARCHITECTURE_CANONICAL.md`
5. Backend architecture: `docs/backend/BACKEND_ARCHITECTURE_CANONICAL.md`
6. Agent architecture: `docs/agent/AGENT_ARCHITECTURE_CANONICAL.md`
7. Quality constitution: `docs/standards/CODE_QUALITY_CONSTITUTION.md`
8. AI development rules: `docs/standards/AI_AGENT_DEVELOPMENT_RULES.md`
9. Docs index: `docs/README.md`

Historical materials are archived in `docs/history/**`.
