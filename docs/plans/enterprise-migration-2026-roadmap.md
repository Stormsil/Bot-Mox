# Enterprise Migration 2026 Roadmap

Last updated (UTC): **2026-02-19T18:23:56Z**
Owner: Platform / Architecture

Note: historical entries below may reference legacy paths (`apps/backend-legacy`) as archival evidence of completed migration steps.

## Target

Move Bot-Mox from multi-app npm scripts to an enterprise-grade monorepo platform:
- `pnpm + turbo`
- shared packages and DB-first type flow
- `ts-rest` API contract spine
- NestJS strangler migration
- frontend FSD + Query core
- React 19 upgrade
- strict DX and structured observability

## Status by Phase

1. `Phase 0 — Repo Foundation`: **GREEN (100%)**
2. `Phase 1 — Contract Spine`: **GREEN (100%)**
3. `Phase 2 — DB-First + Zod`: **GREEN (100%)**
4. `Phase 3 — NestJS Strangler`: **GREEN (100%)**
5. `Phase 4 — Frontend FSD + Query`: **GREEN (100%)**
6. `Phase 5 — React 19`: **GREEN (100%)**
7. `Phase 6 — Biome + Strictness`: **GREEN (100%)**
8. `Phase 7 — Agent Observability Hardening`: **GREEN (100%)**
9. `Phase 8 — AntD 6 Gate`: **BLOCKED (60%)**

## Current Wave Scope

1. Foundation setup:
- `pnpm-workspace.yaml`
- `turbo.json`
- root `biome.json`
- shared TS base config in `configs/tsconfig.base.json`

2. Monorepo active apps:
- `apps/frontend`
- `apps/backend`
- `apps/agent`

3. Shared package scaffolding:
- `packages/shared-types`
- `packages/database-schema`
- `packages/api-contract`
- `packages/ui-kit`
- `packages/utils`

4. De-legacy cutover baseline:
- legacy backend runtime removed from active workspace/runtime graph
- strangler parity scripts removed from active tooling surface
- infra proxy/ws behavior validated via Nest-only gate (`check:infra:gateway`)

5. Agent observability hardening:
- JSON structured logger in `agent/src/core/logger.ts`
- log rotation + session markers + correlation fields
- diagnostic bundle command from tray (`Create Diagnostic Bundle`) with sanitized config/runtime/log tails

