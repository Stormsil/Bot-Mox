# Enterprise Migration 2026 Audit (Evergreen)

Last updated (UTC): **2026-02-19T18:23:56Z**
Owner: Platform / Architecture
Source roadmap: `docs/plans/enterprise-migration-2026-roadmap.md`

Note: historical evidence lists may include legacy path references as archival migration trace.

## Objective

Track implementation progress for migration from current multi-app repository to enterprise platform architecture.

## Wave Progress (Plan Cutover)

- `GREEN` Wave 0: `frontend-polish` integrated into enterprise baseline with conflict resolution and passing mono quality gate.
- `GREEN` Wave 1 (current scope): active workspace/apps renamed to `apps/frontend`, `apps/backend`, `apps/agent`, wrapper packages removed, root scripts rewired.
- `GREEN` Wave 2+: contract coverage expansion closed for migrated domains (`infra/vm/artifacts/secrets/observability`) and runtime path is Nest-only.
- `WIP` Wave 2 update: observability contract coverage started (`diag/client-logs`) with shared `api-contract` schemas and route definitions.
- `WIP` Wave 2 update: contract coverage expanded for legacy parity routes in `secrets`, `vm`, `artifacts`, `infra`, and `vm-ops` command `create/list` with shared `api-contract` schemas and routes.
- `WIP` Wave 2 update: strangler parity gate extended with runtime contract assertions for `vm`, `secrets`, `artifacts`, `infra`, and `vm-ops` `commands create/list` endpoints.
- `WIP` Wave 3 update: Nest `vm` + `secrets` modules are now live in `apps/backend` and connected to strangler routing gate coverage (`proxy`, `fallback`, `no-fallback`) for `GET /api/v1/secrets/bindings`.
- `WIP` Wave 3 update: Nest `infra` module is now live in `apps/backend` (proxmox + ssh routes from `api-contract`) and covered in strangler routing gate across proxy/fallback/no-fallback paths for `GET /api/v1/infra/proxmox/status`.
- `WIP` Wave 3 update: Nest `artifacts` module is now live in `apps/backend` (`releases/assign/get-assignment/resolve-download`) and covered in strangler routing gate across proxy/fallback/no-fallback paths.
- `WIP` Wave 3 update: Nest `observability` module is now live in `apps/backend` (`GET /api/v1/diag/trace`, `POST /api/v1/client-logs`) and covered in strangler routing gate across proxy/fallback/no-fallback paths.
- `WIP` Wave 4 update: Nest `infra-gateway` middleware module is now live in `apps/backend` for HTTP reverse-proxy of infra UI prefixes (`/proxmox-ui`, `/api2`, `/pve2`, `/novnc`, `/xtermjs`, `/tinyfm-ui`, `/syncthing-ui`) with security-header strip and redirect rewrite parity.
- `WIP` Wave 4 update: websocket upgrade handling for infra UI prefixes (`/proxmox-ui`, `/tinyfm-ui`, `/syncthing-ui`) is now attached in `apps/backend` bootstrap via `infra-gateway` upgrade handler.
- `GREEN` Wave 4 update: dedicated Nest infra-gateway parity/smoke check (`check:infra:gateway`) now validates HTTP + websocket proxy behavior and is wired into `check:all:mono`.
- `WIP` Wave 3 update: Nest `vm-ops` module now covers command lifecycle parity (`POST/GET /commands`, `GET /commands/next`, `GET/PATCH /commands/:id`) plus SSE stream parity for `GET /api/v1/vm-ops/events`.
- `WIP` Wave 3 update: Nest observability parity expanded with OTLP proxy endpoint support (`POST /api/v1/otel/v1/traces`) behind `BOTMOX_OTEL_PROXY_ENABLED`, preserving legacy proxy semantics.
- `WIP` Wave 4 update: local dev defaults now target Nest backend runtime (`start-dev.js` starts `apps/backend` and frontend runtime defaults moved to `http://localhost:3002` / `ws://localhost:3002`).
- `GREEN` Wave 5 prep: root quality gates and dev commands are Nest-first only (`check:backend:syntax/smoke`, `dev:mono`, `check:all:mono`); legacy runtime scripts were removed from active root workflow.
- `GREEN` Wave 5 prep: Zod boundary gate now validates Nest controllers + agent boundaries only (legacy route path removed from active check surface).
- `GREEN` Wave 5 prep: local Supabase bootstrap env writer now targets `apps/backend/.env` for Nest-first development flow.
- `GREEN` Wave 5 prep: active frontend/agent dev+E2E defaults aligned to Nest port `3002` (`BOTMOX_BACKEND_PORT` first, compatibility fallback to legacy proxy var preserved).
- `GREEN` Wave 5 prep: `@botmox/api-contract` runtime export path aligned to `dist` with explicit backend/frontend prebuild hooks, unblocking Nest `dist` runtime start path.
- `GREEN` Wave 5 prep: Nest runtime DI hardening completed for migrated modules (type-only service import regressions removed), and backend runtime dependency baseline updated (`class-validator`, `class-transformer`).
- `WIP` Wave 5 update: prod-like image/build path switched from `apps/backend-legacy` to `apps/backend` (`apps/backend/Dockerfile`, root-context builds in stack scripts and GHCR image workflow), with stack/caddy/backend defaults aligned to port `3002`.
- `GREEN` Wave 5 update: local prod-sim runtime defaults aligned to Nest cutover (`deploy/compose.prod-sim.env` images + `BACKEND_PORT=3002`, artifacts smoke default `API_BASE_URL=http://localhost:3002`).
- `GREEN` Wave 5 update: active frontend/e2e/dev docs and scripts decoupled from legacy proxy naming (`apps/frontend/README.md`, `scripts/README.md`, `scripts/check-pnpm-first.js`, `apps/frontend/playwright.config.ts` no longer depend on `BOTMOX_PROXY_PORT`).
- `GREEN` Wave 5 update: active architecture/runbook docs switched to Nest-first source-of-truth (`README.md`, `docs/ARCHITECTURE.md`, `docs/AUTH.md`, `docs/runbooks/dev-workflow.md`, `docs/api/openapi.yaml` now point to `apps/backend` and localhost `3002`).
- `GREEN` Wave 5 update: root command surface de-legacy completed (`package.json` no longer exposes `dev:backend:legacy`, `dev:mono:with-legacy`, or legacy backend syntax/smoke checks), and default mono gate is Nest-first.
- `GREEN` Wave 5 update: firebase decommission audit runtime scope switched to active runtime apps (`apps/backend/src`, `apps/frontend/src`, `apps/agent/src`).
- `GREEN` Wave 5 update: active source-of-truth docs no longer document `apps/backend-legacy` as part of default workflow (`README.md`, `docs/ARCHITECTURE.md`, `docs/runbooks/dev-workflow.md` now describe Nest-only runtime).
- `GREEN` Wave 5 update: `pnpm` workspace scope is now active-app-only (`apps/frontend`, `apps/backend`, `apps/agent`); lockfile consistency (`pnpm install --frozen-lockfile`) remains green.
- `GREEN` Wave 5 update: pnpm-first guard now scans active workspace manifests only.
- `GREEN` Wave 5 update: legacy backend runtime and strangler parity scripts removed from repository active tree (`apps/backend-legacy` + `scripts/check-strangler-*.cjs` + `scripts/check-legacy-contract-adapters.js`).
- `GREEN` Wave 4 follow-up: legacy UI proxy bootstrap retired from runtime path (Nest infra-gateway is the only active proxy/ws layer).
- `GREEN` Wave 0 verification: frontend-polish branch content is present in current integration branch (`git rev-list --left-right --count HEAD...frontend-polish/frontend-polish` -> `3 0`, i.e. no missing commits on polish side).

## Status Legend

- `TODO`: not started
- `WIP`: in progress
- `GREEN`: implemented and verified
- `BLOCKED`: waiting for dependency/decision

## Phase Board

### Phase 0 — Repo Foundation

- [x] `GREEN` Introduce workspace topology (`pnpm-workspace.yaml`).
- [x] `GREEN` Add turbo pipeline (`turbo.json`).
- [x] `GREEN` Add monorepo app wrappers in `apps/*`.
- [x] `GREEN` Add shared package skeleton in `packages/*`.
- [x] `GREEN` Generate `pnpm-lock.yaml` and validate root turbo graph execution path.
- [x] `GREEN` Make root mono quality gate executable (`check:all:mono` passes with turbo + biome).
- [x] `GREEN` Update primary developer workflow docs to `pnpm`-first command path.
- [x] `GREEN` Migrate GitHub CI workflow to `pnpm` workspace install/cache/commands.
- [x] `GREEN` Move root Supabase lifecycle scripts to `pnpm`-first execution (`corepack pnpm exec supabase ...`).
- [x] `GREEN` Add pnpm-first guard for root scripts (`check:pnpm:first`) and wire it into `check:all:mono`.
- [x] `GREEN` Expand pnpm-first guard to all repository manifests (`**/package.json`) and remove remaining `npm run` calls from agent dev/build scripts.
- [x] `GREEN` Move critical local orchestration scripts to `pnpm/corepack` execution path (`start-dev.js`, Supabase bootstrap, DB types scripts, AntD compatibility gate) and enforce it in pnpm-first guard.
- [x] `GREEN` Align app-level developer docs to `pnpm` command path (`apps/backend-legacy/README.md`, `apps/frontend/README.md`).
- [x] `GREEN` Refresh strangler module examples in runbook/env template to match migrated Nest module set.
- [x] `GREEN` Move local compose dev flows from npm to `corepack pnpm` (`docker-compose.local.yml`, `deploy/compose.dev.override.yml`) and align contributor/local env docs (`CONTRIBUTING.md`, `deploy/compose.prod-sim.env.example`).
- [x] `GREEN` Close pnpm-first MCP setup tail by switching `mcp:antd:setup` to local Node workflow (`scripts/setup-mcp-antd-docs.js`) and removing npm-script allowlist exceptions.
- [x] `GREEN` Convert all CI/local flows from npm orchestration to pnpm/turbo-first.

