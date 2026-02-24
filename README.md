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

Single-command deterministic localhost stack (canonical; rebuild + restart + DB migrations + agent):

```bash
pnpm run start:stack
```

Equivalent low-level command (kept for advanced use): `pnpm run stack:one:up`.

Run isolated admin control-plane UI (separate app shell):

```bash
pnpm run dev:admin
```

By default user-frontend `/admin/*` routes redirect to `http://localhost:5174/admin/access`.
Override via `VITE_ADMIN_APP_URL`.
In prod-sim stack this is typically `http://admin.localhost/admin/access`.

`stack:one:up` now uses the strict deterministic profile by default.
If you explicitly need a relaxed run (without forced full reset/no-cache/smoke):

```bash
pnpm run stack:one:up:relaxed
```

Full strict startup (includes admin projects rollout lifecycle smoke):

```bash
pnpm run stack:one:up:strict:full
```

By default `stack:one:up` reuses one stable admin account (`BOTMOX_ADMIN_EMAIL` / `BOTMOX_ADMIN_PASSWORD`) and does not auto-create users.  
Enable one-time creation only when needed with `BOTMOX_BOOTSTRAP_ENSURE_ADMIN=true` in `deploy/compose.prod-sim.env`.

Optional strict startup flags (recommended for flaky environments):
1. `BOTMOX_STACK_FULL_RESET=true` -> runs compose down with volume cleanup (`-v`)
2. `BOTMOX_BUILD_NO_CACHE=true` -> forces no-cache image rebuild
3. `BOTMOX_RUN_AUTH_SMOKE=true` -> runs auth/access E2E smoke right after health checks
4. `BOTMOX_RUN_ADMIN_PROJECTS_SMOKE=true` -> runs admin projects lifecycle E2E smoke

Example:

```bash
BOTMOX_STACK_FULL_RESET=true BOTMOX_BUILD_NO_CACHE=true BOTMOX_RUN_AUTH_SMOKE=true BOTMOX_RUN_ADMIN_PROJECTS_SMOKE=true pnpm run stack:one:up
```

Stop:

```bash
pnpm run stop:stack
```

Prod-like aliases now map to the same compose profile:
1. `dev:prodlike:up` -> strict deterministic startup (`stack:one:up`)
2. `dev:prodlike:down` -> prod-sim compose down
3. `dev:prodlike:restart` -> prod-sim down + strict startup

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