6. Frontend query/FSD wave-1:
- `QueryClientProvider` wired in app shell
- finance domain split into `entities/finance` + `features/finance`
- finance page switched from legacy polling hook to TanStack Query
- datacenter page switched to the same finance query-layer
- vm domain started (`settings` + `proxmox-targets` query hooks) and connected to `VMsPage`/`VMServicePage`
- bot domain switched from `subscribeBotById` polling to shared `entities/bot` query hooks (page + key subcomponents + header breadcrumbs)
- bot mutation flow started via shared `useUpdateBotMutation` (Account/Person/Character/Schedule no longer call `apiPatch` directly)
- eslint guardrails started: bot UI components now block direct `apiClient` imports
- dashboards/layout pages started using shared bot queries (`Dashboard`, `Datacenter`, `ResourceTree`) instead of direct `subscribeBots*`
- resources query layer started (`entities/resources`) and connected to `ProjectPage` + `LicensesPage`
- legacy UI polling via `subscribeBots*`/`subscribeResources*` removed from pages/components (remaining usages are in service-layer adapters only)
- settings/notes query layers started (`entities/settings`, `entities/notes`) and connected to `ProjectPage`/`ResourceTree`/`Datacenter`/`WorkspaceCalendar`/`NoteSidebar`
- `BotProxy` migrated from `subscribeResources` to shared `useProxiesQuery`
- direct license CRUD in UI moved to shared `entities/resources` mutation hooks (`useCreateLicenseMutation`, `useUpdateLicenseMutation`, `useDeleteLicenseMutation`)
- `BotSummary` migrated from direct `fetchResources` calls to shared resources query hooks
- direct proxy CRUD in `BotProxy` moved to shared `entities/resources` mutation hooks (`useCreateProxyMutation`, `useUpdateProxyMutation`)
- eslint guardrails expanded for UI to block legacy subscription imports and direct `resourcesApiService`/`licensesApiService` CRUD imports
- `ProjectPage` moved bot delete flow to shared `useDeleteBotMutation`
- shared subscription-alert settings query introduced and integrated in `Subscriptions/Project/Datacenter/Settings` pages
- eslint guardrails expanded for UI to block direct `fetchBotsList`/`fetchBotsMap`/`deleteBot` and direct `getSubscriptionSettings` imports
- `ProxiesPage` and `ProxyCrudModal` moved from `proxyDataService` polling/CRUD to shared query/mutation hooks
- eslint guardrails expanded for UI to block direct `proxyDataService` imports
- workspace query/mutation layer introduced in `entities/workspace` and connected to `WorkspaceCalendar` + `WorkspaceKanban`
- eslint guardrails expanded for UI to block direct `workspaceService` polling/CRUD imports
- notes query/mutation layer extended with note-by-id and CRUD mutations; `NotesPage`, `NoteEditor`, `NoteSidebar` moved off direct `notesService` subscribe/CRUD usage
- eslint guardrails expanded for UI to block direct `subscribeToNote`/`createNote`/`updateNote`/`deleteNote` imports
- resource-tree settings flow moved to shared settings query/mutation hooks (`ResourceTree` no longer calls settings service directly)
- schedule generator moved to shared settings query/mutation hooks (`ScheduleGenerator` no longer calls `apiClient` directly)
- eslint guardrails expanded for UI to block direct `resourceTreeSettingsService` and direct `apiClient` CRUD helper imports in TSX pages/components
- notes UI note-type/id dependencies moved to entities layer (`ListBlock` id generation + notes type imports), and ESLint now blocks direct `notesService` imports across UI TSX layers
- bot UI `BotRecord` type dependencies moved to `entities/bot/model`, and ESLint now blocks direct `botsApiService` imports across UI TSX layers
- finance UI chart/date dependencies moved to `entities/finance` (`chartConfig` API + date formatting), and ESLint now blocks direct `financeService` imports across UI TSX layers
- all remaining UI TSX `import type ...services/...` usages removed (`theme/project-settings/unattend` types now imported from entities model slices)
- proxies/settings/project UI TSX moved off direct `ipqs/settings*` services to `entities` facades
- vm/bot UI TSX moved off direct `vm*`/`playbook`/`secrets`/`unattend`/`wowNames`/`botLifecycle` services to `entities` facades
- direct `services/*` imports in UI TSX (`components/**/*.tsx` + `pages/**/*.tsx`) reduced to zero
- direct `services/*` imports in `src/components/**/*.{ts,tsx}` + `src/pages/**/*.{ts,tsx}` reduced to zero (facades added for theme/ipqs/vm-delete/raw-settings + VM lifecycle helpers)
- remaining page-level VM `subscribeToVmOpsEvents` usage moved to `entities/vm` hook (`useRefreshOnVmMutationEvents`), keeping `pages/components` free of direct subscription adapters
- subscriptions domain hook migrated to query/mutation core (`useSubscriptions` no longer uses legacy `subscribeToSubscriptions`/`subscribeToBotSubscriptions` directly)
- settings page orchestration migrated to query/mutation hooks (`useSettingsQueries` + `useSettingsMutations`) instead of imperative `Promise.all`/direct facade CRUD in page runtime
- theme settings page hook migrated to query/mutation APIs (`useThemeAssetsQuery` + `useThemeMutations`), removing direct imperative theme facade operations from runtime flow
- VM/Bot lifecycle runtime flows in UI moved to entity command mutations/query hooks (`VMList`, `VMCommandPanel`, `VMServicePage`, `VMSetupProgress`, `BotLifeStages`)
- VM/Bot runtime decoupling expanded into page hooks/components (`useVmStartAndQueueActions`, `useDeleteVmWorkflow`, `BotCharacter`) via mutation hooks
- remaining `vmLegacyFacade/botLegacyFacade` imports removed from `src/components` + `src/pages` by introducing dedicated VM facades (`vmRead/vmSettings/vmSelection/playbook/unattend/secrets`)
- workspace/notes entity query and mutation hooks moved from legacy services to contract-based facades (`workspaceContractFacade`, `notesContractFacade`), reducing observed entities legacy imports from `49` to `44` and baseline allowlist entries from `42` to `37`
- settings/vm entity query hooks moved to existing entities facades (`useSubscriptionSettingsQuery`, `useVmQueries`), reducing observed entities legacy imports from `44` to `42` and baseline allowlist entries from `37` to `34`
- `vmLegacyFacade` consolidated to re-export from local VM entity facades instead of direct service imports, reducing observed entities legacy imports from `42` to `34`
- duplicate service re-export declarations in entities facades were normalized (`export type` + value re-exports merged per source module), reducing observed entities legacy imports from `34` to `28`
- `entities/bot` and `entities/settings` facades/hooks were migrated off direct legacy API access (`botLegacyFacade`, `useBotReferenceDataQuery`, `useResourceTreeSettings`, `settingsFacade` theme bridge), reducing observed entities legacy imports from `28` to `24`
- finance settings-path access (`chartConfig`) now uses entities settings path client, and `botLegacyFacade` service edges were replaced with contract clients, reducing observed entities legacy imports from `24` to `18`
- settings entities runtime was moved to contract/path-client layer (`settingsFacade`, `settingsPathClient`) without direct `services/*` imports, reducing observed entities legacy imports from `18` to `13`
- VM selection/playbook/theme-assets entities facades were moved off direct services (`vmSelectionFacade`, `playbookFacade`, `themeFacade`), and vm-ops events/secrets now flow through shared bridges, reducing observed entities legacy imports from `13` to `8`
- remaining entities service-edge facades were migrated to shared bridge layer (`finance/ipqs/subscription/theme/vmRead/vmSettings/unattend/vmDeleteContext`), reducing observed entities legacy imports from `8` to `0`
- subscriptions entity facade was deepened to contract-native runtime (`subscriptionFacade` now uses `resourceContractFacade`; legacy `subscriptionService` bridge removed), eliminating one hidden legacy-service hop while preserving form/date/status behavior
- ipqs and theme entity facades were deepened to contract/path-client runtime (`ipqsFacade`, `themeFacade`), legacy shared bridges were removed, and theme runtime bootstrap now reads from entities API (`themeRuntime` -> `entities/settings/api/themeFacade`)
- remaining hidden `shared/lib/*Bridge` dependencies were removed from `entities` VM/finance facades; VM paths now flow through `providers/*` adapters, finance analytics moved to contract-native entities implementation, and `vmDeleteContextFacade` was rewritten to aggregate via contract-native `bots/resources` entities paths
- VM providers were deepened by inlining runtime logic for secrets and vm-ops events (`vm-secrets-client`, `vm-ops-events-client`) instead of proxying through legacy `services/*` re-exports
- VM settings provider was deepened by inlining normalization/defaults/update runtime in `vm-settings-client`
- VM read/unattend providers now run provider-native runtime (`vm-read-client`, `unattend-profile-client`) and no longer proxy through legacy `services/vmService` pass-through adapters
- VM provider boundary guard added to mono gate (`check:vm:provider-boundary`) to block regressions back to legacy VM services/bridges in `apps/frontend/src/providers`
- finance entities runtime (`entities/finance/lib/analytics.ts`) now validates record normalization and create/patch payloads with shared contract Zod schemas (`financeOperationRecord/Create/PatchSchema`) before contract calls
- finance provider boundary hardened: `providers/finance-contract-client.ts` now validates create/patch payloads and normalizes all finance response payloads (`operations list/get/create/patch`, `daily-stats`, `gold-price-history`) via shared contract schemas instead of permissive `Record<string, unknown>` casts
- finance domain import surface normalized: finance UI/hooks/query layers now consume canonical `entities/finance/model/types` exports (instead of direct `src/types` imports), and `FinancePage` filtering branch was simplified by removing duplicate project-filter path/comments without changing behavior
- frontend app typecheck restored to green after legacy typing compatibility fix in `unattendProfileService`
- React 19 dependency upgrade applied in `apps/frontend` (`react`/`react-dom`/`@types`), with lint + app typecheck + production build + Playwright smoke gate green
- Biome 2.x config aligned for Nest + monorepo scripts added (`biome:check:mono`, `biome:write:mono`); `apps/packages/configs` scope now checks cleanly
- Biome monorepo gate expanded to include `agent/src`; agent sources were normalized to pass formatter/import/style checks in safe mode
- Biome monorepo gate expanded to include frontend FSD core slices (`apps/frontend/src/app`, `apps/frontend/src/entities`, `apps/frontend/src/features`, `apps/frontend/src/shared`) with normalized imports/formatting and restricted-name cleanup (`Proxy` type aliasing in resources entities API)
- Biome monorepo gate expanded further to frontend runtime/support slices (`apps/frontend/src/providers`, `apps/frontend/src/observability`, `apps/frontend/src/theme`, `apps/frontend/src/contexts`, `apps/frontend/src/config`, `apps/frontend/src/data`, `apps/frontend/src/utils`) with formatter/import drift normalized
- expanded frontend Biome scope now checks cleanly without warnings in mono gate after targeted safe fixes (`uiLogger` overload adjacency, literal key access in schedule utils, optional-chain cleanup in theme runtime, `Number.isNaN` in VM patcher)
- frontend Biome mono scope expanded to include `apps/frontend/src/hooks` and `apps/frontend/src/services`, with remaining warnings removed via safe style fixes (`Number.isNaN`, nullable tag filter, non-returning `forEach` callbacks, and `Proxy` type alias cleanup)
- frontend `components/pages` Biome wave started: safe auto-fix pass applied to 229 files (`--write`), reducing residual diagnostics from `488 errors / 157 warnings` to `118 errors / 20 warnings` while keeping frontend lint + typecheck green
- frontend `components/pages` Biome wave closed to zero diagnostics, then extended to full `apps/frontend/src` shell/types/styles baseline (remaining parse/import/format/non-null issues fixed; `biome check apps/frontend/src` now clean)
- mono Biome gate coverage hardened: `biome:check:mono` / `biome:write:mono` now target full `apps/frontend/src` instead of selected slices, and `check:all:mono` re-verified green with expanded scope
- mono Biome gate expanded to legacy backend source (`apps/backend-legacy/src`) with formatting/lint cleanup and runtime-safe fix for async promise executor in SSH connector path
- temporary Biome panic workaround applied via explicit ignore list for 7 known-crashing backend files; remaining `apps/backend-legacy/src` scope is enforced in mono gate and checks clean
- mono Biome gate expanded to local orchestration scripts (`scripts/*`) and `start-dev.js`, with safe formatter/style normalization and Node import-protocol cleanup
- temporary Biome panic workaround expanded with 5 script files (`check-antd6-compatibility.js`, `check-no-any-mono.js`, `check-pnpm-first.js`, `generate-firebase-decommission-audit.js`, `setup-mcp-antd-docs.js`) so expanded gate remains executable
- Biome workaround scope reduced: script panic excludes and backend route excludes (`v1/playbooks.routes.js`, `v1/provisioning.routes.js`) were removed after normalization; mono gate remains green with only core backend formatter-crash excludes
- final backend workaround excludes removed after targeted normalization of remaining files (`playbooks/service.js`, `provisioning/s3-service.js`, `provisioning/service.js`, `unattend/xml-builder.js`, `utils/agent-token.js`); `biome.json` has no temporary panic excludes and `biome:check:mono` stays green
- root monorepo now has `pnpm-lock.yaml`; `check:all:mono` runs full turbo graph and reaches functional gates
- primary developer docs (`README`, `docs/DEV-WORKFLOW.md`, `docs/runbooks/dev-workflow.md`) now use `pnpm run` as default command path
- secondary app docs aligned to `pnpm` command path (`apps/frontend/README.md`)
- contributor and local env docs aligned to `pnpm` command path (`CONTRIBUTING.md`, `deploy/compose.prod-sim.env.example`)
- local compose dev flows moved from `npm` to `corepack pnpm` (`docker-compose.local.yml`, `deploy/compose.dev.override.yml`)
- local orchestration scripts moved to `pnpm/corepack` execution path (`start-dev.js`, Supabase bootstrap, DB type generation checks, AntD compatibility gate registry read)
- local MCP setup flow moved to `pnpm`-first script (`mcp:antd:setup` -> `scripts/setup-mcp-antd-docs.js`)
- `apps/backend` strict typecheck fixed (`moduleResolution` + null-safe `ResourcesService` store access)
- `db:types` scripts now execute correctly on Windows (removed `npx.cmd` spawn issues); current blocking condition is unavailable running Supabase target for type generation
- `db:types:check` moved to deterministic migration-hash gate (`supabase.types.meta.json`) and no longer requires running Supabase stack on every check
- DB normalization wave 1 started for `resources_subscriptions`: generated typed projection columns (`subscription_type`, `subscription_status`, `expires_at_ms`, `bot_id_ref`, etc.), domain constraints, and query indexes were added while preserving JSONB-compatible write-paths
- DB normalization wave 2 completed for `resources_licenses`, `resources_proxies`, `finance_operations` with typed projections + domain constraints + indexes
- DB normalization wave 3 completed for `workspace_notes`, `workspace_calendar_events`, `workspace_kanban_tasks`, and `bots` with typed projections + domain constraints + indexes
- `check:all:mono` now passes end-to-end (turbo graph + biome gate)
- `check:pnpm:first` now scans every repository `package.json` script (not only root), and `agent/package.json` no longer uses `npm run` in `dev/build` flows
- `check:pnpm:first` automation-source scan now also covers local compose/dev docs (`docker-compose.local.yml`, `deploy/compose.dev.override.yml`, `deploy/compose.prod-sim.env.example`, `CONTRIBUTING.md`) to prevent npm-command regressions
- `packages/api-contract` resources slice expanded to full CRUD contract (`list/get/create/update/delete`) with backward-compatible update alias
- `packages/api-contract` bots slice expanded to CRUD contract (`list/get/create/patch/delete`) for frontend/legacy parity
- frontend `data-provider` resources slice now uses `@botmox/api-contract` runtime client for full CRUD path (`getList/getOne/getMany/create/update/deleteOne`)
- bot query/mutation layer now uses contract runtime client (`useBotQueries`, `useBotMutations` via `bot-contract-client`) instead of direct legacy service calls
- frontend `data-provider` bots resource path now uses contract runtime client (`getList/getOne/getMany/create/update/deleteOne`)
- `packages/api-contract` workspace slice expanded to typed notes/calendar/kanban CRUD contract (`list/get/create/patch/delete`)
- frontend workspace service now uses contract runtime client (`workspace-contract-client`) for calendar/kanban list + CRUD operations
- frontend notes service now uses contract runtime client for workspace notes CRUD/list flows
- `packages/api-contract` finance slice expanded to typed operations/stats/history contract (`list/get/create/patch/delete` + `daily-stats` + `gold-price-history`)
- frontend finance service now uses contract runtime client (`finance-contract-client`) for operations CRUD + `daily-stats` + `gold-price-history`
- `packages/api-contract` bots slice expanded with typed lifecycle contract routes (`lifecycle`, `transitions`, `is-banned`, `transition`, `ban`, `unban`)
- frontend bot lifecycle service now uses contract runtime client (`bot-contract-client`) for lifecycle read/transition/ban flows
- `packages/api-contract` playbooks slice expanded with typed routes (`list/get/create/update/delete/validate`) and explicit `422` branch for YAML validation
- frontend playbook service now uses contract runtime client (`playbook-contract-client`) for list/get/create/update/delete/validate flows
- `packages/api-contract` wow-names slice expanded with typed route (`GET /api/v1/wow-names` query + response envelopes)
- frontend wow-names service now uses contract runtime client (`wow-names-contract-client`) instead of direct `apiClient` reads
- `packages/api-contract` ipqs slice expanded with typed routes (`GET /api/v1/ipqs/status`, `POST /api/v1/ipqs/check`, `POST /api/v1/ipqs/check-batch`)
- frontend ipqs service now uses contract runtime client (`ipqs-contract-client`) for status/check flows instead of direct `apiClient` calls
- `packages/api-contract` settings slice expanded with typed routes (`GET/PUT /api/v1/settings/api_keys`, `GET/PUT /api/v1/settings/proxy`, `GET/PUT /api/v1/settings/notifications/events`) and nullable GET envelopes for legacy parity
- frontend settings backend service now uses contract runtime client (`settings-contract-client`) for `api_keys`/`proxy`/`notifications/events` instead of direct `apiClient` calls
- `packages/api-contract` theme-assets slice expanded with typed routes (`GET /api/v1/theme-assets`, `POST /presign-upload`, `POST /complete`, `DELETE /:id`) and Zod envelopes
- frontend theme assets service now uses contract runtime client (`theme-assets-contract-client`) for list/presign/complete/delete flow
- `packages/api-contract` observability slice expanded for legacy parity (`GET /api/v1/diag/trace`, `POST /api/v1/client-logs`) with shared Zod schemas for diagnostics payloads and frontend log intake batches
- `packages/api-contract` Wave-2 legacy parity slice expanded for `vm` (`register`, `resolve`), `secrets` (`create/meta/rotate/bindings`), `artifacts` (`releases/assign/get-assignment/resolve-download`), `infra` (proxmox+ssh operations), and `vm-ops` command `create/list`
- strangler parity gate now validates new Wave-2 legacy domains (`vm`, `secrets`, `artifacts`, `infra`) and `vm-ops` command `create/list` routes against shared contract schemas
- `apps/backend` workspace module added with contract-schema validation and REST parity for `notes/calendar/kanban` (`GET/POST/PATCH/DELETE` + list query/meta)
- `apps/backend` finance module added with contract-schema validation and REST parity for operations + `daily-stats` + `gold-price-history`
- `apps/backend` bots module added with contract-schema validation and REST parity for `bots` CRUD + lifecycle routes
- `apps/backend` playbooks module added with contract-schema validation and REST parity for `playbooks` (`GET/POST/PUT/DELETE` + `POST validate`)
- `apps/backend` wow-names module added with contract-schema validation and legacy-compatible response shapes (`count` and `batches` modes)
- `apps/backend` ipqs module added with contract-schema validation and legacy-compatible responses for `status`, `check`, and `check-batch`
- `apps/backend` settings module added with contract-schema validation and legacy-compatible responses for `api_keys`, `proxy`, and `notifications/events`
- `apps/backend` license module added with contract-schema validation and runtime parity for `POST /api/v1/license/lease|heartbeat|revoke`
- `apps/backend` theme-assets module added with contract-schema validation and runtime parity for `GET /api/v1/theme-assets`, `POST /presign-upload`, `POST /complete`, `DELETE /:id`
- `apps/backend` provisioning module expanded with contract-schema validation and runtime parity for `unattend-profiles` CRUD and provisioning bootstrap routes (`generate-iso-payload`, `validate-token`, `report-progress`, `progress/:vmUuid`)
- `apps/backend` vm module added with contract-schema validation and runtime parity for `POST /api/v1/vm/register` and `GET /api/v1/vm/:uuid/resolve`
- `apps/backend` secrets module added with contract-schema validation and runtime parity for `POST /api/v1/secrets`, `GET /api/v1/secrets/:id/meta`, `POST /api/v1/secrets/:id/rotate`, `POST/GET /api/v1/secrets/bindings`
- `apps/backend` infra module added with contract-schema validation and runtime parity for proxmox/ssh routes (`POST /api/v1/infra/proxmox/login`, `GET /api/v1/infra/proxmox/status`, node VM/config/action routes, and ssh exec/vm-config routes)
- `apps/backend` infra-gateway middleware module added for HTTP reverse-proxy cutover of infra UI prefixes (`/proxmox-ui`, `/api2`, `/pve2`, `/novnc`, `/xtermjs`, `/tinyfm-ui`, `/syncthing-ui`) with location rewrite + frame-header normalization
- `apps/backend` infra-gateway upgrade handler added in Nest bootstrap for websocket proxy routing on `/proxmox-ui`, `/tinyfm-ui`, `/syncthing-ui` (+ referer/origin service hint fallback)
- dedicated infra-gateway parity/smoke gate added (`check:infra:gateway` -> `scripts/check-infra-gateway.cjs`) and integrated into `check:all:mono` (HTTP + websocket checks)
- `apps/backend` observability module expanded with OTLP proxy compatibility endpoint (`POST /api/v1/otel/v1/traces`) behind `BOTMOX_OTEL_PROXY_ENABLED` to preserve legacy browser-trace export flow
- `apps/backend` artifacts module added with contract-schema validation and runtime parity for `POST /api/v1/artifacts/releases`, `POST /api/v1/artifacts/assign`, `GET /api/v1/artifacts/assign/:userId/:module`, `POST /api/v1/artifacts/resolve-download`
- `apps/backend` observability module added with contract-schema validation and runtime parity for `GET /api/v1/diag/trace` and `POST /api/v1/client-logs`
- `packages/api-contract` agents/vm-ops slice expanded to real route behavior (`agents list query`, `pairings create`, `vm-ops dispatch 202`, `syncthing dispatch`)
- `packages/api-contract` vm-ops slice expanded with typed command-agent routes (`GET /api/v1/vm-ops/commands/next`, `PATCH /api/v1/vm-ops/commands/:id`)
- `apps/backend` vm-ops module expanded to command lifecycle parity (`POST/GET /commands`, `GET /commands/next`, `GET/PATCH /commands/:id`) with SSE endpoint parity for `GET /api/v1/vm-ops/events`
- local dev default cutover advanced: `start-dev.js` now starts `apps/backend` (Nest) and frontend runtime fallbacks/defaults now target `http://localhost:3002` (`ws://localhost:3002`) instead of legacy `3001`
- mono default quality gates are now Nest-first: `check:backend:syntax/smoke` validate `@botmox/backend`, `biome:check:mono` targets `apps/backend/src`, and root legacy runtime scripts were removed from active command surface
- Zod boundary mono gate is now Nest/agent-only and no longer includes legacy Express route validation paths
- Supabase bootstrap helper now writes runtime credentials into `apps/backend/.env` for Nest-first local startup
- frontend/agent local and Playwright runtime defaults now prioritize Nest `3002` (`BOTMOX_BACKEND_PORT`) with backward-compatible fallback to `BOTMOX_PROXY_PORT`
- contract runtime path stabilized for Nest dist startup: `@botmox/api-contract` now exports runtime from `dist` and backend/frontend scripts explicitly prebuild contract package before `dev/build`
- Nest migrated-module runtime hardening completed: DI metadata regressions from type-only service imports fixed; backend runtime dependencies include `class-validator` and `class-transformer`
- prod-like container path moved to Nest backend: new `apps/backend/Dockerfile`, stack prod-sim build scripts and GHCR image workflow now build backend image from `apps/backend` (root context)
- prod-like routing/runtime defaults aligned to backend `3002` (`deploy/compose.stack.yml`, `deploy/caddy/Caddyfile`, env examples, `start-dev.js`, `scripts/dev-trace.js`, `scripts/doctor.js`)
- prod-sim local runtime defaults completed for Nest path (`deploy/compose.prod-sim.env` image names + `BACKEND_PORT=3002`, `scripts/artifacts-e2e-smoke.js` default API base switched to `3002`)
- active frontend/e2e tooling/docs cleaned from proxy-era defaults (`apps/frontend/playwright.config.ts` no `BOTMOX_PROXY_PORT`, `apps/frontend/README.md` + `scripts/README.md` updated, pnpm-first automation source list points to `apps/backend/Dockerfile`)
- agent local pairing auto-detect no longer falls back to legacy `:3001` endpoints (`apps/agent/src/main/pairing-window.ts` now probes localhost/127.0.0.1 + `:3002` only)
- active architecture and auth/runbook docs aligned to Nest-first topology and port defaults (`README.md`, `docs/ARCHITECTURE.md`, `docs/AUTH.md`, `docs/runbooks/dev-workflow.md`, `docs/api/openapi.yaml`)
- root scripts de-legacy cleanup completed: removed `dev:backend:legacy`, `dev:mono:with-legacy`, legacy syntax/smoke gates, and explicit legacy mono aggregate from `package.json`
- default mono gate now enforces Nest-first scope (`pnpm turbo run check db:types:check contract:check`)
- firebase decommission audit scope now tracks active runtime apps (`apps/backend/src`, `apps/frontend/src`, `apps/agent/src`) instead of legacy backend runtime paths
- active architecture/workflow docs now describe only Nest-first runtime (`README.md`, `docs/ARCHITECTURE.md`, `docs/runbooks/dev-workflow.md`); legacy fallback instructions removed from default runbook
- workspace scope is now active-app-only (`pnpm-workspace.yaml`: `apps/frontend`, `apps/backend`, `apps/agent`)
- pnpm-first guard scope is aligned to active workspace manifests only
- `packages/api-contract` license slice expanded with typed runtime routes (`POST /api/v1/license/lease`, `POST /api/v1/license/heartbeat`, `POST /api/v1/license/revoke`)
- `packages/api-contract` provisioning slice expanded with typed routes for `unattend-profiles` CRUD and `POST /api/v1/provisioning/generate-iso-payload`
- frontend VM operations service now uses contract runtime client for `agents list`, `pairings create`, `vm-ops dispatch`, and `command status`
- `apps/backend` resources module aligned with legacy REST parity (`GET/POST/PATCH/DELETE` + paged/sorted/query list meta), keeping `PUT` as compatibility alias
- `apps/backend` `agents`/`vm-ops`/`resources` controllers now consume schemas from `@botmox/api-contract` (shared validation source, no local schema copies)
- `packages/api-contract` hardened with shared `agentHeartbeatSchema` and non-empty `resourceMutationSchema` to match runtime boundary rules
- `packages/api-contract` ESM runtime build is now Node-compatible (`.js` relative imports in emitted `dist`), unblocking contract runtime checks in CI scripts
- mono gate now includes explicit `any` policy for `apps/*` + `packages/*` (`check:no-any:mono`)
- `check:no-any:mono` expanded to frontend/agent TS scopes with explicit-type patterns (`apps`, `packages`, `apps/frontend/src`, `agent/src`) to avoid comment-text false positives
- frontend/app lint path unified on Biome for `@botmox/frontend` (`apps/frontend` lint now runs Biome over `apps/frontend/src`), and UI-layer service boundaries are enforced via dedicated static gate (`check:ui:boundaries`) wired into `check:all:mono`
- entities-layer legacy service imports are now frozen by dedicated baseline gate (`check:entities:service-boundary` + `configs/entities-service-import-baseline.json`), preventing new `services/*` coupling in `apps/frontend/src/entities`; latest migration waves lowered residual observed imports from `49` to `0` and baseline allowlist entries to `0`
- agent runtime boundary validation hardened with Zod: API envelopes are validated in `ApiClient`, and `/vm-ops/commands/next` payload is schema-checked before command execution
- automated Zod boundary gate added to mono checks (`check:zod:boundaries`): validates boundary parsing coverage in legacy `v1` routes, migrated Nest controllers, and agent runtime boundary files
- legacy vm-ops query boundary hardened with Zod (`/api/v1/vm-ops/commands/next` now validates query via `vmOpsCommandNextQuerySchema` while preserving timeout fallback semantics for invalid numeric input)
- legacy `ipqs` and `wow-names` routes now enforce Zod validation at request boundaries (`ipqs/check`, `ipqs/check-batch`, `wow-names` query)
- legacy `artifacts`/`agents`/`secrets` routes now enforce Zod validation for path/query boundaries (`artifacts assign path+query`, `agents/:id`, `secrets/:id`, `secrets/bindings` query)
- legacy `infra` routes now enforce Zod validation for path/query/body boundaries (node/vmid/action/task params, delete flags query, sendkey body, ssh-vm-config params)
- legacy `vm-ops` routes now enforce Zod path validation for dispatch action + command id boundaries (`/proxmox|syncthing/:action`, `/commands/:id`)
- legacy `vm-ops` routes now enforce Zod query validation for list/events boundaries (`/commands` and `/events` query params)
- legacy `provisioning` progress route now enforces Zod path validation (`/provisioning/progress/:vmUuid`)
- legacy `theme-assets` delete route path validation fixed (`idParamSchema` now parses `req.params` correctly and passes `id` value only)
- legacy `playbooks/validate` route now uses schema-driven body validation (`playbookValidateBodySchema`) instead of manual string checks
- legacy `settings/*` routes now run Zod input validation for wildcard path payload before segment parsing (`settingsPathInputSchema`)
- legacy `resources`/`workspace`/`finance`/`bots` create flows now derive explicit ids from Zod-validated payloads (`parsedBody.data.id`) instead of direct `req.body.id` reads
- strangler parity gate now validates both success and error contract branches (`400/404`) for migrated legacy routes and is wired into `check:all:mono`
- strangler parity gate expanded with bots contract coverage (`list/get/create/patch/delete` + `400/404` branches)
- strangler parity gate expanded with workspace contract coverage (`notes` + `calendar` + `kanban` list/get/create/patch/delete + `400/404` branches)
- strangler parity gate expanded with finance contract coverage (`operations` list/get/create/patch/delete + `daily-stats` + `gold-price-history` + `400/404` branches)
- strangler parity gate expanded with bots lifecycle coverage (`lifecycle`/`transitions`/`is-banned` + `transition`/`ban`/`unban` with `400` validation branches)
- strangler parity gate expanded with playbooks contract coverage (`list/get/create/update/delete/validate` + `422` YAML-validation branch + `404` branch)
- strangler parity gate expanded with wow-names coverage (`batches` + `count` response modes validated against contract `200` branch + invalid query `400` branch)
- strangler parity gate expanded with ipqs coverage (`status`, `check`, `check-batch`, including `400` validation branches)
- strangler parity gate expanded with settings coverage (`api_keys`, `proxy`, `notifications/events`, including `400` validation branches and nullable GET responses)
- strangler parity gate expanded with theme-assets coverage (`list`, `presign-upload`, `complete`, `delete`, including `400`/`404` branches)
- strangler parity gate expanded with vm-ops command-agent coverage (`GET /commands/next` forbidden+success+invalid-timeout branches and `PATCH /commands/:id` validation+success+not-found branches)
- strangler parity gate expanded with vm-ops dispatch invalid-action coverage (`POST /api/v1/vm-ops/proxmox/%20` -> contract `400` branch)
- strangler parity gate expanded with license runtime coverage (`lease`/`heartbeat`/`revoke`, including `400` validation branch and `404` not-found revoke branch)
- strangler parity gate expanded with provisioning coverage (`unattend-profiles` CRUD + `generate-iso-payload` + VM bootstrap `validate-token/report-progress/progress`)
- provisioning parity coverage hardened with explicit `404` contract branches (`PUT /api/v1/unattend-profiles/:id` missing profile, `POST /api/v1/provisioning/generate-iso-payload` with missing `profile_id`)
- provisioning parity coverage expanded with explicit `401` contract branches for invalid token flows (`POST /api/v1/provisioning/validate-token`, `POST /api/v1/provisioning/report-progress`) and `404` missing-delete branch (`DELETE /api/v1/unattend-profiles/:id`)
- strangler routing gate added for middleware behavior (`proxy to nest`, `fallback to legacy`, `502 when fallback disabled`) and wired into `check:all:mono`
- strangler routing gate expanded with `license` module coverage for `POST /api/v1/license/lease` across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with `bots` module coverage (`GET /api/v1/bots`) across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with `theme-assets` module coverage (`GET /api/v1/theme-assets`) across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with `ipqs` and `workspace` module coverage (`GET /api/v1/ipqs/status`, `GET /api/v1/workspace/notes`) across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with `auth`, `agents`, `resources`, `finance`, `playbooks`, and `vm-ops` module coverage (`GET /api/v1/auth/whoami`, `GET /api/v1/agents`, `GET /api/v1/resources/licenses`, `GET /api/v1/finance/operations`, `GET /api/v1/playbooks`, `GET /api/v1/vm-ops/commands`) across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with `secrets` module coverage (`GET /api/v1/secrets/bindings`) across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with `infra` module coverage (`GET /api/v1/infra/proxmox/status`) across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with `artifacts` module coverage (`GET /api/v1/artifacts/assign/:userId/:module`) across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with `diag` and `client-logs` module coverage (`GET /api/v1/diag/trace`, `POST /api/v1/client-logs`) across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with `wow-names` module coverage (`GET /api/v1/wow-names`) across proxy, fallback, and no-fallback scenarios
- strangler routing gate expanded with provisioning coverage for both route prefixes (`GET /api/v1/unattend-profiles`, `POST /api/v1/provisioning/generate-iso-payload`, `POST /api/v1/provisioning/validate-token`) across proxy, fallback, and no-fallback scenarios
- provisioning routing gate coverage expanded with VM bootstrap progress endpoints (`POST /api/v1/provisioning/report-progress`, `GET /api/v1/provisioning/progress/:vmUuid`) across proxy, fallback, and no-fallback scenarios
- strangler resolver now aliases `/api/v1/unattend-profiles` to `provisioning` module for route-switch consistency
- strangler parity + routing checks now cover every currently migrated Nest domain (`auth`, `agents`, `resources`, `workspace`, `finance`, `bots`, `playbooks`, `wow-names`, `ipqs`, `settings`, `theme-assets`, `license`, `vm`, `secrets`, `infra`, `artifacts`, `diag`, `client-logs`, `vm-ops`, `provisioning`)
- Wave-4 infra UI cutover is advanced in Nest (HTTP + websocket proxy path moved + parity/smoke gate integrated); remaining work is final legacy UI proxy bootstrap removal
- legacy contract-adapter gate remains available as standalone script (`scripts/check-legacy-contract-adapters.js`) for archival validation, but it is no longer part of default mono checks
- runbook/env strangler module examples now include `license` in the recommended migrated module set
- runbook/env strangler module examples now include `theme-assets` in the recommended migrated module set
- runbook/env strangler module examples now include `infra` in the recommended migrated module set
- `agentsList` contract now explicitly includes `400` response to match legacy/Nest runtime validation behavior
- auth contract/runtime alignment fixed for strangler safety: legacy `GET /api/v1/auth/verify` now matches contract (`{ valid: true }`), while frontend session identity now resolves through `GET /api/v1/auth/whoami`
- strangler parity gate now also validates `auth` routes (`verify/whoami` + `401` branch), reducing drift risk for `auth` cutover
- GitHub CI migrated to `pnpm` install/cache/execution path (`pnpm-lock.yaml`, single workspace install, pnpm-based Playwright setup)
- root Supabase lifecycle scripts moved from `npx` to `corepack pnpm exec supabase` (`dev:supabase:start/stop/status`) to keep local workflows aligned with pnpm-first policy
- mono gate now includes `check:pnpm:first` to prevent regressions to npm/npx script orchestration
- pnpm-first guard now also scans critical automation sources (`start-dev.js`, Supabase bootstrap, DB type scripts, AntD gate script) for `npm/npx` command regressions
- AntD 6 compatibility gate baseline added (`audit:antd6:gate`) with live pnpm registry peer-dependency check for `@refinedev/antd` before any UI package cutover
- AntD 6 migration checklist/codemod baseline added with static hotspot scanner (`audit:antd6:scan`) and strict combined pre-cutover gate (`audit:antd6:gate:full`)
- AntD pre-cutover e2e gate expanded and executed (`audit:antd6:e2e`): Playwright suite now covers login smoke, auth-guard redirect, and authenticated shell route load with mocked API envelopes (`/`, `/finance`, `/vms`)
- AntD 6 cutover intentionally deferred (`BLOCKED`) while `@refinedev/antd` peer contract does not include `antd@6`; active delivery path remains `antd@5`
- post-hardening mono gate revalidated green (`check:all:mono`) after backend boundary validation updates

## Exit Criteria for Current Wave

1. Root-level monorepo commands exist and are documented.
2. `api-contract` and `database-schema` packages compile.
3. Legacy API can route selected modules to Nest with env-gated fallback.
4. Agent logs are machine-readable and incident-friendly.
5. Audit documents are updated with concrete evidence paths.
