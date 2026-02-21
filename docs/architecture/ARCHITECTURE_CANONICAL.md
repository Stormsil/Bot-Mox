# Bot-Mox Architecture Canonical

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-19  
Applies To: Full Monorepo  
Non-goals: Product feature specs  
Related Checks: `check:all:mono`, `contract:check`, `db:types:check`

## Runtime Topology

1. Frontend: `apps/frontend` (React 19, Vite 7, Refine 5, Ant Design 5, TanStack Query 5).
2. Backend: `apps/backend` (NestJS 11 modular monolith, `/api/v1/*`).
3. Agent: `apps/agent` (Electron + TypeScript).
4. Shared packages: `packages/api-contract`, `packages/database-schema`, `packages/shared-types`, `packages/ui-kit`, `packages/utils`.
5. Infra stack: Docker Compose + Caddy + Supabase + MinIO in `deploy/*`.

## Dependency Direction (Must)

1. Frontend and agent consume backend only via HTTP contracts from `@botmox/api-contract`.
2. Backend controllers validate boundaries with Zod schemas from contract/shared packages.
3. Database shape is controlled by `supabase/migrations/*`; generated types live in `packages/database-schema`.
4. UI layers must not directly own transport logic; server-state belongs to query/model layers.

## Backend Modules (Current)

App module: `apps/backend/src/modules/app.module.ts`.

Modules:
1. `health`
2. `infra-gateway`
3. `observability`
4. `auth`
5. `artifacts`
6. `infra`
7. `bots`
8. `vm-ops`
9. `agents`
10. `resources`
11. `secrets`
12. `settings`
13. `theme-assets`
14. `vm`
15. `workspace`
16. `finance`
17. `ipqs`
18. `license`
19. `provisioning`
20. `playbooks`
21. `wow-names`

## Frontend Domain Map

Primary domains in `apps/frontend/src/entities/*`:
1. `bot`
2. `finance`
3. `notes`
4. `resources`
5. `settings`
6. `vm`
7. `workspace`

Cross-domain composition happens in:
1. `features/*`
2. `pages/*`
3. `providers/*`

## Architecture Rules (Hard)

1. Allowed stack is fixed: React + Refine + AntD on frontend, NestJS on backend, Electron for agent.
2. No ad-hoc framework substitution without ADR and explicit approval.
3. No direct service/data imports from UI presentation layer.
4. No new deprecated aliases/naming in active files.

## Historical Notes

Historical migration artifacts are kept under `docs/history/**`.
Use only canonical documents for current engineering decisions.