Evidence:
1. `pnpm-workspace.yaml`
2. `turbo.json`
3. `apps/frontend/package.json`
4. `apps/backend-legacy/package.json`
5. `apps/agent/package.json`
6. `apps/backend/package.json`
7. `packages/shared-types/package.json`
8. `packages/database-schema/package.json`
9. `packages/api-contract/package.json`
10. `packages/ui-kit/package.json`
11. `packages/utils/package.json`
12. `package.json`
13. `pnpm-lock.yaml`
14. `turbo.json`
15. `README.md`
16. `docs/DEV-WORKFLOW.md`
17. `docs/runbooks/dev-workflow.md`
18. `.github/workflows/ci.yml`
19. `package.json`
20. `scripts/check-pnpm-first.js`
21. `docs/runbooks/dev-workflow.md`
22. `apps/backend-legacy/.env.example`
23. `scripts/check-pnpm-first.js`
24. `agent/package.json`
25. `start-dev.js`
26. `scripts/bootstrap-supabase-env.ps1`
27. `packages/database-schema/scripts/generate-supabase-types.mjs`
28. `packages/database-schema/scripts/check-generated-types.mjs`
29. `scripts/check-antd6-compatibility.js`
30. `scripts/check-pnpm-first.js`
31. `apps/backend-legacy/README.md`
32. `apps/frontend/README.md`
33. `docker-compose.local.yml`
34. `deploy/compose.dev.override.yml`
35. `CONTRIBUTING.md`
36. `deploy/compose.prod-sim.env.example`
37. `scripts/setup-mcp-antd-docs.js`
38. `package.json` (`mcp:antd:setup`)

### Phase 1 — Contract Spine (ts-rest)

- [x] `GREEN` Create `packages/api-contract` with typed contract + Zod schemas.
- [x] `GREEN` Expand `resources` contract slice to full CRUD (list/get/create/update/delete) with compatibility alias for update.
- [x] `GREEN` Wire `apps/backend-legacy` handlers to centralized contract adapters/schemas and enforce it with automated gate checks.
- [x] `GREEN` Replace selected frontend client path with contract client (`resources` full CRUD in `data-provider`).
- [x] `GREEN` Replace selected frontend VM/agent path with contract client (`agents list`, `agent pairing create`, `vm-ops dispatch/status` in `vmOpsService`).
- [x] `GREEN` Replace selected frontend bot path with contract client (`useBotQueries`/`useBotMutations` via `bot-contract-client`).
- [x] `GREEN` Replace frontend data-provider bot CRUD path with contract client (`getList/getOne/getMany/create/update/deleteOne` for `bots` resource).
- [x] `GREEN` Expand `bots` contract slice with typed lifecycle routes (`GET lifecycle/transitions/is-banned`, `POST transition/ban/unban`).
- [x] `GREEN` Replace frontend bot lifecycle service path with contract client (`botLifecycleService` via `bot-contract-client`).
- [x] `GREEN` Expand `playbooks` contract slice with typed routes (`list/get/create/update/delete/validate`) and explicit `422` validation branch.
- [x] `GREEN` Replace frontend playbook service path with contract client (`playbookService` via `playbook-contract-client`).
- [x] `GREEN` Expand `workspace` contract slice with typed notes/calendar/kanban CRUD routes.
- [x] `GREEN` Replace frontend workspace service path with contract client (`workspace-contract-client` for calendar/kanban list + CRUD).
- [x] `GREEN` Replace frontend notes service path with contract client for workspace notes list/CRUD flow.
- [x] `GREEN` Expand `finance` contract slice with typed operations CRUD + `daily-stats` + `gold-price-history` routes.
- [x] `GREEN` Replace frontend finance service operations/stats/history path with contract client (`finance-contract-client`).
- [x] `GREEN` Expand `wow-names` contract route with typed query/response envelopes (`GET /api/v1/wow-names`).
- [x] `GREEN` Replace frontend wow-names service path with contract client (`wow-names-contract-client`).
- [x] `GREEN` Expand `ipqs` contract routes with typed status/check/check-batch envelopes.
- [x] `GREEN` Replace frontend ipqs backend path with contract client (`ipqs-contract-client`).
- [x] `GREEN` Expand `settings` contract routes with typed envelopes (`GET/PUT api_keys`, `GET/PUT proxy`, `GET/PUT notifications/events`) with nullable GET parity for legacy data shape.
- [x] `GREEN` Replace frontend settings backend path with contract client (`settings-contract-client`) for `apiKeysService` network calls.
- [x] `GREEN` Expand `theme-assets` contract routes with typed envelopes (`list`, `presign-upload`, `complete`, `delete`).
- [x] `GREEN` Replace frontend theme-assets service path with contract client (`theme-assets-contract-client`) for list/upload/delete flow.
- [x] `GREEN` Expand vm-ops contract with typed agent command routes (`GET /api/v1/vm-ops/commands/next`, `PATCH /api/v1/vm-ops/commands/:id`) for long-poll and status update flows.
- [x] `GREEN` Expand remaining legacy contract surface with typed routes for `vm` (`register/resolve`), `secrets` (`create/meta/rotate/bindings`), `artifacts` (`releases/assign/resolve-download`), `infra` (proxmox+ssh command surface), and `vm-ops` (`POST/GET /commands`).
- [x] `GREEN` Extend strangler parity checks to assert new legacy contract routes (`vm`, `secrets`, `artifacts`, `infra`, `vm-ops commands create/list`) against shared `api-contract` response schemas.
- [x] `GREEN` Expand license runtime contract routes with typed envelopes (`POST /api/v1/license/lease`, `POST /api/v1/license/heartbeat`, `POST /api/v1/license/revoke`) including validation and not-found branches.
- [x] `GREEN` Expand provisioning contract routes with typed envelopes (`unattend-profiles` CRUD + `POST /api/v1/provisioning/generate-iso-payload`) and wire them into strangler parity checks.
- [x] `GREEN` Expand observability contract routes for legacy parity (`GET /api/v1/diag/trace`, `POST /api/v1/client-logs`) with shared Zod schemas for diagnostics payload and frontend log-ingest batches.
- [x] `GREEN` Remove Nest schema drift by reusing `@botmox/api-contract` schemas in `agents`/`vm-ops`/`resources` controllers.
- [x] `GREEN` Align runtime contract package build for Node ESM execution (dist imports resolve correctly in CI/runtime scripts).
- [x] `GREEN` Keep `agentsList` contract parity with runtime validation (`400` branch included).
- [x] `GREEN` Align auth runtime behavior with contract for strangler compatibility (`GET /api/v1/auth/verify` returns `valid` envelope in both legacy and Nest).

Evidence:
1. `packages/api-contract/src/contract.ts`
2. `packages/api-contract/src/schemas.ts`
3. `packages/api-contract/src/index.ts`
4. `packages/api-contract/src/contract.ts` (`diagnosticsTrace`, `clientLogsIngest`)
5. `packages/api-contract/src/schemas.ts` (`diagnosticsTraceResponseSchema`, `clientLogsIngestSchema`)
6. `apps/frontend/src/providers/resource-contract-client.ts`
7. `apps/frontend/src/providers/data-provider.ts`
8. `apps/frontend/package.json`
7. `apps/frontend/src/providers/vmops-contract-client.ts`
8. `apps/frontend/src/services/vmOpsService.ts`
9. `apps/backend/src/modules/agents/agents.controller.ts`
10. `apps/backend/src/modules/vm-ops/vm-ops.controller.ts`
11. `apps/backend/src/modules/resources/resources.controller.ts`
12. `packages/api-contract/src/index.ts`
13. `packages/api-contract/src/contract.ts`
14. `apps/backend-legacy/src/modules/v1/auth.routes.js`
15. `apps/frontend/src/providers/auth-provider.ts`
16. `packages/api-contract/src/contract.ts`
17. `packages/api-contract/src/schemas.ts`
18. `apps/frontend/src/providers/bot-contract-client.ts`
19. `apps/frontend/src/entities/bot/api/useBotQueries.ts`
20. `apps/frontend/src/entities/bot/api/useBotMutations.ts`
21. `apps/frontend/src/providers/data-provider.ts`
22. `packages/api-contract/src/contract.ts`
23. `packages/api-contract/src/schemas.ts`
24. `apps/frontend/src/providers/workspace-contract-client.ts`
25. `apps/frontend/src/services/workspaceService.ts`
26. `packages/api-contract/src/contract.ts`
27. `packages/api-contract/src/schemas.ts`
28. `apps/frontend/src/services/notesService.ts`
29. `apps/frontend/src/providers/workspace-contract-client.ts`
30. `packages/api-contract/src/contract.ts`
31. `packages/api-contract/src/schemas.ts`
32. `apps/frontend/src/providers/finance-contract-client.ts`
33. `apps/frontend/src/services/financeService.ts`
34. `packages/api-contract/src/contract.ts`
35. `packages/api-contract/src/schemas.ts`
36. `apps/frontend/src/providers/bot-contract-client.ts`
37. `apps/frontend/src/services/botLifecycleService.ts`
38. `packages/api-contract/src/contract.ts`
39. `packages/api-contract/src/schemas.ts`
40. `apps/frontend/src/providers/playbook-contract-client.ts`
41. `apps/frontend/src/services/playbookService.ts`
42. `packages/api-contract/src/contract.ts`
43. `packages/api-contract/src/schemas.ts`
44. `apps/frontend/src/providers/wow-names-contract-client.ts`
45. `apps/frontend/src/services/wowNamesService.ts`
46. `packages/api-contract/src/contract.ts`
47. `packages/api-contract/src/schemas.ts`
48. `apps/frontend/src/providers/ipqs-contract-client.ts`
49. `apps/frontend/src/services/ipqsService.ts`
50. `packages/api-contract/src/contract.ts`
51. `packages/api-contract/src/schemas.ts`
52. `apps/frontend/src/providers/settings-contract-client.ts`
53. `apps/frontend/src/services/apiKeysService.ts`
54. `packages/api-contract/src/schemas.ts`
55. `packages/api-contract/src/contract.ts`
56. `packages/api-contract/src/schemas.ts`
57. `packages/api-contract/src/contract.ts`
58. `packages/api-contract/src/contract.ts`
59. `packages/api-contract/src/schemas.ts`
60. `apps/frontend/src/providers/theme-assets-contract-client.ts`
61. `apps/frontend/src/services/themeAssetsService.ts`
62. `scripts/check-strangler-contract-parity.cjs`
63. `scripts/check-legacy-contract-adapters.js`
64. `package.json` (`check:all:mono`)

