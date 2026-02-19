# Bot-Mox Architecture (Current State)

This document reflects the current implemented runtime, not target-only plans.

Last review date: **2026-02-19**.

## 1. Runtime Topology

Core runtime components:

1. Frontend control plane: `apps/frontend/` (`React + TypeScript + Vite + Refine + Ant Design`).
2. Backend API: `apps/backend/` (`NestJS`, canonical API namespace `/api/v1/*`).
3. Desktop agent: `apps/agent/` (`Electron + TypeScript`, Windows tray app for VM execution).
4. Production-like edge stack: `deploy/compose.stack.yml` (`caddy + frontend + backend + supabase + minio`).

## 2. Entry Points

1. Backend: `apps/backend/src/main.ts`.
2. Frontend: `apps/frontend/src/main.tsx` + `apps/frontend/src/App.tsx`.
3. Agent: `apps/agent/src/main/index.ts`.

## 3. Backend Architecture

Root module wiring: `apps/backend/src/modules/app.module.ts`.

Current modules:

1. `health`
2. `infra-gateway` (HTTP + WS proxy for infra UIs)
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

## 4. Data Layer

1. Primary runtime data backend: Supabase/Postgres (`DATA_BACKEND=supabase`).
2. Shared DB typing package: `packages/database-schema`.
3. API contract and shared Zod schemas: `packages/api-contract`.

## 5. API and Validation

1. Public API base path: `/api/v1/*`.
2. API contract source of truth: `packages/api-contract/src/contract.ts`.
3. Boundary validation: shared Zod schemas from `@botmox/api-contract` in Nest controllers and frontend/agent contract clients.

## 6. Agent and VM Operations

Agent loop (`apps/agent/src/core/agent-loop.ts`):

1. Pair/register with backend.
2. Heartbeat.
3. Poll queued command.
4. Execute locally in customer network.
5. Report status/result.

Command orchestration domain:

1. API routes: `/api/v1/vm-ops/*`, `/api/v1/agents/*`.
2. Queue/events and status flows are managed from backend modules (`vm-ops`, `agents`).

## 7. Security Model

1. Bearer auth for `/api/v1/*`.
2. Token sources: Supabase Auth JWT + scoped agent tokens + internal service tokens.
3. Tenant and role-based authorization (`api`, `admin`, `infra`) in backend auth context.
4. Secrets policy: ciphertext-only storage path in secrets domain.

## 8. Observability

1. Backend diagnostics and client-log ingest routes in `observability` module.
2. Frontend logs can be ingested via `/api/v1/client-logs`.
3. Local trace/testing workflow: `docs/plans/ai-native-observability-testing.md`.

## 9. Development Workflow

1. Default local workflow: `pnpm` + `turbo` commands from repo root.
2. Recommended stack mode: prod-like localhost via Caddy (`pnpm run dev:prodlike:up`).
3. Main quality gate: `pnpm run check:all:mono`.

References:

1. `docs/DEV-WORKFLOW.md`
2. `docs/runbooks/dev-workflow.md`
3. `docs/runbooks/vps-operations.md`
4. `docs/audits/enterprise-migration-2026-audit.md`
5. `docs/plans/enterprise-migration-2026-roadmap.md`