### Phase 2 — DB-First Types + Zod Everywhere

- [x] `GREEN` Create `packages/database-schema`.
- [x] `GREEN` Add Supabase type generation script.
- [x] `GREEN` Add generated types freshness check script.
- [x] `GREEN` Make Supabase type scripts Windows-safe (`corepack pnpm exec supabase ...` execution in shell mode).
- [x] `GREEN` Make `db:types:check` deterministic via migration hash metadata (no live Supabase hard dependency).
- [x] `GREEN` Reuse shared Zod boundary schemas from contract package in migrated Nest modules (`agents`, `vm-ops`, `resources`).
- [x] `GREEN` Extend shared Zod boundary schemas to workspace notes/calendar/kanban API routes and consume them in frontend contract client flow.
- [x] `GREEN` Extend shared Zod boundary schemas to finance operations API routes and consume them in frontend + Nest runtime flows.
- [x] `GREEN` Extend shared Zod boundary schemas to bot lifecycle API routes and consume them in frontend + Nest runtime flows.
- [x] `GREEN` Extend shared Zod boundary schemas to playbooks API routes and consume them in frontend + Nest runtime flows.
- [x] `GREEN` Extend shared Zod boundary schemas to wow-names API route and consume them in frontend + Nest runtime flows.
- [x] `GREEN` Extend shared Zod boundary schemas to ipqs status/check/check-batch routes and consume them in frontend + Nest runtime flows.
- [x] `GREEN` Extend shared Zod boundary schemas to settings (`api_keys`, `proxy`, `notifications/events`) and consume them in frontend contract-client flows.
- [x] `GREEN` Add Zod validation on agent runtime API boundaries (`api envelope` + `next queued command payload`) before command execution.
- [x] `GREEN` Add Zod validation for legacy vm-ops long-poll query boundary (`/commands/next`) with preserved timeout fallback semantics.
- [x] `GREEN` Extend shared Zod boundary schemas to license runtime routes (`lease`, `heartbeat`, `revoke`) and enforce them in contract parity checks.
- [x] `GREEN` Add Zod request-boundary validation for legacy `ipqs` (`check`, `check-batch`) and `wow-names` (query) routes.
- [x] `GREEN` Add Zod request-boundary validation for legacy `artifacts`/`agents`/`secrets` path-query boundaries (`artifacts assign`, `agents/:id`, `secrets/:id`, `secrets/bindings` query).
- [x] `GREEN` Add Zod request-boundary validation for legacy `infra` routes (`node/vmid/action/task` path params, delete flags query, sendkey body, ssh vm-config path).
- [x] `GREEN` Add Zod request-boundary validation for legacy `vm-ops` path params (`dispatch :action`, `commands/:id`) and provisioning progress path (`:vmUuid`).
- [x] `GREEN` Fix theme-assets delete route path validation bug (`idParamSchema` now validates `req.params` and passes `id` value).
- [x] `GREEN` Add Zod query-boundary validation for legacy `vm-ops` list/events routes (`/commands`, `/events`) with normalized optional query semantics.
- [x] `GREEN` Add schema-driven request validation for legacy `playbooks/validate` body (`playbookValidateBodySchema`) to remove manual parsing.
- [x] `GREEN` Add Zod wildcard-path input validation for legacy `settings/*` routes before segment normalization (`settingsPathInputSchema`).
- [x] `GREEN` Remove non-validated explicit id reads in legacy create routes by sourcing ids from parsed Zod payloads (`parsedBody.data.id`) for `bots`/`resources`/`workspace`/`finance`.
- [x] `GREEN` Extend shared Zod boundary schemas to `theme-assets` route payloads (`presign-upload`, `complete`) and enforce runtime parity in contract checks.
- [x] `GREEN` Normalize `jsonb` domain entities into typed DB-first projections across core runtime domains (`resources_subscriptions`, `resources_licenses`, `resources_proxies`, `finance_operations`, `workspace_notes`, `workspace_calendar_events`, `workspace_kanban_tasks`, `bots`) with compatibility-safe generated columns, constraints, and indexes.
- [x] `GREEN` Enforce Zod validation on all currently migrated payload boundaries across apps via automated boundary gate (`legacy v1 routes`, Nest controllers, and agent command/envelope boundaries).

Evidence:
1. `packages/database-schema/src/generated/supabase.types.ts`
2. `packages/database-schema/src/zod.ts`
3. `packages/database-schema/scripts/generate-supabase-types.mjs`
4. `packages/database-schema/scripts/check-generated-types.mjs`
5. `packages/database-schema/scripts/update-generated-types-meta.mjs`
6. `packages/database-schema/src/generated/supabase.types.meta.json`
7. `package.json` (`db:types`, `db:types:check`, `check:all:mono`)
8. `packages/api-contract/src/schemas.ts`
9. `apps/backend/src/modules/agents/agents.controller.ts`
10. `apps/backend/src/modules/vm-ops/vm-ops.controller.ts`
11. `apps/backend/src/modules/resources/resources.controller.ts`
12. `packages/api-contract/src/schemas.ts`
13. `packages/api-contract/src/contract.ts`
14. `apps/frontend/src/services/workspaceService.ts`
15. `apps/backend/src/modules/workspace/workspace.controller.ts`
16. `packages/api-contract/src/schemas.ts`
17. `apps/backend/src/modules/finance/finance.controller.ts`
18. `apps/frontend/src/services/financeService.ts`
19. `packages/api-contract/src/schemas.ts`
20. `apps/backend/src/modules/bots/bots.controller.ts`
21. `apps/frontend/src/services/botLifecycleService.ts`
22. `packages/api-contract/src/schemas.ts`
23. `apps/backend/src/modules/playbooks/playbooks.controller.ts`
24. `apps/frontend/src/services/playbookService.ts`
25. `packages/api-contract/src/schemas.ts`
26. `apps/backend/src/modules/wow-names/wow-names.controller.ts`
27. `apps/frontend/src/services/wowNamesService.ts`
28. `packages/api-contract/src/schemas.ts`
29. `apps/backend/src/modules/ipqs/ipqs.controller.ts`
30. `apps/frontend/src/services/ipqsService.ts`
31. `packages/api-contract/src/schemas.ts`
32. `packages/api-contract/src/contract.ts`
33. `apps/frontend/src/services/apiKeysService.ts`
34. `agent/src/core/schemas.ts`
35. `agent/src/core/api-client.ts`
36. `agent/src/core/agent-loop.ts`
37. `agent/package.json`
38. `apps/backend-legacy/src/contracts/schemas.js`
39. `apps/backend-legacy/src/modules/v1/vm-ops.routes.js`
40. `scripts/check-strangler-contract-parity.cjs`
41. `packages/api-contract/src/schemas.ts`
42. `packages/api-contract/src/contract.ts`
43. `apps/backend-legacy/src/modules/v1/ipqs.routes.js`
44. `apps/backend-legacy/src/modules/v1/wow-names.routes.js`
45. `apps/backend-legacy/src/contracts/schemas.js`
46. `apps/backend-legacy/src/modules/v1/artifacts.routes.js`
47. `apps/backend-legacy/src/modules/v1/agents.routes.js`
48. `apps/backend-legacy/src/modules/v1/secrets.routes.js`
49. `apps/backend-legacy/src/modules/v1/infra.routes.js`
50. `apps/backend-legacy/src/modules/v1/vm-ops.routes.js`
51. `apps/backend-legacy/src/modules/v1/provisioning.routes.js`
52. `apps/backend-legacy/src/modules/v1/theme-assets.routes.js`
53. `scripts/check-zod-boundaries.js`
54. `package.json` (`check:zod:boundaries`, `check:all:mono`)
53. `apps/backend-legacy/src/contracts/schemas.js`
54. `apps/backend-legacy/src/modules/v1/vm-ops.routes.js`
55. `apps/backend-legacy/src/modules/v1/playbooks.routes.js`
56. `apps/backend-legacy/src/modules/v1/settings.routes.js`
57. `apps/backend-legacy/src/modules/v1/bots.routes.js`
58. `apps/backend-legacy/src/modules/v1/resources.routes.js`
59. `apps/backend-legacy/src/modules/v1/workspace.routes.js`
60. `apps/backend-legacy/src/modules/v1/finance.routes.js`
61. `packages/api-contract/src/schemas.ts`
62. `packages/api-contract/src/contract.ts`
63. `scripts/check-strangler-contract-parity.cjs`
64. `supabase/migrations/20260219000100_normalize_resources_subscriptions_projection.sql`
65. `packages/database-schema/src/generated/supabase.types.meta.json`
66. `supabase/migrations/20260219000200_normalize_resources_finance_projections.sql`
67. `supabase/migrations/20260219000300_normalize_workspace_bots_settings_projections.sql`

### Phase 3 — NestJS Strangler

- [x] `GREEN` Bootstrap parallel Nest app in `apps/backend`.
- [x] `GREEN` Add first domain modules in Nest (`health`, `auth`, `agents`, `resources`, `vm-ops`).
- [x] `GREEN` Add env-gated route switch middleware in legacy Express.
- [x] `GREEN` Keep Nest strict typecheck green (`moduleResolution` alignment + null-safe resource store access).
- [x] `GREEN` Bring `resources` module to REST parity (`GET/POST/PATCH/DELETE` + list query/meta), keep `PUT` alias for migration compatibility.
- [x] `GREEN` Align `agents`/`vm-ops` Nest validation with contract package (`agentHeartbeat`, `agentList`, `pairing`, `vm dispatch/action`) to reduce drift during strangler phase.
- [x] `GREEN` Add `workspace` module in Nest with `notes/calendar/kanban` REST parity (`GET/POST/PATCH/DELETE` + list query/meta) and shared contract-schema validation.
- [x] `GREEN` Add `finance` module in Nest with operations REST parity (`GET/POST/PATCH/DELETE` + list query/meta) and shared contract-schema validation for operations/stats/history.
- [x] `GREEN` Add `bots` module in Nest with REST parity for bot CRUD + lifecycle (`GET lifecycle/transitions/is-banned`, `POST transition/ban/unban`) and shared contract-schema validation.
- [x] `GREEN` Add `playbooks` module in Nest with REST parity (`GET/POST/PUT/DELETE`, `POST validate`) and shared contract-schema validation.
- [x] `GREEN` Add `wow-names` module in Nest with legacy-compatible response parity (`count` + `batches`) and shared contract-schema validation.
- [x] `GREEN` Add `ipqs` module in Nest with contract-schema validation and legacy-compatible `status/check/check-batch` response envelopes.
- [x] `GREEN` Add `settings` module in Nest with contract-schema validation and legacy-compatible `api_keys/proxy/notifications/events` response envelopes.
- [x] `GREEN` Add `license` module in Nest with contract-schema validation and runtime parity for `lease/heartbeat/revoke` routes.
- [x] `GREEN` Add `theme-assets` module in Nest with contract-schema validation and runtime parity for `list/presign-upload/complete/delete` routes.
- [x] `GREEN` Expand `provisioning` module in Nest with contract-schema validation and runtime parity for `unattend-profiles` CRUD + provisioning bootstrap routes (`generate-iso-payload`, `validate-token`, `report-progress`, `progress/:vmUuid`).
- [x] `GREEN` Add `vm` module in Nest with contract-schema validation and runtime parity for `register/resolve` routes.
- [x] `GREEN` Add `secrets` module in Nest with contract-schema validation and runtime parity for `create/meta/rotate/bindings` routes.
- [x] `GREEN` Add `infra` module in Nest with contract-schema validation and runtime parity for proxmox/ssh routes (`status`, `clone`, `config`, `actions`, `sendkey`, `cluster-resources`, `ssh exec/vm-config`).
- [x] `GREEN` Add `artifacts` module in Nest with contract-schema validation and runtime parity for `releases/assign/get-assignment/resolve-download` routes.
- [x] `GREEN` Add `observability` module in Nest with contract-schema validation and runtime parity for `diag/client-logs` routes.
- [x] `GREEN` Extend parity coverage from migrated modules to all currently migrated strangler domains (`auth`, `agents`, `resources`, `workspace`, `finance`, `bots`, `playbooks`, `wow-names`, `ipqs`, `settings`, `theme-assets`, `license`, `vm`, `secrets`, `infra`, `artifacts`, `diag`, `client-logs`, `vm-ops`, `provisioning`).
- [x] `GREEN` Add automated parity contract checks for migrated legacy routes (`resources`, `agents`, `vm-ops`) including success + error branches.
- [x] `GREEN` Extend parity checks with `auth` routes (`verify`, `whoami`, unauthorized branch).
- [x] `GREEN` Extend parity checks with `bots` routes (`list/get/create/patch/delete`, validation errors, not-found branch).
- [x] `GREEN` Extend parity checks with `workspace` routes (`notes`/`calendar`/`kanban` list/get/create/patch/delete, validation errors, not-found branch).
- [x] `GREEN` Extend parity checks with `finance` routes (`operations` list/get/create/patch/delete, `daily-stats`, `gold-price-history`, validation errors, not-found branch).
- [x] `GREEN` Extend parity checks with `bots lifecycle` routes (`lifecycle`, `transitions`, `is-banned`, `transition`, `ban`, `unban`, validation errors branch).
- [x] `GREEN` Extend parity checks with `playbooks` routes (`list/get/create/update/delete/validate`, `422` yaml-validation branch, not-found branch).
- [x] `GREEN` Extend parity checks with `wow-names` route (`batches` + `count` response modes validated against contract `200` branch and invalid-query `400` branch).
- [x] `GREEN` Extend parity checks with `ipqs` routes (`status`, `check`, `check-batch`, including `400` validation branches).
- [x] `GREEN` Extend parity checks with `settings` routes (`api_keys`, `proxy`, `notifications/events`, including `400` validation branches and nullable GET response handling).
- [x] `GREEN` Extend parity checks with `theme-assets` routes (`list`, `presign-upload`, `complete`, `delete`, including `400`/`404` branches).
- [x] `GREEN` Extend parity checks with vm-ops command-agent routes (`GET /commands/next` forbidden+success+invalid-timeout branches, `PATCH /commands/:id` validation+success+not-found branches).
- [x] `GREEN` Extend parity checks with vm-ops dispatch invalid-action route branch (`POST /api/v1/vm-ops/proxmox/%20` -> contract `400`).
- [x] `GREEN` Extend parity checks with license runtime routes (`lease`, `heartbeat`, `revoke`, including `400` validation and `404` revoke-not-found branches).
- [x] `GREEN` Extend parity checks with provisioning routes (`unattend-profiles` CRUD + `generate-iso-payload` + VM bootstrap `validate-token/report-progress/progress`).
- [x] `GREEN` Harden provisioning parity checks with explicit not-found branches (`PUT /api/v1/unattend-profiles/:id`, `DELETE /api/v1/unattend-profiles/:id`, and `POST /api/v1/provisioning/generate-iso-payload` by missing `profile_id`).
- [x] `GREEN` Extend provisioning parity checks with explicit invalid-token branches (`401`) for `POST /api/v1/provisioning/validate-token` and `POST /api/v1/provisioning/report-progress`.
- [x] `GREEN` Add strangler routing gate for middleware behavior (`proxy -> nest`, `fallback -> legacy`, `502` when fallback disabled).
- [x] `GREEN` Extend strangler routing gate with `license` module behavior (`POST /api/v1/license/lease`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with `bots` module behavior (`GET /api/v1/bots`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with `theme-assets` module behavior (`GET /api/v1/theme-assets`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with `ipqs` and `workspace` module behavior (`GET /api/v1/ipqs/status`, `GET /api/v1/workspace/notes`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with `auth`, `agents`, `resources`, `finance`, `playbooks`, and `vm-ops` behavior (`GET /api/v1/auth/whoami`, `GET /api/v1/agents`, `GET /api/v1/resources/licenses`, `GET /api/v1/finance/operations`, `GET /api/v1/playbooks`, `GET /api/v1/vm-ops/commands`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with `secrets` module behavior (`GET /api/v1/secrets/bindings`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with `infra` module behavior (`GET /api/v1/infra/proxmox/status`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with `artifacts` module behavior (`GET /api/v1/artifacts/assign/:userId/:module`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with `diag` and `client-logs` module behavior (`GET /api/v1/diag/trace`, `POST /api/v1/client-logs`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with `wow-names` behavior (`GET /api/v1/wow-names`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with provisioning behavior across both route prefixes (`GET /api/v1/unattend-profiles`, `POST /api/v1/provisioning/generate-iso-payload`, `POST /api/v1/provisioning/validate-token`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Extend strangler routing gate with provisioning VM bootstrap progress behavior (`POST /api/v1/provisioning/report-progress`, `GET /api/v1/provisioning/progress/:vmUuid`) for proxy, fallback, and no-fallback paths.
- [x] `GREEN` Add strangler resolver alias so `/api/v1/unattend-profiles` resolves to `provisioning` module during route-switch checks.
- [x] `GREEN` Start Wave-4 infra UI cutover in Nest: add `infra-gateway` middleware module with HTTP reverse-proxy for UI prefixes (`proxmox/tinyfm/syncthing`) and location/header parity normalization.
- [x] `GREEN` Move websocket upgrade proxy handling to Nest runtime for infra UI prefixes (`/proxmox-ui`, `/tinyfm-ui`, `/syncthing-ui`) via backend bootstrap upgrade hook.
- [x] `GREEN` Add dedicated infra gateway parity/smoke gate (`scripts/check-infra-gateway.cjs`) and wire it into mono quality gate (`check:all:mono`).
- [ ] `TODO` Complete Wave-4 infra UI cutover: retire legacy UI proxy bootstrap.

Evidence:
1. `apps/backend/src/main.ts`
2. `apps/backend/src/modules/app.module.ts`
3. `apps/backend/src/modules/health/health.controller.ts`
4. `apps/backend/src/modules/auth/auth.controller.ts`
5. `apps/backend/src/modules/agents/agents.controller.ts`
6. `apps/backend/src/modules/resources/resources.controller.ts`
7. `apps/backend/src/modules/vm-ops/vm-ops.controller.ts`
8. `apps/backend-legacy/src/bootstrap/nest-strangler.js`
9. `apps/backend-legacy/src/config/env.js`
10. `apps/backend-legacy/src/legacy-app.js`
11. `apps/backend/tsconfig.json`
12. `apps/backend/src/modules/resources/resources.service.ts`
13. `scripts/check-strangler-contract-parity.cjs`
14. `package.json` (`check:strangler:parity`, `check:all:mono`)
15. `apps/backend-legacy/src/modules/v1/auth.routes.js`
16. `scripts/check-strangler-contract-parity.cjs`
17. `apps/backend-legacy/src/modules/v1/bots.routes.js`
18. `apps/backend-legacy/src/modules/v1/workspace.routes.js`
19. `apps/backend/src/modules/workspace/workspace.module.ts`
20. `apps/backend/src/modules/workspace/workspace.controller.ts`
21. `apps/backend/src/modules/workspace/workspace.service.ts`
22. `apps/backend/src/modules/finance/finance.module.ts`
23. `apps/backend/src/modules/finance/finance.controller.ts`
24. `apps/backend/src/modules/finance/finance.service.ts`
25. `scripts/check-strangler-contract-parity.cjs`
26. `apps/backend/src/modules/bots/bots.module.ts`
27. `apps/backend/src/modules/bots/bots.controller.ts`
28. `apps/backend/src/modules/bots/bots.service.ts`
29. `apps/backend-legacy/src/modules/v1/bots.routes.js`
30. `scripts/check-strangler-contract-parity.cjs`
31. `apps/backend/src/modules/playbooks/playbooks.module.ts`
32. `apps/backend/src/modules/playbooks/playbooks.controller.ts`
33. `apps/backend/src/modules/playbooks/playbooks.service.ts`
34. `apps/backend-legacy/src/modules/v1/playbooks.routes.js`
35. `scripts/check-strangler-contract-parity.cjs`
36. `apps/backend/src/modules/wow-names/wow-names.module.ts`
37. `apps/backend/src/modules/wow-names/wow-names.controller.ts`
38. `apps/backend/src/modules/wow-names/wow-names.service.ts`
39. `apps/backend-legacy/src/modules/v1/wow-names.routes.js`
40. `scripts/check-strangler-contract-parity.cjs`
41. `apps/backend/src/modules/ipqs/ipqs.module.ts`
42. `apps/backend/src/modules/ipqs/ipqs.controller.ts`
43. `apps/backend/src/modules/ipqs/ipqs.service.ts`
44. `apps/backend-legacy/src/modules/v1/ipqs.routes.js`
45. `scripts/check-strangler-contract-parity.cjs`
46. `apps/backend-legacy/src/modules/v1/settings.routes.js`
47. `scripts/check-strangler-contract-parity.cjs`
48. `apps/backend/src/modules/settings/settings.module.ts`
49. `apps/backend/src/modules/settings/settings.controller.ts`
50. `apps/backend/src/modules/settings/settings.service.ts`
51. `scripts/check-strangler-routing.cjs`
52. `package.json` (`check:strangler:routing`, `check:all:mono`)
53. `scripts/check-strangler-contract-parity.cjs`
54. `apps/backend-legacy/src/modules/v1/vm-ops.routes.js`
55. `apps/backend-legacy/src/modules/v1/license.routes.js`
56. `apps/backend-legacy/src/modules/license/service.js`
57. `scripts/check-strangler-contract-parity.cjs`
58. `apps/backend/src/modules/license/license.module.ts`
59. `apps/backend/src/modules/license/license.controller.ts`
60. `apps/backend/src/modules/license/license.service.ts`
61. `apps/backend/src/modules/app.module.ts`
62. `apps/backend-legacy/.env.example`
63. `docs/runbooks/dev-workflow.md`
64. `apps/backend-legacy/src/modules/v1/theme-assets.routes.js`
65. `apps/backend-legacy/src/modules/theme-assets/service.js`
66. `scripts/check-strangler-contract-parity.cjs`
67. `apps/backend/src/modules/theme-assets/theme-assets.module.ts`
68. `apps/backend/src/modules/theme-assets/theme-assets.controller.ts`
69. `apps/backend/src/modules/theme-assets/theme-assets.service.ts`
70. `apps/backend/src/modules/app.module.ts`
71. `scripts/check-strangler-routing.cjs`
72. `apps/backend-legacy/.env.example`
73. `docs/runbooks/dev-workflow.md`
74. `packages/api-contract/src/schemas.ts`
75. `packages/api-contract/src/contract.ts`
76. `apps/backend/src/modules/provisioning/provisioning.module.ts`
77. `apps/backend/src/modules/provisioning/provisioning.controller.ts`
78. `apps/backend/src/modules/provisioning/provisioning.service.ts`
79. `scripts/check-strangler-contract-parity.cjs`
80. `scripts/check-strangler-routing.cjs`
81. `apps/backend-legacy/src/bootstrap/nest-strangler.js`

### Phase 4 — Frontend FSD + Query Core

- [x] `GREEN` Add FSD foundation directories for app/entities/features/shared.
- [x] `GREEN` Add TanStack Query provider and first domain migration (Finance page).
- [x] `GREEN` Enforce lint rule that blocks API calls from UI components (bot + legacy subscription + bot/resource/license/settings/proxyData/workspace/notes/resourceTree/apiClient scopes added; direct `services/*` imports removed from `src/components/**/*.{ts,tsx}` and `src/pages/**/*.{ts,tsx}`).
- [x] `GREEN` Continue domain-by-domain migration (`bot`) to query hooks.
- [x] `GREEN` Complete current wave migration for active UI domains to query/mutation boundaries; deeper contract-native uplift is tracked in subsequent platform phases.
- [x] `GREEN` Remove legacy polling/subscription adapters from `pages/components` (including `subscribeToVmOpsEvents`; page layer now subscription-free).
- [x] `GREEN` Migrate subscriptions domain hook (`useSubscriptions`) from legacy subscribe polling to entities query/mutation APIs.
- [x] `GREEN` Migrate settings page orchestration to entities query/mutation hooks (`api keys`, `proxy`, `notifications`, `theme`, `projects`, `storage policy`).
- [x] `GREEN` Migrate settings theme hook runtime (`useThemeSettings`) to entities query/mutation APIs for presets/assets operations.
- [x] `GREEN` Migrate VM/Bot lifecycle runtime operations from direct legacy calls to entity command mutations/query hooks.
- [x] `GREEN` Continue VM/Bot runtime decoupling in page hooks/components (`useVmStartAndQueueActions`, `useDeleteVmWorkflow`, `BotCharacter`) through mutation-hook conversion.
- [x] `GREEN` Remove remaining `vmLegacyFacade/botLegacyFacade` imports from UI layers (`src/components` + `src/pages`) via dedicated VM facades.
- [x] `GREEN` Remove direct `services/*` imports from `src/components/**/*.{ts,tsx}` and `src/pages/**/*.{ts,tsx}`.
- [x] `GREEN` Migrate `entities/workspace` and `entities/notes` query/mutation hooks from legacy `services/*` imports to contract-based facades, reducing entities service-boundary baseline from `49` to `44` imports.
- [x] `GREEN` Migrate `entities/settings` and `entities/vm` query hooks to existing entities facades (`useSubscriptionSettingsQuery`, `useVmQueries`), reducing entities service-boundary observed imports from `44` to `42`.
- [x] `GREEN` Consolidate `entities/vm` legacy exports through local facades (`vmLegacyFacade` -> `playbook|unattend|read|settings|selection` facades) to remove duplicate direct `services/*` edges and reduce entities service-boundary observed imports from `42` to `34`.
- [x] `GREEN` Normalize duplicate service re-export declarations in entity facades (merged `export type` + value exports by source module) to reduce entities service-boundary observed imports from `34` to `28`.
- [x] `GREEN` Migrate `entities/bot` and `entities/settings` hooks/facades off direct legacy API access (`botLegacyFacade`, `useBotReferenceDataQuery`, `useResourceTreeSettings`, `settingsFacade` theme bridge), reducing entities service-boundary observed imports from `28` to `24`.
- [x] `GREEN` Migrate finance settings-path access to entities settings path client (`chartConfig`) and replace `botLegacyFacade` service edges with contract clients, reducing entities service-boundary observed imports from `24` to `18`.
- [x] `GREEN` Replace settings entities service dependencies with contract/path-client implementations (`settingsFacade`, `settingsPathClient`), reducing entities service-boundary observed imports from `18` to `13`.
- [x] `GREEN` Migrate VM selection/playbook/theme-assets entities facades off direct legacy services (`vmSelectionFacade`, `playbookFacade`, `themeFacade`) and route vm-ops event/secret bridge imports through shared layer, reducing entities service-boundary observed imports from `13` to `8`.
- [x] `GREEN` Migrate `entities/resources/subscriptionFacade` off legacy `subscriptionService` bridge to contract/resource facade operations and local domain helpers, keeping runtime behavior while removing hidden service coupling.
- [x] `GREEN` Migrate `entities/resources/ipqsFacade` and `entities/settings/themeFacade` off shared legacy bridges to direct contract/path-client flows, and switch runtime theme bootstrap to entities facade (`themeRuntime`), removing hidden bridge hops without behavior changes.
- [x] `GREEN` Remove remaining hidden `shared/lib/*Bridge` dependencies in entities (`vm*`, `unattend`, `finance analytics`): VM/unattend paths now use provider adapters, `vmDeleteContextFacade` was rewritten to contract-native `bots/resources` aggregation, and finance analytics now call contract runtime directly from entities; legacy bridge files were deleted.
- [x] `GREEN` Deepen VM provider adapters by replacing legacy pass-through re-exports for secrets/events with provider-native runtime implementations (`vm-secrets-client`, `vm-ops-events-client`), removing direct dependency on `secretsService` and `vmOpsEventsService`.
- [x] `GREEN` Deepen VM settings provider by inlining settings merge/normalization/update logic into `vm-settings-client`, removing direct dependency on `vmSettingsService` while preserving VM settings defaults and password stripping behavior.
- [x] `GREEN` Deepen VM read provider by inlining Proxmox read/action runtime into `vm-read-client` (`list targets/vms`, `cluster resources`, `task wait`, `start/stop`, `config read/update`, `start+send-key batch`), removing final VM pass-through dependency on `vmService`.
- [x] `GREEN` Add VM provider boundary gate (`check-vm-provider-boundary`) and wire it into `check:all:mono` to prevent regressions to legacy VM service/bridge imports in provider layer.
- [x] `GREEN` Harden finance entities boundary with shared contract Zod schemas: `entities/finance/lib/analytics.ts` now validates normalized records (`financeOperationRecordSchema`) and outgoing create/patch payloads (`financeOperationCreateSchema`, `financeOperationPatchSchema`) before runtime contract calls.
- [x] `GREEN` Harden finance provider boundary by validating payloads/responses in `providers/finance-contract-client.ts`: create/patch bodies now parse via shared contract schemas and all finance response data (`operations`, `daily-stats`, `gold-price-history`) is normalized through schema parsing instead of permissive casts.
- [x] `GREEN` Normalize finance domain type access through `entities/finance/model/types` in UI/hooks/query layers and simplify duplicate project filter branch in `FinancePage` (pure refactor, no behavioral contract changes).

Evidence:
1. `apps/frontend/src/app/providers/QueryProvider.tsx`
2. `apps/frontend/src/shared/lib/query/queryClient.ts`
3. `apps/frontend/src/entities/finance/api/useFinanceOperationsQuery.ts`
4. `apps/frontend/src/features/finance/model/useFinanceOperations.ts`
5. `apps/frontend/src/entities/finance/lib/analytics.ts`
6. `apps/frontend/src/pages/finance/index.tsx`
7. `apps/frontend/src/App.tsx`
8. `apps/frontend/package.json`
9. `apps/frontend/src/pages/datacenter/index.tsx`
10. `apps/frontend/src/entities/vm/api/useVmQueries.ts`
11. `apps/frontend/src/entities/vm/api/vmQueryKeys.ts`
12. `apps/frontend/src/pages/vms/VMsPage.tsx`
13. `apps/frontend/src/pages/vms/VMServicePage.tsx`
14. `apps/frontend/src/components/vm/VMServicesPanel.tsx`
15. `apps/frontend/src/hooks/useFinance.ts` (legacy compatibility adapter now delegates to FSD/query layer)
16. `apps/frontend/src/entities/bot/api/botQueryKeys.ts`
17. `apps/frontend/src/entities/bot/api/useBotQueries.ts`
18. `apps/frontend/src/pages/bot/index.tsx`
19. `apps/frontend/src/components/bot/BotPerson.tsx`
20. `apps/frontend/src/components/bot/BotCharacter.tsx`
21. `apps/frontend/src/components/bot/BotSchedule.tsx`
22. `apps/frontend/src/components/bot/BotLifeStages.tsx`
23. `apps/frontend/src/components/bot/BotSubscription.tsx`
24. `apps/frontend/src/components/bot/account/use-bot-account-subscription.ts`
25. `apps/frontend/src/components/layout/Header.tsx`
26. `apps/frontend/src/entities/bot/api/useBotMutations.ts`
27. `apps/frontend/src/entities/bot/api/useBotReferenceDataQuery.ts`
28. `apps/frontend/src/services/botsApiService.ts`
29. `apps/frontend/src/components/bot/BotAccount.tsx`
30. `apps/frontend/eslint.config.js`
31. `apps/frontend/src/pages/dashboard/index.tsx`
32. `apps/frontend/src/pages/datacenter/index.tsx`
33. `apps/frontend/src/components/layout/ResourceTree.tsx`
34. `apps/frontend/src/entities/resources/api/resourceQueryKeys.ts`
35. `apps/frontend/src/entities/resources/api/useResourcesQueries.ts`
36. `apps/frontend/src/pages/project/index.tsx`
37. `apps/frontend/src/pages/licenses/index.tsx`
38. `apps/frontend/src/components/bot/BotLicense.tsx`
39. `apps/frontend/src/entities/settings/api/settingsQueryKeys.ts`
40. `apps/frontend/src/entities/settings/api/useProjectSettingsQuery.ts`
41. `apps/frontend/src/entities/notes/api/notesQueryKeys.ts`
42. `apps/frontend/src/entities/notes/api/useNotesIndexQuery.ts`
43. `apps/frontend/src/pages/workspace/calendar/index.tsx`
44. `apps/frontend/src/components/notes/NoteSidebar.tsx`
45. `apps/frontend/src/components/bot/BotProxy.tsx`
46. `apps/frontend/src/entities/resources/api/useLicenseMutations.ts`
47. `apps/frontend/src/components/bot/BotSummary.tsx`
48. `apps/frontend/src/entities/resources/api/useProxyMutations.ts`
49. `apps/frontend/src/entities/bot/api/useBotMutations.ts`
50. `apps/frontend/src/entities/settings/api/useSubscriptionSettingsQuery.ts`
51. `apps/frontend/src/pages/subscriptions/index.tsx`
52. `apps/frontend/src/pages/project/index.tsx`
53. `apps/frontend/src/pages/datacenter/index.tsx`
54. `apps/frontend/src/pages/settings/SettingsPage.tsx`
55. `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
56. `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx`
57. `apps/frontend/src/entities/workspace/api/workspaceQueryKeys.ts`
58. `apps/frontend/src/entities/workspace/api/useWorkspaceQueries.ts`
59. `apps/frontend/src/entities/workspace/api/useWorkspaceMutations.ts`
60. `apps/frontend/src/entities/workspace/model/types.ts`
61. `apps/frontend/src/pages/workspace/calendar/index.tsx`
62. `apps/frontend/src/pages/workspace/kanban/index.tsx`
63. `apps/frontend/src/entities/notes/api/useNoteByIdQuery.ts`
64. `apps/frontend/src/entities/notes/api/useNoteMutations.ts`
65. `apps/frontend/src/pages/notes/index.tsx`
66. `apps/frontend/src/components/notes/NoteEditor.tsx`
67. `apps/frontend/src/components/notes/NoteSidebar.tsx`
68. `apps/frontend/src/entities/settings/api/useResourceTreeSettings.ts`
69. `apps/frontend/src/components/layout/ResourceTree.tsx`
70. `apps/frontend/src/entities/settings/api/useScheduleGeneratorSettings.ts`
71. `apps/frontend/src/components/schedule/ScheduleGenerator.tsx`
72. `apps/frontend/src/entities/notes/model/types.ts`
73. `apps/frontend/src/entities/notes/lib/ids.ts`
74. `apps/frontend/src/components/notes/ListBlock.tsx`
75. `apps/frontend/src/components/notes/BlockEditor.tsx`
76. `apps/frontend/src/components/notes/CheckboxBlock.tsx`
77. `apps/frontend/src/components/notes/SlashCommandMenu.tsx`
78. `apps/frontend/src/pages/datacenter/index.tsx`
79. `apps/frontend/src/pages/workspace/calendar/index.tsx`
80. `apps/frontend/eslint.config.js`
81. `apps/frontend/src/entities/bot/model/types.ts`
82. `apps/frontend/src/components/layout/resourceTree/builders.ts`
83. `apps/frontend/src/pages/licenses/page/types.ts`
84. `apps/frontend/src/entities/finance/model/chart.ts`
85. `apps/frontend/src/entities/finance/api/chartConfig.ts`
86. `apps/frontend/src/entities/finance/lib/date.ts`
87. `apps/frontend/src/components/finance/UniversalChart.tsx`
88. `apps/frontend/src/components/finance/FinanceTransactions.tsx`
89. `apps/frontend/src/components/finance/TransactionForm.tsx`
90. `apps/frontend/src/entities/vm/model/unattend.ts`
91. `apps/frontend/src/entities/settings/model/theme.ts`
92. `apps/frontend/src/entities/settings/model/projectSettings.ts`
93. `apps/frontend/src/components/vm/settingsForm/unattend/AccountSection.tsx`
94. `apps/frontend/src/components/vm/settingsForm/unattend/BloatwareSection.tsx`
95. `apps/frontend/src/components/vm/settingsForm/unattend/CustomScriptSection.tsx`
96. `apps/frontend/src/components/vm/settingsForm/unattend/DesktopIconsSection.tsx`
97. `apps/frontend/src/components/vm/settingsForm/unattend/RegionLanguageSection.tsx`
98. `apps/frontend/src/components/vm/settingsForm/unattend/VisualEffectsSection.tsx`
99. `apps/frontend/src/components/vm/settingsForm/unattend/WindowsSettingsSection.tsx`
100. `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx`
101. `apps/frontend/src/pages/settings/SettingsSections.tsx`
102. `apps/frontend/src/entities/resources/api/ipqsFacade.ts`
103. `apps/frontend/src/entities/settings/api/settingsFacade.ts`
104. `apps/frontend/src/entities/vm/api/vmLegacyFacade.ts`
105. `apps/frontend/src/entities/bot/api/botLegacyFacade.ts`
106. `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
107. `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx`
108. `apps/frontend/src/pages/proxies/proxyColumns.tsx`
109. `apps/frontend/src/pages/settings/SettingsPage.tsx`
110. `apps/frontend/src/pages/project/index.tsx`
111. `apps/frontend/src/components/vm/VMSettingsForm.tsx`
112. `apps/frontend/src/pages/vms/VMsPage.tsx`
113. `apps/frontend/src/components/vm/VMQueuePanel.tsx`
114. `apps/frontend/src/entities/settings/api/themeFacade.ts`
115. `apps/frontend/src/entities/settings/api/settingsPathClient.ts`
116. `apps/frontend/src/entities/vm/api/vmDeleteContextFacade.ts`
117. `apps/frontend/src/pages/settings/useThemeSettings.ts`
118. `apps/frontend/src/pages/vms/deleteVmRules.ts`
119. `apps/frontend/src/pages/vms/hooks/useDeleteVmWorkflow.ts`
120. `apps/frontend/src/pages/vms/hooks/useVmStartAndQueueActions.ts`
121. `apps/frontend/src/pages/vms/hooks/useVmStorageOptions.ts`
122. `apps/frontend/src/components/bot/account/settings-storage.ts`
123. `apps/frontend/src/services/unattendProfileService.ts`
124. `apps/frontend/src/entities/vm/api/useRefreshOnVmMutationEvents.ts`
125. `apps/frontend/src/pages/vms/VMsPage.tsx`
126. `apps/frontend/src/hooks/useSubscriptions.ts`
127. `apps/frontend/src/entities/resources/api/useSubscriptionMutations.ts`
128. `apps/frontend/src/entities/settings/api/useSubscriptionSettingsMutation.ts`
129. `apps/frontend/src/entities/settings/api/useSettingsQueries.ts`
130. `apps/frontend/src/entities/settings/api/useSettingsMutations.ts`
131. `apps/frontend/src/pages/settings/SettingsPage.tsx`
132. `apps/frontend/src/entities/settings/api/useThemeAssetsQuery.ts`
133. `apps/frontend/src/entities/settings/api/useThemeMutations.ts`
134. `apps/frontend/src/pages/settings/useThemeSettings.ts`
135. `apps/frontend/src/entities/vm/api/useVmActionMutations.ts`
136. `apps/frontend/src/entities/vm/api/useVmQueries.ts`
137. `apps/frontend/src/entities/vm/api/vmQueryKeys.ts`
138. `apps/frontend/src/entities/bot/api/useBotLifecycleMutations.ts`
139. `apps/frontend/src/components/vm/VMList.tsx`
140. `apps/frontend/src/components/vm/VMCommandPanel.tsx`
141. `apps/frontend/src/pages/vms/VMServicePage.tsx`
142. `apps/frontend/src/components/vm/VMSetupProgress.tsx`
143. `apps/frontend/src/components/bot/BotLifeStages.tsx`
144. `apps/frontend/src/pages/vms/hooks/useVmStartAndQueueActions.ts`
145. `apps/frontend/src/pages/vms/hooks/useDeleteVmWorkflow.ts`
146. `apps/frontend/src/entities/bot/api/useWowNamesMutation.ts`
147. `apps/frontend/src/components/bot/BotCharacter.tsx`
148. `apps/frontend/src/entities/vm/api/vmReadFacade.ts`
149. `apps/frontend/src/entities/vm/api/vmSettingsFacade.ts`
150. `apps/frontend/src/entities/vm/api/vmSelectionFacade.ts`
151. `apps/frontend/src/entities/vm/api/unattendProfileFacade.ts`
152. `apps/frontend/src/entities/vm/api/playbookFacade.ts`
153. `apps/frontend/src/entities/vm/api/secretsFacade.ts`
154. `apps/frontend/src/components/vm/VMSettingsForm.tsx`
155. `apps/frontend/src/components/vm/VMQueuePanel.tsx`
156. `apps/frontend/src/pages/vms/VMsPage.tsx`
157. `apps/frontend/src/components/vm/settingsForm/UnattendTab.tsx`
158. `apps/frontend/src/components/vm/settingsForm/PlaybookTab.tsx`
159. `apps/frontend/src/components/vm/settingsForm/SecretField.tsx`
160. `apps/frontend/src/pages/vms/hooks/useVmStorageOptions.ts`
161. `apps/frontend/src/entities/workspace/api/workspaceContractFacade.ts`
162. `apps/frontend/src/entities/workspace/api/useWorkspaceQueries.ts`
163. `apps/frontend/src/entities/workspace/api/useWorkspaceMutations.ts`
164. `apps/frontend/src/entities/notes/api/notesContractFacade.ts`
165. `apps/frontend/src/entities/notes/api/useNotesIndexQuery.ts`
166. `apps/frontend/src/entities/notes/api/useNoteByIdQuery.ts`
167. `apps/frontend/src/entities/notes/api/useNoteMutations.ts`
168. `apps/frontend/src/entities/settings/api/useSubscriptionSettingsQuery.ts`
169. `apps/frontend/src/entities/settings/api/settingsFacade.ts`
170. `apps/frontend/src/entities/vm/api/vmReadFacade.ts`
171. `apps/frontend/src/entities/vm/api/useVmQueries.ts`
172. `apps/frontend/src/entities/vm/api/vmLegacyFacade.ts`
173. `apps/frontend/src/entities/settings/api/settingsPathClient.ts`
174. `apps/frontend/src/entities/settings/api/settingsFacade.ts`
175. `apps/frontend/src/entities/settings/api/themeFacade.ts`
176. `apps/frontend/src/entities/vm/api/playbookFacade.ts`
177. `apps/frontend/src/entities/vm/api/vmSelectionFacade.ts`
178. `apps/frontend/src/providers/vm-ops-events-client.ts`
179. `apps/frontend/src/providers/vm-secrets-client.ts`
180. `apps/frontend/src/entities/finance/lib/analytics.ts`
181. `apps/frontend/src/providers/unattend-profile-client.ts`
182. `apps/frontend/src/entities/vm/api/vmDeleteContextFacade.ts`
183. `apps/frontend/src/providers/vm-read-client.ts`
184. `apps/frontend/src/providers/vm-settings-client.ts`
185. `apps/frontend/src/entities/finance/lib/analytics.ts`
186. `apps/frontend/src/entities/resources/api/ipqsFacade.ts`
187. `apps/frontend/src/entities/resources/api/subscriptionFacade.ts`
188. `apps/frontend/src/entities/settings/api/themeFacade.ts`
189. `apps/frontend/src/entities/vm/api/unattendProfileFacade.ts`
190. `apps/frontend/src/entities/vm/api/vmDeleteContextFacade.ts`
191. `apps/frontend/src/entities/vm/api/vmReadFacade.ts`
192. `apps/frontend/src/entities/vm/api/vmSettingsFacade.ts`
193. `apps/frontend/src/entities/resources/api/resourceContractFacade.ts`
194. `apps/frontend/src/theme/themeRuntime.tsx`
195. `scripts/check-vm-provider-boundary.js`
196. `package.json` (`check:vm:provider-boundary`, `check:all:mono`)
197. `apps/frontend/src/providers/finance-contract-client.ts`
198. `apps/frontend/src/entities/finance/lib/analytics.ts`
199. `apps/frontend/src/services/financeService.ts`

### Phase 5 — React 19 Upgrade

- [x] `GREEN` Upgrade `react`, `react-dom`, and typings in `apps/frontend`.
- [x] `GREEN` Validate lint + typecheck + production build after React 19 upgrade.
- [x] `GREEN` Verify smoke E2E on React 19 and close final gate.

Evidence:
1. `apps/frontend/package.json`
2. `apps/frontend/package-lock.json`
3. `apps/frontend/e2e/smoke.spec.ts`
4. `apps/frontend/playwright.config.ts`

### Phase 6 — Biome + Strictness

- [x] `GREEN` Add root Biome config.
- [x] `GREEN` Add root strict TypeScript base config.
- [x] `GREEN` Fix Biome 2.x compatibility (`noUndeclaredEnvVars` + Nest parameter decorators parsing).
- [x] `GREEN` Add monorepo-scoped Biome scripts (`biome:check:mono`, `biome:write:mono`) and validate `apps/packages/configs` scope.
- [x] `GREEN` Include Biome validation in root mono gate (`check:all:mono`).
- [x] `GREEN` Expand Biome mono scope to include `agent/src` and normalize agent files to pass formatter/import/style checks.
- [x] `GREEN` Expand Biome mono scope to include frontend FSD core slices (`apps/frontend/src/app`, `apps/frontend/src/entities`, `apps/frontend/src/features`, `apps/frontend/src/shared`) and normalize import/format drift plus restricted-name collisions (`Proxy` type aliasing).
- [x] `GREEN` Expand Biome mono scope to include frontend runtime/support slices (`apps/frontend/src/providers`, `apps/frontend/src/observability`, `apps/frontend/src/theme`, `apps/frontend/src/contexts`, `apps/frontend/src/config`, `apps/frontend/src/data`, `apps/frontend/src/utils`) and normalize formatting/import drift.
- [x] `GREEN` Remove remaining warnings in expanded frontend Biome scope via safe style-level fixes (`uiLogger` overload adjacency, schedule literal-key normalization, theme optional-chain, VM patcher `Number.isNaN`) and keep `biome:check:mono` clean.
- [x] `GREEN` Expand Biome mono scope to include `apps/frontend/src/hooks` and `apps/frontend/src/services`; remove remaining warnings via safe fixes (`Number.isNaN`, nullable tag filter, non-returning iterable callbacks, restricted-name aliasing) and keep full `biome:check:mono` clean.
- [x] `GREEN` Start Biome migration for `apps/frontend/src/components` + `apps/frontend/src/pages`: run safe auto-fix pass (`--write`) across 229 files, then manually close high-confidence leftovers (unused imports, empty CSS blocks, proxy type aliasing, selected non-null assertions/index-key fixes), reducing diagnostics from `488 errors / 157 warnings` to `118 errors / 20 warnings` while preserving frontend lint/typecheck green.
- [x] `GREEN` Expand Biome mono scope to full frontend source (`apps/frontend/src`) and keep the expanded scope green in `check:all:mono`.
- [x] `GREEN` Expand Biome mono scope to legacy backend source (`apps/backend-legacy/src`) with formatting cleanup and safe runtime fix for `noAsyncPromiseExecutor` in infra SSH connector path.
- [x] `GREEN` Apply temporary Biome panic workaround for 7 backend files (tooling bug in formatter) so the rest of `apps/backend-legacy/src` remains enforced by mono gate.
- [x] `GREEN` Expand Biome mono scope to local scripts (`scripts/*`) and `start-dev.js`; normalize script formatting/style to keep expanded scope clean.
- [x] `GREEN` Extend temporary Biome panic workaround with 5 script files (`check-antd6-compatibility.js`, `check-no-any-mono.js`, `check-pnpm-first.js`, `generate-firebase-decommission-audit.js`, `setup-mcp-antd-docs.js`) so full mono gate stays executable.
- [x] `GREEN` Reduce Biome panic workaround scope by removing all temporary script excludes and route-level backend excludes (`v1/playbooks.routes.js`, `v1/provisioning.routes.js`) after targeted normalization; mono gate revalidated green.
- [x] `GREEN` Remove final backend Biome workaround excludes and normalize remaining formatter-problem files (`playbooks/service.js`, `provisioning/s3-service.js`, `provisioning/service.js`, `unattend/xml-builder.js`, `utils/agent-token.js`); `biome.json` now has no temporary panic excludes.
- [x] `GREEN` Add no-`any` static guard for monorepo core scopes (`apps/*`, `packages/*`).
- [x] `GREEN` Expand no-`any` guard to frontend/agent TypeScript scopes with explicit-type matching (`apps/frontend/src`, `agent/src`) to avoid false positives from plain text.
- [x] `GREEN` Expand Biome usage to all apps and replace fragmented lint setup (`@botmox/frontend` lint path migrated from ESLint command to Biome + dedicated UI boundary gate).
- [x] `GREEN` Enforce repo-wide no-new-any policy for TypeScript scopes included in mono gate (`apps`, `packages`, `apps/frontend/src`, `agent/src`).
- [x] `GREEN` Add entities-layer legacy import freeze gate (`check:entities:service-boundary`) with explicit baseline; follow-up waves reduced baseline allowlist from `50` to `0` unique entries (current observed imports: `0`) while blocking any new direct `services/*` imports in `apps/frontend/src/entities`.

Evidence:
1. `biome.json`
2. `configs/tsconfig.base.json`
3. `package.json`
4. `scripts/check-no-any-mono.js`
5. `package.json` (`check:no-any:mono`)
6. `package.json` (`biome:check:mono`, `biome:write:mono`)
7. `agent/src/core/agent-loop.ts`
8. `agent/src/core/config-store.ts`
9. `agent/src/core/diagnostics.ts`
10. `agent/src/core/logger.ts`
11. `agent/src/executors/proxmox.ts`
12. `agent/src/main/pairing-window.ts`
13. `agent/src/ui/pairing.html`
14. `package.json`
15. `apps/frontend/src/entities/resources/api/ipqsFacade.ts`
16. `apps/frontend/src/entities/resources/api/useProxyMutations.ts`
17. `apps/frontend/src/entities/resources/api/useResourcesQueries.ts`
18. `package.json`
19. `apps/frontend/src/observability/otel.ts`
20. `apps/frontend/src/providers/finance-contract-client.ts`
21. `apps/frontend/src/config/env.ts`
22. `apps/frontend/src/data/windows-timezones.ts`
23. `apps/frontend/src/observability/uiLogger.ts`
24. `apps/frontend/src/utils/scheduleUtils.ts`
25. `apps/frontend/src/theme/themeRuntime.tsx`
26. `apps/frontend/src/utils/vm/patcher.ts`
27. `apps/frontend/src/services/notesService.ts`
28. `apps/frontend/src/services/financeService.ts`
29. `apps/frontend/src/hooks/vm/queue/processor.ts`
30. `apps/frontend/src/services/ipqsService.ts`
31. `apps/frontend/src/services/proxyDataService.ts`
32. `package.json` (`biome:check:mono`, `biome:write:mono`)
33. `apps/frontend/src/components/bot/proxy/helpers.tsx`
34. `apps/frontend/src/components/bot/proxy/types.ts`
35. `apps/frontend/src/components/bot/lifeStages/lifeStages.module.css`
36. `apps/frontend/src/components/finance/FinanceSummary.tsx`
37. `apps/frontend/src/pages/workspace/calendar/page/CalendarEventList.tsx`
38. `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx`
39. `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
40. `package.json` (`biome:check:mono`, `biome:write:mono`)
41. `biome.json` (temporary backend/script panic excludes fully removed)
42. `apps/backend-legacy/src/modules/infra/connectors.js`
43. `apps/backend-legacy/src/modules/v1/secrets.routes.js`
44. `package.json` (`biome:check:mono`, `biome:write:mono`)
45. `scripts/check-theme-contrast.js`
46. `scripts/check-backend-console.js`
47. `scripts/check-frontend-console.js`
48. `scripts/check-bundle-budgets.js`
49. `scripts/check-secrets.js`
50. `scripts/dev-trace.js`
51. `scripts/e2e-prodlike.js`
52. `scripts/doctor.js`
53. `scripts/artifacts-e2e-smoke.js`
54. `scripts/check-style-guardrails.js`
55. `start-dev.js`
56. `apps/backend-legacy/src/modules/playbooks/service.js`
57. `scripts/setup-mcp-antd-docs.js`
58. `apps/backend-legacy/src/modules/v1/playbooks.routes.js`
59. `apps/backend-legacy/src/modules/v1/provisioning.routes.js`
60. `scripts/check-antd6-compatibility.js`
61. `scripts/check-no-any-mono.js`
62. `scripts/check-pnpm-first.js`
63. `scripts/generate-firebase-decommission-audit.js`
64. `scripts/setup-mcp-antd-docs.js`
65. `apps/backend-legacy/src/modules/provisioning/s3-service.js`
66. `apps/backend-legacy/src/modules/provisioning/service.js`
67. `apps/backend-legacy/src/modules/unattend/xml-builder.js`
68. `apps/backend-legacy/src/utils/agent-token.js`
69. `scripts/check-ui-boundaries.js`
70. `package.json` (`check:ui:boundaries`, `check:all:mono`)
71. `apps/frontend/package.json` (`lint`)
72. `apps/frontend/package.json` (`lint`)
73. `scripts/check-entities-service-boundary.js`
74. `configs/entities-service-import-baseline.json`
75. `package.json` (`check:entities:service-boundary`, `check:all:mono`)

### Phase 7 — Agent Observability Hardening

- [x] `GREEN` Move logger to structured JSON events.
- [x] `GREEN` Add rotation policy and session markers.
- [x] `GREEN` Add correlation/trace context fields.
- [x] `GREEN` Add diagnostic bundle command (tray action) that exports sanitized runtime/config/log context.

Evidence:
1. `agent/src/core/logger.ts`
2. `agent/src/core/diagnostics.ts`
3. `agent/src/main/index.ts`
4. `agent/src/main/tray.ts`

### Phase 8 — AntD 6 Gate

- [x] `GREEN` Build automated compatibility baseline gate (`audit:antd6:gate`) with live pnpm registry peer-dependency verification.
- [ ] `BLOCKED` Defer AntD 6 cutover while official `@refinedev/antd` peer contract does not include `antd@6`; keep delivery path on `antd@5`.
- [x] `GREEN` Build compatibility checklist + codemod baseline set (static hotspot scan + strict gate script path for pre-cutover verification).
- [x] `GREEN` Run full e2e gate before any broad UI package cutover (expanded Playwright smoke suite + dedicated `audit:antd6:e2e` command).

Evidence:
1. `scripts/check-antd6-compatibility.js`
2. `scripts/check-antd6-api-usage.js`
3. `package.json` (`audit:antd6:gate`, `audit:antd6:scan`, `audit:antd6:e2e`, `audit:antd6:gate:full`)
4. `docs/audits/antd6-compatibility-gate.md`
5. `apps/frontend/e2e/authenticated-shell.spec.ts`

## Key Open Risks

1. `jsonb data` remains the source-of-truth payload model, but core runtime collections now have typed/indexed projection columns; full relational extraction is optional follow-up, not a blocker.
2. Contract exists, but not yet the only source of truth for all runtime handlers.
3. Direct `services/*` imports were removed from `src/components` + `src/pages`, but guardrails must stay enforced during future feature work.
4. UI architectural boundaries are enforced by a dedicated static gate (`check:ui:boundaries`); regressions can still appear if this gate is removed from CI or bypassed locally.
5. Frontend migration is currently partial beyond import boundaries: domain facades still wrap legacy services and require deeper contract/query-native rewrites; growth of this debt is now frozen by the entities service-boundary gate, and the current residual allowlist is `0` legacy imports in `apps/frontend/src/entities`.

