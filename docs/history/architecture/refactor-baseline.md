# Bot-Mox Refactor Baseline (worktree)

Date: 2026-02-10
Owner: refactor execution baseline

## Scope
This document captures the current baseline for phased refactor toward:
- unified backend API (`/api/v1/*`),
- frontend API-first integration,
- RTDB repository layer,
- incremental compatibility for legacy `/api/*` routes.

## Runtime topology
- Frontend app: `apps/frontend/` (React + Refine + Vite)
- Backend server: `apps/backend-legacy/server.js` (legacy monolith + newly mounted `/api/v1`)
- Firebase store (primary): Realtime Database
- Cloud Functions: `functions/` (kept for minimal async/background tasks)

## Legacy backend surface (still active)
- `GET /api/status`
- `GET /api/wow-names`
- `POST /api/check-ip`
- `POST /api/check-ip-batch`
- `POST /api/proxmox/login`
- `GET /api/proxmox/status`
- `GET /api/proxmox/nodes/:node/qemu`
- `POST /api/proxmox/nodes/:node/qemu/:vmid/clone`
- `GET /api/proxmox/nodes/:node/qemu/:vmid/config`
- `PUT /api/proxmox/nodes/:node/qemu/:vmid/config`
- `GET /api/proxmox/nodes/:node/tasks/:upid/status`
- `POST /api/proxmox/nodes/:node/qemu/:vmid/status/:action`
- `DELETE /api/proxmox/nodes/:node/qemu/:vmid`
- `POST /api/proxmox/nodes/:node/qemu/:vmid/sendkey`
- `GET /api/proxmox/nodes/:node/qemu/:vmid/status/current`
- `GET /api/proxmox/cluster/resources`
- `POST /api/ssh/test`
- `POST /api/ssh/exec` (now allowlisted by default)
- `GET /api/ssh/vm-config/:vmid`
- `PUT /api/ssh/vm-config/:vmid`

## Canonical API v1 (new foundation)
Mounted root: `/api/v1`
- `GET /api/v1/health`
- `GET /api/v1/auth/verify`
- `GET /api/v1/auth/whoami`
- `resources`: `/api/v1/resources/{licenses|proxies|subscriptions}`
- `workspace`: `/api/v1/workspace/{notes|calendar|kanban}`
- `settings`: `/api/v1/settings/*`
- `bots`: `/api/v1/bots`
- `infra` (role = `infra`): `/api/v1/infra/*`

Envelope contract:
```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```
```json
{
  "success": false,
  "error": {
    "code": "SOME_CODE",
    "message": "Human readable",
    "details": {}
  }
}
```

## RTDB canonical paths (backend constants)
- `bots`
- `settings`
- `resources/licenses`
- `resources/proxies`
- `resources/subscriptions`
- `resources/virtual_machines`
- `workspace/notes_v2`
- `workspace/calendar_events`
- `workspace/kanban_tasks`

## Security baseline changes introduced
- Security headers: `helmet`
- API rate limit middleware on `/api/*`
- Correlation id per request (`x-correlation-id`)
- Token auth middleware for `/api/v1/*`
- Infra role gate for `/api/v1/infra/*`
- SSH command allowlist in legacy and v1 SSH exec routes

## Known remaining gaps (next phases)
- `apps/backend-legacy/server.js` remains monolithic and should be split into `src/app.ts` + modules.
- Frontend auth/provider cleanup still requires a final pass (strict token lifecycle, role-aware guards).
- Auth flow migration to strict Firebase Auth + guarded app routes is in progress.
- Dependency matrix (`react/refine/antd`) still needs full alignment.
- Firestore and RTDB policy hardening still pending for non-internal environments.

## Latest progress snapshot (2026-02-10)
- API-first polling services introduced:
  - `apps/frontend/src/services/apiClient.ts`
  - `apps/frontend/src/services/botsApiService.ts`
  - `apps/frontend/src/services/resourcesApiService.ts`
  - `apps/frontend/src/services/resourceTreeSettingsService.ts`
- UI files migrated away from direct `firebase/database` imports:
  - `apps/frontend/src/pages/dashboard/index.tsx`
  - `apps/frontend/src/pages/datacenter/index.tsx`
  - `apps/frontend/src/components/layout/Header.tsx`
  - `apps/frontend/src/components/layout/ResourceTree.tsx`
- Metric delta:
  - direct `firebase/database` imports in `pages/components/hooks/services`: `33 -> 29` files.

## Latest progress snapshot (2026-02-10, continuation)
- Added API-first resource domain service for licenses:
  - `apps/frontend/src/services/licensesApiService.ts`
- Extended generic resources API service with CRUD operations:
  - `createResource`, `updateResource`, `deleteResource` in `apps/frontend/src/services/resourcesApiService.ts`
- Migrated settings services to backend `/api/v1/settings/*`:
  - `apps/frontend/src/services/settingsService.ts`
  - `apps/frontend/src/services/projectSettingsService.ts`
- Removed direct Firebase access from:
  - `apps/frontend/src/pages/licenses/index.tsx`
  - `apps/frontend/src/components/bot/BotLicense.tsx`
  - `apps/frontend/src/pages/subscriptions/index.tsx` (bot loading path)
  - `apps/frontend/src/components/bot/BotSubscription.tsx` (bot loading path)
- Metric delta:
  - direct `firebase/database` imports in `pages/components/hooks/services`: `33 -> 23` files.
  - direct `firebase/database` imports in `pages/components`: `14 -> 10` files.

## Latest progress snapshot (2026-02-10, continuation #2)
- Added canonical bot deletion in API v1:
  - backend route `DELETE /api/v1/bots/:id` in `apps/backend-legacy/src/modules/v1/bots.routes.js`
  - frontend helper `deleteBot` in `apps/frontend/src/services/botsApiService.ts`
- Migrated project table page from direct Firebase listeners to API-first subscriptions:
  - `apps/frontend/src/pages/project/index.tsx`
  - uses `subscribeBotsMap` + `subscribeResources` for bots/proxies/subscriptions/licenses
  - bot deletion now calls `/api/v1/bots/:id`
- OpenAPI updated:
  - `docs/api/openapi.yaml` now documents `DELETE /api/v1/bots/{id}`
- Metric delta:
  - direct `firebase/database` imports in `pages/components/hooks/services`: `33 -> 22` files.
  - direct `firebase/database` imports in `pages/components`: `14 -> 9` files.

## Latest progress snapshot (2026-02-10, continuation #3)
- Migrated subscription domain backend access to API-first:
  - `apps/frontend/src/services/subscriptionService.ts` now uses `/api/v1/resources/subscriptions`
  - create/update/delete/list/get-by-id/subscriptions polling all run through API layer
- Updated hook to remove Firebase dynamic imports:
  - `apps/frontend/src/hooks/useSubscriptions.ts` now loads bot metadata via `botsApiService`
  - subscription updates/listeners still keep the same hook contract for UI callers
- Metric delta:
  - direct `firebase/database` imports in `pages/components/hooks/services`: `33 -> 20` files.
  - direct `firebase/database` imports in `pages/components`: `14 -> 9` files.

## Latest progress snapshot (2026-02-10, continuation #4)
- Migrated settings domain services to API-first storage access:
  - `apps/frontend/src/services/apiKeysService.ts` now uses `/api/v1/settings/{api_keys|proxy|notifications/events}`
  - `apps/frontend/src/services/themeService.ts` now uses `/api/v1/settings/theme`
- Migrated proxy data service to backend API:
  - `apps/frontend/src/services/proxyDataService.ts` now uses `resourcesApiService` + `botsApiService`
  - proxy CRUD and bot map subscriptions no longer call RTDB directly
- Migrated bot detail read paths to API-first:
  - `apps/frontend/src/pages/bot/index.tsx` now uses `subscribeBotById`
  - `apps/frontend/src/components/bot/BotSummary.tsx` now resolves linked resources via `/api/v1/resources/*`
  - `apps/frontend/src/components/bot/BotProxy.tsx` now loads/saves proxy assignment via `/api/v1/resources/proxies`
- Migrated VM delete dependency resolver to API-first:
  - `apps/frontend/src/services/vmDeleteContextService.ts` now uses `fetchBotsMap` + `fetchResources`
- Metric delta:
  - direct `firebase/database` imports in `pages/components/hooks/services`: `33 -> 13` files.
  - direct `firebase/database` imports in `pages/components`: `14 -> 6` files.
- Validation:
  - frontend build is green (`npm run build`)
  - no dedicated `check:types` script exists in current `apps/frontend/package.json` (typecheck covered by build step `tsc -b`)

## Latest progress snapshot (2026-02-10, continuation #5)
- Removed remaining direct RTDB usage from bot/page UI components:
  - `apps/frontend/src/components/bot/BotAccount.tsx`
  - `apps/frontend/src/components/bot/BotCharacter.tsx`
  - `apps/frontend/src/components/bot/BotPerson.tsx`
  - `apps/frontend/src/components/bot/BotSchedule.tsx`
  - `apps/frontend/src/components/bot/BotLifeStages.tsx`
  - `apps/frontend/src/components/schedule/ScheduleGenerator.tsx`
- Bot detail tabs now read/patch through API helpers (`/api/v1/bots/*`, `/api/v1/settings/*`) instead of `firebase/database`.
- Metric delta:
  - direct `firebase/database` imports in `pages/components/hooks/services`: `33 -> 7` files.
  - direct `firebase/database` imports in `pages/components`: `14 -> 0` files.
- Validation:
  - frontend build remains green (`npm run build`).

## Latest progress snapshot (2026-02-10, continuation #6)
- Migrated workspace calendar/kanban service layer to canonical API:
  - `apps/frontend/src/services/workspaceService.ts` now uses `/api/v1/workspace/{calendar|kanban}` with polling subscriptions.
- Metric delta:
  - direct `firebase/database` imports in `pages/components/hooks/services`: `33 -> 6` files.
  - remaining RTDB-bound files are now concentrated in service/hook core:
    - `apps/frontend/src/services/notesService.ts`
    - `apps/frontend/src/services/financeService.ts`
    - `apps/frontend/src/services/vmService.ts`
    - `apps/frontend/src/services/vmSettingsService.ts`
    - `apps/frontend/src/hooks/useFirebaseData.ts`
    - `apps/frontend/src/hooks/useVMLog.ts`

## Latest progress snapshot (2026-02-10, continuation #7)
- Backend API v1 expanded for parity and domain migration:
  - added `apps/backend-legacy/src/modules/v1/finance.routes.js`:
    - `/api/v1/finance/operations` CRUD
    - `/api/v1/finance/daily-stats`
    - `/api/v1/finance/gold-price-history`
  - expanded `apps/backend-legacy/src/modules/v1/infra.routes.js` to full Proxmox/SSH parity:
    - proxmox login/status/list/clone/config/update/task/status/action/delete/sendkey/cluster resources
    - ssh test/exec/vm-config read+write
  - router registration updated in `apps/backend-legacy/src/modules/v1/index.js`.
  - RTDB path map extended in `apps/backend-legacy/src/repositories/rtdb/paths.js` (`finance`, `logs`).
- Frontend API-first migration completed for remaining service/hook hotspots:
  - `apps/frontend/src/services/notesService.ts` -> `/api/v1/workspace/notes` (polling subscriptions, legacy block compatibility kept).
  - `apps/frontend/src/services/financeService.ts` -> `/api/v1/finance/*` + `/api/v1/settings/*`.
  - `apps/frontend/src/services/vmService.ts` -> `/api/v1/infra/*` + `/api/v1/bots/*` for `upsertBotVM`.
  - `apps/frontend/src/services/vmSettingsService.ts` -> `/api/v1/settings/vmgenerator*`.
  - `apps/frontend/src/hooks/useFirebaseData.ts` migrated to generic API polling resolver.
  - `apps/frontend/src/hooks/useVMLog.ts` persistence migrated to `/api/v1/settings/vmgenerator/task_logs`.
- Security baseline improvement:
  - removed hardcoded VM credentials from default frontend VM settings payload.
- Metric delta:
  - direct `firebase/database` imports in `pages/components/hooks/services`: `33 -> 0` files.
  - direct `firebase/database` imports in entire `apps/frontend/src`: `0` files.
- Validation:
  - changed frontend files pass targeted ESLint.
  - frontend build is green (`npm run build`).
  - changed backend JS modules pass syntax check (`node --check`).
  - full frontend lint baseline after this phase: `118 errors`, `6 warnings` (`npm run lint`).

## Latest progress snapshot (2026-02-10, continuation #8)
- Phase-8 quality gate push completed across hotspot UI/hooks:
  - eliminated React compiler/lint blockers in finance/bot/pages/components and schedule utilities.
  - normalized state/effect patterns to remove synchronous `setState` in effect bodies where lint required it.
  - removed remaining `any` usage and unused declarations in active refactor scope.
- Frontend technical debt reduction highlights:
  - `apps/frontend/src/components/finance/{FinanceSummary,UniversalChart,GoldPriceChart}.tsx`:
    - moved inline render-components to top-level typed components (static-components compliance).
  - `apps/frontend/src/pages/{licenses,datacenter,bot,notes}.tsx`:
    - stabilized time-based calculations and URL-sync behavior under current lint rules.
    - resolved purity/immutability/effect dependency issues.
  - `apps/frontend/src/components/layout/{Sidebar,Header,ResourceTree}.tsx`:
    - removed or deferred effect-time synchronous state mutations.
- KPI delta:
  - ESLint frontend: `118 errors + 6 warnings -> 0 errors + 0 warnings`.
- Validation:
  - full frontend lint is green (`npm run lint`).
  - frontend production build is green (`npm run build`).

## Latest progress snapshot (2026-02-10, continuation #9)
- Repository hygiene lock:
  - removed tracked dependency artifacts from git index:
    - `scripts/node_modules/*` (14k+ files previously tracked)
  - verification:
    - `git ls-files | rg "node_modules|firebase-key\\.json"` now returns `0`.
- Contracts hardening (backend v1):
  - replaced generic payload validation usage in v1 routes with domain schemas:
    - `resources`, `workspace`, `settings`, `bots`, `finance`, `infra`.
  - schemas centralized in:
    - `apps/backend-legacy/src/contracts/schemas.js`.
- Lifecycle API unification:
  - added backend lifecycle endpoints under `/api/v1/bots/:id/lifecycle/*`:
    - `GET /lifecycle`
    - `GET /lifecycle/transitions`
    - `GET /lifecycle/is-banned`
    - `POST /lifecycle/transition`
    - `POST /lifecycle/ban`
    - `POST /lifecycle/unban`
  - added RTDB paths for lifecycle logs/archive:
    - `archive`
    - `logs/bot_lifecycle`
    - in `apps/backend-legacy/src/repositories/rtdb/paths.js`.
- Frontend lifecycle migration complete:
  - `apps/frontend/src/services/botLifecycleService.ts` now uses `/api/v1` lifecycle routes.
  - removed remaining frontend Firestore usage:
    - `apps/frontend/src/utils/firebase.ts` no longer initializes/exports Firestore.
    - `apps/frontend/src` has no `firebase/firestore` imports.
- Dependency alignment:
  - removed `@refinedev/kbar` from frontend app/deps.
  - removed `<RefineKbarProvider/>` and `<RefineKbar/>` from `apps/frontend/src/App.tsx`.
  - `npm ls @refinedev/antd antd react react-router-dom @refinedev/react-router-v6` returns clean tree (no `ELSPROBLEMS`).
- Performance baseline update:
  - introduced `manualChunks` strategy in `apps/frontend/vite.config.ts`:
    - split groups: `vendor-react`, `vendor-router`, `vendor-antd`, `vendor-charts`, `vendor-editor`, `vendor-firebase`, `vendor-refine`, `vendor-misc`.
- CI quality gates:
  - added GitHub Actions workflow:
    - `.github/workflows/ci.yml`
    - checks: lint, typecheck, build, secret scan, backend syntax checks.
  - local hooks path set:
    - `core.hooksPath=.githooks`.
- Documentation alignment:
  - added handoff runbook:
    - `docs/architecture/refactor-handoff-2026-02-10.md`.
  - expanded API docs:
    - `docs/api/openapi.yaml` with lifecycle + finance + extended infra/workspace endpoints.

## Latest progress snapshot (2026-02-10, continuation #10)
- Backend modular split advanced for IPQS domain:
  - added dedicated service:
    - `apps/backend-legacy/src/modules/ipqs/service.js`
  - added canonical v1 routes:
    - `apps/backend-legacy/src/modules/v1/ipqs.routes.js`
    - mounted via `apps/backend-legacy/src/modules/v1/index.js` at `/api/v1/ipqs/*`
- Legacy compatibility now delegates IPQS to shared service layer:
  - `GET /api/status`
  - `POST /api/check-ip`
  - `POST /api/check-ip-batch`
  - handlers in `apps/backend-legacy/src/legacy-app.js` now call `ipqsService` (no duplicated inline IPQS logic).
- Legacy monolith cleanup:
  - removed old inline IPQS helper functions from `legacy-app.js` (`getIPQSApiKey*`, `isIPQSEnabled`).
  - IPQS behavior now centralized and reusable for both v1 and legacy endpoints.
- Validation:
  - syntax checks are green:
    - `node --check apps/backend-legacy/src/modules/ipqs/service.js`
    - `node --check apps/backend-legacy/src/modules/v1/ipqs.routes.js`
    - `node --check apps/backend-legacy/src/modules/v1/index.js`
    - `node --check apps/backend-legacy/src/legacy-app.js`

## Latest progress snapshot (2026-02-10, continuation #11)
- Backend modular split advanced for WoW names domain:
  - added dedicated service:
    - `apps/backend-legacy/src/modules/wow-names/service.js`
  - added canonical v1 route:
    - `apps/backend-legacy/src/modules/v1/wow-names.routes.js`
    - mounted via `apps/backend-legacy/src/modules/v1/index.js` at `/api/v1/wow-names`.
- Legacy compatibility now delegates WoW names to shared service layer:
  - `GET /api/wow-names` in `apps/backend-legacy/src/legacy-app.js`.
- Legacy monolith cleanup:
  - removed inline WoW names scraping/generator helpers from `legacy-app.js`;
  - route logic now consumes `wowNamesService`.
- API docs parity update:
  - `docs/api/openapi.yaml` includes `/api/v1/wow-names` and `/api/v1/ipqs/*`.
- Validation:
  - syntax checks are green:
    - `node --check apps/backend-legacy/src/modules/wow-names/service.js`
    - `node --check apps/backend-legacy/src/modules/v1/wow-names.routes.js`
    - `node --check apps/backend-legacy/src/modules/v1/index.js`
    - `node --check apps/backend-legacy/src/legacy-app.js`

## Latest progress snapshot (2026-02-10, continuation #12)
- Frontend domain decomposition wave advanced for lifecycle UI hotspot:
  - split `apps/frontend/src/components/bot/BotLifeStages.tsx` into modular subcomponents:
    - `apps/frontend/src/components/bot/lifeStages/config.tsx`
    - `apps/frontend/src/components/bot/lifeStages/StagePanels.tsx`
    - `apps/frontend/src/components/bot/lifeStages/StageTimeline.tsx`
  - resulting `BotLifeStages.tsx` reduced to container/controller role.
- File size gate progress (hotspot target <= 400):
  - `BotLifeStages.tsx`: `832 -> 270` lines.
  - stage rendering logic isolated for safer incremental refactor.
- Validation:
  - frontend lint is green (`npm run lint` in `bot-mox`).
  - frontend build is green (`npm run build` in `bot-mox`).

## Latest progress snapshot (2026-02-10, continuation #13)
- Backend infra service-layer unification completed for proxmox/ssh HTTP routes:
  - added shared infra domain service:
    - `apps/backend-legacy/src/modules/infra/service.js`
  - added legacy compatibility router using the same service:
    - `apps/backend-legacy/src/modules/infra/legacy-routes.js`
  - refactored canonical v1 infra routes to use shared service:
    - `apps/backend-legacy/src/modules/v1/infra.routes.js`
  - refactored legacy app wiring to mount shared legacy infra router:
    - `apps/backend-legacy/src/legacy-app.js`
- Legacy monolith cleanup:
  - removed duplicated inline legacy Proxmox/SSH endpoint handlers from `legacy-app.js`.
  - size delta:
    - `apps/backend-legacy/src/legacy-app.js`: `1924 -> 1576` lines.
- Service-layer convergence milestone:
  - both `/api/v1/infra/*` and legacy `/api/proxmox/*`, `/api/ssh/*` now pass through one infra business logic module.
- Validation:
  - syntax checks are green:
    - `node --check apps/backend-legacy/src/modules/infra/service.js`
    - `node --check apps/backend-legacy/src/modules/infra/legacy-routes.js`
    - `node --check apps/backend-legacy/src/modules/v1/infra.routes.js`
    - `node --check apps/backend-legacy/src/legacy-app.js`
  - module load smoke check is green:
    - `node -e "require('./apps/backend-legacy/src/modules/infra/service'); require('./apps/backend-legacy/src/modules/infra/legacy-routes'); require('./apps/backend-legacy/src/modules/v1/infra.routes');"`

## Latest progress snapshot (2026-02-10, continuation #14)
- Quality gate scripts expanded for backend refactor safety:
  - added root scripts in `package.json`:
    - `check:backend:syntax`
    - `check:backend:smoke`
  - updated `check:all` to include backend syntax/smoke verification.
- CI workflow upgraded:
  - `.github/workflows/ci.yml` now runs:
    - `npm run check:backend:syntax`
    - `npm run check:backend:smoke`
- Smoke modules currently covered:
  - infra service + infra legacy adapter + v1 infra routes
  - IPQS service + v1 IPQS routes
  - WoW names service + v1 WoW names routes
  - bots v1 routes load check
- Validation:
  - `npm run -s check:backend:syntax` is green.
  - `npm run -s check:backend:smoke` is green (`backend smoke OK`).

## Latest progress snapshot (2026-02-10, continuation #15)
- Frontend hotspot decomposition advanced for layout navigation tree:
  - refactored `apps/frontend/src/components/layout/ResourceTree.tsx` into modular structure:
    - `apps/frontend/src/components/layout/resourceTree/types.ts`
    - `apps/frontend/src/components/layout/resourceTree/tree-utils.tsx`
    - `apps/frontend/src/components/layout/resourceTree/builders.ts`
    - `apps/frontend/src/components/layout/resourceTree/parts.tsx`
    - `apps/frontend/src/components/layout/resourceTree/navigation.ts`
- Architectural result:
  - `ResourceTree.tsx` now acts as container/composition layer;
  - icon rendering, tree conversion, grouping, route mapping, and UI fragments extracted into reusable modules.
- File-size gate progress:
  - `apps/frontend/src/components/layout/ResourceTree.tsx`: `982 -> 399` lines (target `<= 400` achieved).
- Validation:
  - frontend lint is green (`npm run -s lint` in `bot-mox`).
  - frontend build is green (`npm run -s build` in `bot-mox`).
  - backend smoke/syntax checks remain green:
    - `npm run -s check:backend:syntax`
    - `npm run -s check:backend:smoke`

## Latest progress snapshot (2026-02-10, continuation #16)
- Frontend hotspot decomposition advanced for account domain:
  - refactored `apps/frontend/src/components/bot/BotAccount.tsx` into container-oriented component.
  - extracted account modules:
    - `apps/frontend/src/components/bot/account/types.ts`
    - `apps/frontend/src/components/bot/account/settings-storage.ts`
    - `apps/frontend/src/components/bot/account/use-account-generator-state.ts`
    - `apps/frontend/src/components/bot/account/use-bot-account-subscription.ts`
    - `apps/frontend/src/components/bot/account/sections.tsx`
- Architecture impact:
  - template storage/migration logic isolated from UI container;
  - bot account subscription/state-sync isolated into dedicated hook;
  - form sections modularized (email/password/options/presets/actions/modal/loading states).
- File size gate progress:
  - `apps/frontend/src/components/bot/BotAccount.tsx`: `1193 -> 384` lines (target `<= 400` achieved).
- Validation:
  - frontend lint is green (`npm run -s lint` in `bot-mox`).
  - frontend build is green (`npm run -s build` in `bot-mox`).
  - root quality gate is green (`npm run -s check:all`).

## Latest progress snapshot (2026-02-10, continuation #17)
  - `package.json` `check:backend:smoke` now includes module load check:
- Validation:
  - `npm run -s check:backend:smoke` is green (`backend smoke OK`).
  - root `npm run -s check:all` remains green.

## Latest progress snapshot (2026-02-10, continuation #18)
    - route mount
    - init
    - websocket attach
    - shutdown
- Quality gates extended:
  - `package.json`:
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #19)
- VM operations ws branch extracted from legacy monolith:
  - added `apps/backend-legacy/src/modules/infra/vm-operations-ws.js`.
  - `apps/backend-legacy/src/legacy-app.js` now delegates VM queue ws logic via:
    - `attachVmOperationsWebSocket({ server, proxmoxRequest, sshExec, getDefaultNode })`.
- Monolith reduction metric:
  - `apps/backend-legacy/src/legacy-app.js`: `1576 -> 1431` lines.
- Quality gates updated:
  - `check:backend:syntax` includes vm-operations ws module.
  - `check:backend:smoke` includes vm-operations ws module load check.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #20)
- UI proxy websocket upgrade branch extracted from legacy monolith:
  - added `apps/backend-legacy/src/modules/infra/ui-proxy-upgrade.js`.
  - `apps/backend-legacy/src/legacy-app.js` now delegates upgrade routing through:
    - `attachUiProxyUpgradeHandler(...)`.
    - status/settings/connect/enable/disable
    - auth send-code/sign-in
    - monitored-topics/whitelist/topic-mappings/costs/source-groups.
- Monolith reduction metric:
  - `apps/backend-legacy/src/legacy-app.js`: `1431 -> 1269` lines.
- Quality gates updated:
  - `check:backend:syntax` includes `src/modules/infra/ui-proxy-upgrade.js`.
  - `check:backend:smoke` includes module load check for `ui-proxy-upgrade`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #21)
- UI proxy HTTP fallback branch extracted from legacy monolith:
  - added `apps/backend-legacy/src/modules/infra/ui-fallback-middleware.js`.
  - `apps/backend-legacy/src/legacy-app.js` now delegates:
    - service-aware iframe fallback middleware (`tinyfm`/`syncthing`)
    - proxmox non-API catch-all middleware.
- Monolith reduction metric:
  - `apps/backend-legacy/src/legacy-app.js`: `1269 -> 1258` lines.
- Quality gates updated:
  - `check:backend:syntax` includes `src/modules/infra/ui-fallback-middleware.js`.
  - `check:backend:smoke` includes module load check for `ui-fallback-middleware`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #22)
- Pre-body UI proxy route wiring extracted from legacy monolith:
  - added `apps/backend-legacy/src/modules/infra/ui-proxy-routes.js`.
  - `apps/backend-legacy/src/legacy-app.js` now delegates:
    - proxmox UI route set (`/proxmox-ui`, `/pve2`, `/api2`, `/novnc`, etc.)
    - `/tinyfm-ui`
    - `/syncthing-ui`
    via `mountUiProxyRoutes(...)`.
- Monolith reduction metric:
  - `apps/backend-legacy/src/legacy-app.js`: `1258 -> 1173` lines.
- Quality gates updated:
  - `check:backend:syntax` includes `src/modules/infra/ui-proxy-routes.js`.
  - `check:backend:smoke` includes module load check for `ui-proxy-routes`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #23)
- Frontend hotspot decomposition executed for project page:
  - `apps/frontend/src/pages/project/index.tsx` converted to container-focused composition.
  - extracted project modules:
    - `apps/frontend/src/pages/project/types.ts`
    - `apps/frontend/src/pages/project/utils.ts`
    - `apps/frontend/src/pages/project/selectors.ts`
    - `apps/frontend/src/pages/project/columns.tsx`
- File-size gate progress:
  - `apps/frontend/src/pages/project/index.tsx`: `820 -> 298` lines (target `<= 400` achieved).
- Behavior parity retained:
  - same API subscriptions and polling intervals for bots/resources/settings,
  - same status/search filtering and query param sync,
  - same account delete flow and bot-tab navigation routing.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #24)
- VM service auth/settings helper branch extracted from legacy monolith:
  - added `apps/backend-legacy/src/modules/infra/ui-service-auth.js`.
  - `apps/backend-legacy/src/legacy-app.js` now delegates VM service settings + TinyFM/SyncThing auth/resolver logic to shared helper factory:
    - `createUiServiceAuth(...)`.
- Monolith reduction metric:
  - `apps/backend-legacy/src/legacy-app.js`: `1173 -> 786` lines.
- Quality gates updated:
  - `check:backend:syntax` includes `src/modules/infra/ui-service-auth.js`.
  - `check:backend:smoke` includes module load check for `ui-service-auth`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #25)
- Frontend hotspot decomposition executed for datacenter page:
  - `apps/frontend/src/pages/datacenter/index.tsx` converted to container-focused component.
  - extracted presentational layer:
    - `apps/frontend/src/pages/datacenter/content-map.tsx`.
- File-size gate progress:
  - `apps/frontend/src/pages/datacenter/index.tsx`: `769 -> 375` lines (target `<= 400` achieved).
- Behavior parity retained:
  - same subscriptions/polling timings and calculations;
  - same content-map collapse persistence and navigation interactions;
  - same expiring item aggregation rules.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #26)
- Datacenter presentational decomposition wave #2 completed:
  - split content-map UI into modular sections:
    - `apps/frontend/src/pages/datacenter/content-map.tsx`
    - `apps/frontend/src/pages/datacenter/content-map-types.ts`
    - `apps/frontend/src/pages/datacenter/content-map-sections.tsx`
    - `apps/frontend/src/pages/datacenter/content-map-sections-secondary.tsx`
- File-size control progress:
  - `apps/frontend/src/pages/datacenter/content-map.tsx`: `471 -> 115`.
  - each section module remains below 400 lines.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #27)
- Bot account sections decomposition completed:
  - `apps/frontend/src/components/bot/account/sections.tsx` converted to barrel-only exports.
  - extracted modules:
    - `credentials-sections.tsx`
    - `generator-sections.tsx`
    - `state-sections.tsx`
    - `modals.tsx`
- File-size control progress:
  - `sections.tsx`: `642 -> 18`.
  - each extracted account module remains within `<= 400` lines.
- Compatibility:
  - external imports through `./account/sections` remain stable.
- Validation:
  - root `npm run -s check:all` is green.

Last updated: 2026-02-10 (session continuation)

## Latest progress snapshot (2026-02-10, continuation #28)
- Infra connectors + proxy stack extraction completed:
  - added `apps/backend-legacy/src/modules/infra/connectors.js`.
  - added `apps/backend-legacy/src/modules/infra/ui-proxy-stack.js`.
  - `apps/backend-legacy/src/legacy-app.js` now delegates shared:
    - Proxmox session/auth/request
    - SSH transport
    - UI proxy stack + cookie helpers.
- Monolith reduction metric:
  - `apps/backend-legacy/src/legacy-app.js`: `786 -> 502` lines.
- Quality gates updated:
  - `check:backend:syntax` includes both new infra modules.
  - `check:backend:smoke` includes module load checks for both modules.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #29)
- Legacy public routes + runtime bootstrap extraction completed:
  - added `apps/backend-legacy/src/modules/system/legacy-public-routes.js`.
  - added `apps/backend-legacy/src/bootstrap/firebase-admin.js`.
  - added `apps/backend-legacy/src/bootstrap/runtime.js`.
  - `apps/backend-legacy/src/legacy-app.js` now delegates:
    - `/api/status`, `/api/wow-names`, `/api/check-ip`, `/api/check-ip-batch`
- Monolith reduction metric:
  - `apps/backend-legacy/src/legacy-app.js`: `502 -> 320` lines.
- Quality gates updated:
  - `check:backend:syntax` includes new bootstrap/system modules.
  - `check:backend:smoke` includes module load checks for same modules.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #30)
- HTTP middleware + UI target state extraction completed:
  - added `apps/backend-legacy/src/bootstrap/http-middleware.js`.
  - added `apps/backend-legacy/src/bootstrap/ui-targets.js`.
  - `apps/backend-legacy/src/legacy-app.js` now delegates:
    - CORS options factory and core middleware mounting
    - legacy 404/error handlers
    - proxmox/tinyfm/syncthing UI target getters/setters.
- Monolith reduction metric:
  - `apps/backend-legacy/src/legacy-app.js`: `320 -> 256` lines.
- Quality gates updated:
  - `check:backend:syntax` includes new bootstrap modules.
  - `check:backend:smoke` includes module load checks for new bootstrap modules.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #31)
- Domain service composition extraction completed:
  - added `apps/backend-legacy/src/bootstrap/domain-services.js`.
- Monolith reduction metric:
  - `apps/backend-legacy/src/legacy-app.js`: `256 -> 249` lines (`< 250` target achieved).
- Quality gates updated:
  - `check:backend:syntax` includes `src/bootstrap/domain-services.js`.
  - `check:backend:smoke` includes module load check for `domain-services`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #32)
- Frontend unification iteration completed for duplicated table row-actions:
  - added shared UI primitives:
    - `apps/frontend/src/components/ui/TableActionButton.tsx`
    - `apps/frontend/src/components/ui/TableActionButton.css`
  - migrated duplicated icon action patterns to shared components:
    - `apps/frontend/src/components/finance/FinanceTransactions.tsx`
    - `apps/frontend/src/pages/subscriptions/index.tsx`
    - `apps/frontend/src/pages/proxies/proxyColumns.tsx`
  - removed local duplicate style in:
    - `apps/frontend/src/components/finance/FinanceTransactions.css` (`.action-btn*`).
- Refactor objective achieved in this iteration:
  - consistent single-source implementation for common row-action button/group behavior in migrated domains.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #33)
  - migrated to shared `TableActionButton` in:
    - `apps/frontend/src/pages/workspace/calendar/index.tsx`
    - `apps/frontend/src/pages/workspace/kanban/index.tsx`
- Refactor objective achieved in this continuation:
  - reduced duplicated icon-row action implementations (`type="text" size="small"`) in high-traffic workspace modules.
  - action behavior now aligns with the shared UI primitive introduced in continuation #32.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #34)
- Frontend unification wave #3 completed for project/schedule row actions:
  - migrated to shared `TableActionButton` in:
    - `apps/frontend/src/pages/project/columns.tsx`
    - `apps/frontend/src/components/schedule/SessionList.tsx`
- Refactor objective achieved in this continuation:
  - further reduced duplicated edit/delete action button implementations.
  - aligned project/schedule action controls with the shared table action primitive.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #35)
- Frontend unification wave #4 completed for licenses/notes/subscription action controls:
  - migrated to shared `TableActionButton`/`TableActionGroup` in:
    - `apps/frontend/src/pages/licenses/index.tsx`
    - `apps/frontend/src/components/bot/BotSubscription.tsx`
    - `apps/frontend/src/components/notes/NoteSidebar.tsx`
    - `apps/frontend/src/components/notes/NoteEditor.tsx`
- Refactor objective achieved in this continuation:
  - reduced additional duplicated inline action button implementations across list/table item actions.
  - expanded centralized action component coverage in core dashboard domains.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #36)
- Frontend unification wave #5 completed for bot license action controls:
  - migrated to shared `TableActionButton` in:
    - `apps/frontend/src/components/bot/BotLicense.tsx`
      - edit/unassign header actions
      - license key copy action.
- Refactor objective achieved in this continuation:
  - additional reduction of duplicated inline text action buttons in bot domain.
  - increased single-source reuse coverage for action controls.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #37)
- Frontend unification wave #6 completed for schedule template row-actions:
  - migrated in `apps/frontend/src/components/schedule/ScheduleGenerator.tsx`:
    - template load icon action
    - template delete icon action
  - now uses shared `TableActionButton`.
- Refactor objective achieved in this continuation:
  - reduced remaining duplicated small text icon-action controls in schedule tooling.
  - further increased shared action primitive coverage.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #38)
- Shared action primitive generalized and adopted for additional non-table controls:
  - `apps/frontend/src/components/ui/TableActionButton.tsx` enhanced with optional `buttonType`/`buttonSize`.
  - `apps/frontend/src/components/ui/TableActionButton.css` scoped styling to text variant.
  - migrated delete actions to shared component in:
    - `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx`
    - `apps/frontend/src/components/bot/account/generator-sections.tsx`
- Refactor objective achieved in this continuation:
  - expanded reusable action-button contract beyond row-actions and reduced duplicated preset/theme control button implementations.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #39)
- Bot summary split stabilization completed:
  - fixed post-decomposition typing/lint wiring in:
    - `apps/frontend/src/components/bot/summary/sections-overview.tsx`
    - `apps/frontend/src/components/bot/summary/sections-details.tsx`
  - validated stable composition contract in:
    - `apps/frontend/src/components/bot/BotSummary.tsx`
    - `apps/frontend/src/components/bot/summary/sections.tsx`
- File-size control progress:
  - `apps/frontend/src/components/bot/BotSummary.tsx`: `> 400 -> 236` lines (target `<= 400` confirmed).
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #40)
- Frontend hotspot decomposition executed for subscriptions page:
  - `apps/frontend/src/pages/subscriptions/index.tsx` converted to container-focused composition.
  - extracted modules:
    - `apps/frontend/src/pages/subscriptions/subscription-status.ts`
    - `apps/frontend/src/pages/subscriptions/subscription-columns.tsx`
    - `apps/frontend/src/pages/subscriptions/ExpiringSubscriptionsAlert.tsx`
    - `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx`
- File-size control progress:
  - `apps/frontend/src/pages/subscriptions/index.tsx`: `457 -> 242` lines (target `<= 400` achieved).
- Consolidated progress metrics:
  - files over 400 lines in `apps/frontend/src`: `25 -> 14`.
  - `apps/backend-legacy/src/legacy-app.js`: `224` lines.
  - direct `firebase/database` imports in `apps/frontend/src`: `0`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #41)
- Frontend unification wave applied for VM row actions:
  - migrated `apps/frontend/src/components/vm/VMList.tsx` table action controls to shared:
    - `TableActionButton`
    - `TableActionGroup`
- Refactor objective achieved:
  - removed duplicated local action pattern (`Button + Tooltip + Space`) for VM start/stop controls.
  - increased shared action primitive coverage across VM domain.
- Metrics:
  - `TableActionButton/TableActionGroup` references in `apps/frontend/src`: `78`.
  - files over 400 lines in `apps/frontend/src`: `14` (unchanged this continuation).
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #42)
- Frontend hotspot decomposition executed for bot proxy domain:
  - `apps/frontend/src/components/bot/BotProxy.tsx` converted to container-focused composition.
  - extracted modules:
    - `apps/frontend/src/components/bot/proxy/types.ts`
    - `apps/frontend/src/components/bot/proxy/helpers.tsx`
    - `apps/frontend/src/components/bot/proxy/ProxyEditorModal.tsx`
    - `apps/frontend/src/components/bot/proxy/ProxyDetailsCard.tsx`
    - `apps/frontend/src/components/bot/proxy/ProxyEmptyCard.tsx`
    - `apps/frontend/src/components/bot/proxy/ProxyStatusAlert.tsx`
    - `apps/frontend/src/components/bot/proxy/ProxyIpqsResults.tsx`
    - `apps/frontend/src/components/bot/proxy/ProxyParsedAlert.tsx`
    - `apps/frontend/src/components/bot/proxy/index.ts`
- File-size control progress:
  - `apps/frontend/src/components/bot/BotProxy.tsx`: `587 -> 232` lines (target `<= 400` achieved).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src`: `14 -> 13`.
  - `TableActionButton/TableActionGroup` references in `apps/frontend/src`: `80`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #43)
- Frontend hotspot decomposition executed for schedule timeline module:
  - extracted repeated timeline view blocks from:
    - `apps/frontend/src/components/schedule/TimelineVisualizer.tsx`
  - into:
    - `apps/frontend/src/components/schedule/timeline/TimelineHeader.tsx`
    - `apps/frontend/src/components/schedule/timeline/TimelineScale.tsx`
- File-size control progress:
  - `apps/frontend/src/components/schedule/TimelineVisualizer.tsx`: `422 -> 359` lines (target `<= 400` achieved).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src`: `13 -> 12`.
  - `TableActionButton/TableActionGroup` references in `apps/frontend/src`: `80`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #44)
- Frontend hotspot decomposition executed for character domain:
  - `apps/frontend/src/components/bot/BotCharacter.tsx` converted to container-focused composition.
  - extracted modules:
    - `apps/frontend/src/components/bot/character/types.ts`
    - `apps/frontend/src/components/bot/character/constants.ts`
    - `apps/frontend/src/components/bot/character/helpers.ts`
    - `apps/frontend/src/components/bot/character/CharacterViewMode.tsx`
    - `apps/frontend/src/components/bot/character/CharacterEditForm.tsx`
    - `apps/frontend/src/components/bot/character/CharacterStateCards.tsx`
    - `apps/frontend/src/components/bot/character/index.ts`
- File-size control progress:
  - `apps/frontend/src/components/bot/BotCharacter.tsx`: `700 -> 299` lines (target `<= 400` achieved).
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #45)
- Frontend hotspot decomposition executed for bot page orchestration:
  - `apps/frontend/src/pages/bot/index.tsx` converted to route/container orchestration module.
  - extracted page composition modules:
    - `apps/frontend/src/pages/bot/page/types.ts`
    - `apps/frontend/src/pages/bot/page/tab-utils.ts`
    - `apps/frontend/src/pages/bot/page/completeness.ts`
    - `apps/frontend/src/pages/bot/page/sections.tsx`
    - `apps/frontend/src/pages/bot/page/states.tsx`
    - `apps/frontend/src/pages/bot/page/index.ts`
- File-size control progress:
  - `apps/frontend/src/pages/bot/index.tsx`: `482 -> 163` lines (target `<= 400` achieved).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src`: `12 -> 10`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #46)
- Frontend hotspot decomposition executed for licenses page:
  - `apps/frontend/src/pages/licenses/index.tsx` converted to container-focused composition.
  - extracted modules:
    - `apps/frontend/src/pages/licenses/page/types.ts`
    - `apps/frontend/src/pages/licenses/page/helpers.ts`
    - `apps/frontend/src/pages/licenses/page/LicensesStats.tsx`
    - `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx`
    - `apps/frontend/src/pages/licenses/page/LicenseModals.tsx`
    - `apps/frontend/src/pages/licenses/page/modal-helpers.ts`
    - `apps/frontend/src/pages/licenses/page/index.ts`
- File-size control progress:
  - `apps/frontend/src/pages/licenses/index.tsx`: `704 -> 273` lines (target `<= 400` achieved).
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #47)
- Frontend hotspot decomposition executed for workspace calendar page:
  - `apps/frontend/src/pages/workspace/calendar/index.tsx` converted to container-focused composition.
  - extracted modules:
    - `apps/frontend/src/pages/workspace/calendar/page/types.ts`
    - `apps/frontend/src/pages/workspace/calendar/page/helpers.ts`
    - `apps/frontend/src/pages/workspace/calendar/page/CalendarMainPanel.tsx`
    - `apps/frontend/src/pages/workspace/calendar/page/CalendarEventList.tsx`
    - `apps/frontend/src/pages/workspace/calendar/page/CalendarEventModal.tsx`
    - `apps/frontend/src/pages/workspace/calendar/page/index.ts`
- File-size control progress:
  - `apps/frontend/src/pages/workspace/calendar/index.tsx`: `488 -> 255` lines (target `<= 400` achieved).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src`: `10 -> 8`.
  - `TableActionButton/TableActionGroup` references in `apps/frontend/src`: `84`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #48)
- Frontend hotspot decomposition executed for bot person domain:
  - `apps/frontend/src/components/bot/BotPerson.tsx` converted to container-focused composition.
  - extracted modules:
    - `apps/frontend/src/components/bot/person/types.ts`
    - `apps/frontend/src/components/bot/person/helpers.ts`
    - `apps/frontend/src/components/bot/person/PersonCardStates.tsx`
    - `apps/frontend/src/components/bot/person/PersonFormFields.tsx`
    - `apps/frontend/src/components/bot/person/index.ts`
- File-size control progress:
  - `apps/frontend/src/components/bot/BotPerson.tsx`: `573 -> 178` lines (target `<= 400` achieved).
- Notes:
  - removed debug-heavy form/init logic from container into reusable person helpers/UI blocks.
  - fixed lint blocker in person typing layer (`@typescript-eslint/no-empty-object-type`).
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #49)
- Frontend hotspot decomposition executed for bot subscription domain:
  - `apps/frontend/src/components/bot/BotSubscription.tsx` converted to container-focused composition.
  - extracted modules:
    - `apps/frontend/src/components/bot/subscription/types.ts`
    - `apps/frontend/src/components/bot/subscription/helpers.tsx`
    - `apps/frontend/src/components/bot/subscription/SubscriptionAlerts.tsx`
    - `apps/frontend/src/components/bot/subscription/SubscriptionListItem.tsx`
    - `apps/frontend/src/components/bot/subscription/SubscriptionModal.tsx`
    - `apps/frontend/src/components/bot/subscription/index.ts`
- File-size control progress:
  - `apps/frontend/src/components/bot/BotSubscription.tsx`: `405 -> 172` lines (target `<= 400` achieved).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src/components + apps/frontend/src/pages`: `9 -> 8`.
  - `TableActionButton/TableActionGroup` references in `apps/frontend/src`: `84`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #50)
- Frontend hotspot decomposition executed for VM settings form domain:
  - `apps/frontend/src/components/vm/VMSettingsForm.tsx` converted to container-focused composition.
  - extracted modules:
    - `apps/frontend/src/components/vm/settingsForm/types.ts`
    - `apps/frontend/src/components/vm/settingsForm/helpers.ts`
    - `apps/frontend/src/components/vm/settingsForm/ProxmoxSection.tsx`
    - `apps/frontend/src/components/vm/settingsForm/SshSection.tsx`
    - `apps/frontend/src/components/vm/settingsForm/TemplateStorageSection.tsx`
    - `apps/frontend/src/components/vm/settingsForm/ProjectResourcesSection.tsx`
    - `apps/frontend/src/components/vm/settingsForm/ServiceUrlsSection.tsx`
    - `apps/frontend/src/components/vm/settingsForm/SettingsActions.tsx`
    - `apps/frontend/src/components/vm/settingsForm/index.ts`
- File-size control progress:
  - `apps/frontend/src/components/vm/VMSettingsForm.tsx`: `511 -> 162` lines (target `<= 400` achieved).
- Notes:
  - preserved template auto-sync behavior while centralizing field path updates in helper layer.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #51)
- Frontend hotspot decomposition executed for life stages chart section:
  - extracted shared chart block from:
    - `apps/frontend/src/components/bot/lifeStages/StagePanels.tsx`
  - into:
    - `apps/frontend/src/components/bot/lifeStages/SimpleBarChart.tsx`
- File-size control progress:
  - `apps/frontend/src/components/bot/lifeStages/StagePanels.tsx`: `406 -> 379` lines (target `<= 400` achieved).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src/components + apps/frontend/src/pages`: `8 -> 6`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #52)
- Frontend file-size gate cleanup executed for bot schedule module:
  - reduced `apps/frontend/src/components/bot/BotSchedule.tsx` below hotspot threshold without behavior changes.
- File-size control progress:
  - `apps/frontend/src/components/bot/BotSchedule.tsx`: `403 -> 399` lines (target `<= 400` achieved).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src/components + apps/frontend/src/pages`: `6 -> 5`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #53)
- Frontend decomposition executed for VM delete workflow hook:
  - extracted workflow hook contracts into:
    - `apps/frontend/src/pages/vms/hooks/deleteVmWorkflow.types.ts`
  - updated:
    - `apps/frontend/src/pages/vms/hooks/useDeleteVmWorkflow.ts` to use shared contracts.
- File-size control progress:
  - `apps/frontend/src/pages/vms/hooks/useDeleteVmWorkflow.ts`: `408 -> 371` lines (target `<= 400` achieved).
- Notes:
  - behavior unchanged; refactor focused on type/contract separation and maintainability.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #54)
- Frontend decomposition executed for VM page modal orchestration:
  - extracted modal composition from:
    - `apps/frontend/src/pages/vms/VMsPage.tsx`
  - into:
    - `apps/frontend/src/pages/vms/page/VMPageModals.tsx`
- File-size control progress:
  - `apps/frontend/src/pages/vms/VMsPage.tsx`: `447 -> 400` lines (hotspot threshold removed).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src/components + apps/frontend/src/pages`: `5 -> 3`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #55)
- Frontend decomposition executed for datacenter page helper layer:
  - extracted datacenter constants and project status builders from:
    - `apps/frontend/src/pages/datacenter/index.tsx`
  - into:
    - `apps/frontend/src/pages/datacenter/page-helpers.ts`
- File-size control progress:
  - `apps/frontend/src/pages/datacenter/index.tsx`: `430 -> 396` lines (target `<= 400` achieved).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src/components + apps/frontend/src/pages`: `3 -> 2`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #56)
- Frontend decomposition executed for schedule generator configuration layer:
  - extracted generator defaults/constraints/template mapping from:
    - `apps/frontend/src/components/schedule/ScheduleGenerator.tsx`
  - into:
    - `apps/frontend/src/components/schedule/generator-config.ts`
- File-size control progress:
  - `apps/frontend/src/components/schedule/ScheduleGenerator.tsx`: `417 -> 384` lines (target `<= 400` achieved).
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #57)
- Frontend decomposition executed for timeline helper layer:
  - extracted timeline calculations/segment builders from:
    - `apps/frontend/src/components/schedule/TimelineVisualizer.tsx`
  - into:
    - `apps/frontend/src/components/schedule/timeline/helpers.ts`
- File-size control progress:
  - `apps/frontend/src/components/schedule/TimelineVisualizer.tsx`: `410 -> 308` lines (target `<= 400` achieved).
- Consolidated metrics:
  - files over 400 lines in `apps/frontend/src/components + apps/frontend/src/pages`: `2 -> 0`.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #58)
- Backend contract hardening executed for canonical `v1` routes:
  - `apps/backend-legacy/src/modules/v1/resources.routes.js`
    - switched to `getResourceCreateSchema(kind)` and `getResourcePatchSchema(kind)` (kind-aware payload validation).
  - `apps/backend-legacy/src/modules/v1/workspace.routes.js`
    - switched to `getWorkspaceCreateSchema(kind)` and `getWorkspacePatchSchema(kind)` (kind-aware payload validation).
  - `apps/backend-legacy/src/modules/v1/settings.routes.js`
    - added settings path parsing/segment validation (`.` `..` and RTDB-illegal chars rejected),
    - switched to `resolveSettingsMutationSchema(subPath)` for path-specific request validation.
  - `apps/backend-legacy/src/contracts/schemas.js`
    - fixed missing `scheduleTemplateEntryMutationSchema`,
    - added typed settings mutation schemas for key subpaths:
      - `api_keys`, `proxy`, `notifications/events`,
      - `projects` and `projects/:id` (+ `gold_price_usd`),
      - `finance/chart_config`,
      - `ui/resource_tree`,
      - `schedule/templates` and `schedule/templates/:id`,
      - `vmgenerator/profiles` and `vmgenerator/profiles/:id`,
      - `generators/account/*`.
- Intent/impact:
  - improved schema strictness and path safety for mutating routes without changing endpoint topology.
  - reduced runtime risk from undefined schema symbol and permissive generic payload handling.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #59)
- Post-hardening verification sweep executed:
  - `apps/frontend/src/services/botLifecycleService.ts` confirmed API-first (`/api/v1/bots/:id/lifecycle/*`) with no Firestore usage.
  - `apps/frontend/src/pages` + `apps/frontend/src/components` confirmed with zero direct `firebase/database` imports.
  - backend thin-entry status confirmed:
    - `apps/backend-legacy/server.js`: 3 lines,
    - `apps/backend-legacy/src/legacy-app.js`: 224 lines.
  - dependency-health check confirmed:
    - `npm ls` in `bot-mox` completes without peer/dependency errors.
- Build/perf snapshot:
  - `npm run -s build` succeeds without chunk warnings.
  - primary remaining bundle pressure is in initial vendor chunks:
    - `vendor-antd`: ~`1308.75 kB` raw / `409.28 kB` gzip,
    - `vendor-misc`: ~`1406.32 kB` raw / `478.45 kB` gzip.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #60)
- Quality-gate hardening pass completed:
  - added bundle budget checker:
    - `scripts/check-bundle-budgets.js`
  - added root script:
    - `check:bundle:budgets`
  - upgraded root gate:
    - `check:all` now includes frontend build + bundle budget validation.
  - upgraded CI workflow:
    - `.github/workflows/ci.yml` includes dedicated bundle-budget step after build.
- OpenAPI alignment pass completed:
  - `docs/api/openapi.yaml` updated to document:
    - typed mutation schema groups for `resources` and `workspace`,
    - path-aware `settings/{path}` mutation contract and `400` invalid path/payload response.
- Validation:
  - bundle gate: largest JS chunk within budget (`~1.34 MB raw`, `~466.56 KB gzip`).
  - root `npm run -s check:all` is green with new gates.

## Latest progress snapshot (2026-02-10, continuation #61)
- Security/access-control parity pass completed:
  - added centralized audit middleware:
    - `apps/backend-legacy/src/middleware/audit-log.js`
  - enabled audit logging on infra mutating surfaces:
    - `/api/v1/infra/*` in `apps/backend-legacy/src/modules/v1/index.js`,
    - legacy `/api/proxmox/*` and `/api/ssh/*` in `apps/backend-legacy/src/legacy-app.js`.
  - hardened legacy public API routes with auth + audit:
    - `/api/wow-names`, `/api/check-ip`, `/api/check-ip-batch`
    - `apps/backend-legacy/src/modules/system/legacy-public-routes.js`.
- Frontend API-first consolidation completed for WoW names/IPQS:
  - `apps/frontend/src/components/bot/BotCharacter.tsx` moved from direct legacy fetch to service call.
  - added `apps/frontend/src/services/wowNamesService.ts` (canonical `/api/v1/wow-names`).
  - `apps/frontend/src/services/ipqsService.ts` migrated to canonical `/api/v1/ipqs/status|check` via `apiClient` (no direct legacy `/api/check-ip` path usage).
- Validation:
  - root `npm run -s check:all` is green.
  - no frontend runtime references remain to `/api/wow-names`, `/api/check-ip`, `/api/check-ip-batch`, `/api/status`.

## Latest progress snapshot (2026-02-10, continuation #62)
    - introduced shared request helper to remove repeated fetch/error boilerplate.
- Runtime/docs parity cleanup completed:
  - startup banner in `apps/backend-legacy/src/bootstrap/runtime.js` now points to `/api/v1/health`.
  - `apps/backend-legacy/README.md` now documents canonical endpoints first (`/api/v1/ipqs/*`, `/api/v1/wow-names`, `/api/v1/health`) with legacy compatibility note.
- Firebase rules policy documentation added:
  - `docs/architecture/firebase-rules-policy.md` (current baseline + env policy + change-control checklist).
- Hotspot gate closure:
  - `apps/frontend/src/pages/vms/VMsPage.tsx`: `401 -> 400` lines.
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #63)
- Validation:
  - root `npm run -s check:all` is green.

## Latest progress snapshot (2026-02-10, continuation #64)
- Performance chunking refinement pass executed:
  - updated `apps/frontend/vite.config.ts` with safe chunking policy.
  - rejected chunk split variants that produced circular chunk warnings during build diagnostics.
- Stability outcome:
  - final build configuration is warning-free.
  - bundle budgets remain green under `check:all`.
- Notes:
  - further bundle reduction now depends on import graph isolation/lazy loading of heavy feature code paths rather than additional simple `manualChunks` splits.

## Latest progress snapshot (2026-02-10, continuation #65)
  - `docs/api/openapi.yaml` now includes explicit canonical envelope schema coverage for:
- Validation:
  - OpenAPI YAML parse check is green (`js-yaml` load).

## Latest progress snapshot (2026-02-10, continuation #66)
- Build chunking strategy finalized for stability and better natural splitting:
  - `apps/frontend/vite.config.ts` no longer forces all unmatched `node_modules` into a shared `vendor-misc` bucket.
  - manual chunk fallback now returns `undefined` and lets Rollup split by import graph.
- Validation:
  - root `npm run -s check:all` is green.
  - bundle budgets are green.
  - no file-size hotspots remain in `apps/frontend/src/components + apps/frontend/src/pages` (`> 400` lines = `0`).
- Top-level architecture docs restored:
  - `ARCHITECTURE.md`
  - `DATABASE.md`
  - both aligned with RTDB-first/API-first baseline and linked policy docs.

## Latest progress snapshot (2026-02-10, continuation #67)
- Notes editor load-path optimization completed:
  - `apps/frontend/src/pages/notes/index.tsx` now lazy-loads `NoteEditor` via `React.lazy` + `Suspense`.
  - markdown/editor dependency stack is no longer eagerly pulled when opening notes page without selecting a note.
- Validation:
  - root `npm run -s check:all` is green.
  - bundle budget checks are green.

## Latest progress snapshot (2026-02-11, continuation #68)
- Dev startup reliability hardening completed:
  - `start-dev.js` now performs preflight check that `3001` is free before spawning child processes.
  - removed `shell: true` usage in process spawn path to avoid unsafe shell argument concatenation.
  - shutdown now preserves child exit-code semantics (`non-zero` failures propagate correctly).
- Firebase service-account bootstrap resolution hardened:
  - `apps/backend-legacy/src/bootstrap/firebase-admin.js` now resolves `FIREBASE_SERVICE_ACCOUNT_PATH` across:
    - absolute path,
    - `process.cwd()` relative,
    - `proxy-server` relative,
    - repo-root relative,
    and supports default candidates at repo root (`firebase-key.json`) and `Assets/firebase-key.json`.
  - `apps/backend-legacy/.env.example` updated with supported path examples and repo-root default.
- Operational environment note (local machine):
  - `3001` currently occupied by `Dolphin Anty` (`PID 32468`), which blocks proxy startup if unchanged.
  - `node start-dev.js` now fails fast with explicit instruction instead of half-starting the stack.
- Validation:
  - `node start-dev.js` with occupied `3001` exits immediately with clear actionable message and exit code `1`.
  - `firebase-key.json` at repo root is valid service-account JSON shape (required keys present).

## Latest progress snapshot (2026-02-11, continuation #69)
- Firebase client runtime hardening completed for missing-env scenario:
  - `apps/frontend/src/utils/firebase.ts`:
    - Firebase app/auth initialization is now conditional and skipped when `VITE_FIREBASE_*` config is incomplete.
  - `apps/frontend/src/providers/auth-provider.ts`:
    - added explicit `FirebaseNotConfigured` login error path when Firebase Auth is not available;
    - logout now safely skips Firebase `signOut` if auth is not initialized.
- Result:
  - frontend no longer throws `FirebaseError: auth/invalid-api-key` at startup in env-missing mode.
  - app remains operational in internal-token path (when configured) without crashing.
- Repo hygiene:
  - root-level `firebase-key.json` is now ignored by git (`/firebase-key.json` in `.gitignore`).
- Validation:
  - `npm run -s lint` in `bot-mox` is green.
  - `npm run -s build` in `bot-mox` is green.

## Latest progress snapshot (2026-02-11, continuation #70)
- Dev-only auth UX bypass added to unblock local iterations without login form:
  - `apps/frontend/src/providers/auth-provider.ts`:
    - introduced `DEV`-scoped bypass switch (`VITE_DEV_BYPASS_AUTH`, default effective behavior = enabled in dev),
    - `check/login/getIdentity/getPermissions/onError` now have bypass branches for local flow continuity.
  - `apps/frontend/.env.example`:
    - documented `VITE_DEV_BYPASS_AUTH=true|false`,
    - clarified internal token path for protected `/api/v1/*`.
- Runtime behavior:
  - local dev no longer gets blocked at `/login` by default;
  - if `VITE_INTERNAL_API_TOKEN` exists, it is used to seed auth headers for protected API calls;
  - if absent, app opens and warns that some protected requests may return `401`.
- Validation:
  - `npm run -s lint` in `bot-mox` is green.
  - `npm run -s build` in `bot-mox` is green.

## Latest progress snapshot (2026-02-11, continuation #71)
- Local-dev token parity fix completed to remove `/api/v1/*` `401` storm in bypass mode:
  - backend update (`apps/backend-legacy/src/config/env.js`):
    - development fallback tokens enabled when env vars are missing:
      - `INTERNAL_API_TOKEN -> change-me-api-token`
      - `INTERNAL_INFRA_TOKEN -> change-me-infra-token`
    - production remains strict (no implicit fallback token).
  - frontend update (`apps/frontend/src/providers/auth-provider.ts`):
    - dev bypass session now uses fallback token `change-me-api-token` when `VITE_INTERNAL_API_TOKEN` is not provided,
    - missing-token warning is logged once (instead of repeated each auth check cycle).
  - env docs update (`apps/frontend/.env.example`):
    - clarified that `VITE_INTERNAL_API_TOKEN` can be omitted in dev because fallback token is used.
- Validation:
  - auth middleware smoke with fallback token passes (`Bearer change-me-api-token` accepted).
  - `npm run -s lint` in `bot-mox` is green.
  - `npm run -s build` in `bot-mox` is green.
  - `npm run -s check:backend:syntax` is green.

## Latest progress snapshot (2026-02-11, continuation #72)
- Frontend pre-auth race hardening completed:
  - `apps/frontend/src/services/authFetch.ts` now resolves dev fallback token directly when bypass is enabled and session token is absent at request time.
  - stale legacy token (`dev-bypass-token`) is migrated to the current fallback token path automatically.
- Result:
  - first-wave polling requests no longer start unauthenticated before auth-provider session seeding.
  - significantly reduces repeated `401 Unauthorized` noise on initial load in local bypass mode.
- Validation:
  - `npm run -s lint` in `bot-mox` is green.
  - `npm run -s build` in `bot-mox` is green.

## Latest progress snapshot (2026-02-11, continuation #73)
- Production-like local env bootstrap completed (no manual copy/paste required):
  - created `apps/backend-legacy/.env` (gitignored):
    - includes `FIREBASE_SERVICE_ACCOUNT_PATH=../firebase-key.json`,
    - includes RTDB URL from `Ссылка.txt`,
    - includes generated `INTERNAL_API_TOKEN` + `INTERNAL_INFRA_TOKEN`.
  - created `apps/frontend/.env` (gitignored):
    - includes `VITE_API_BASE_URL`/`VITE_WS_BASE_URL`,
    - includes `VITE_INTERNAL_API_TOKEN` (matches backend `INTERNAL_API_TOKEN`) so `/api/v1/*` calls are authorized without login UI.
    - includes Firebase Web SDK keys (from newly created Firebase Web App) for future Firebase-login enablement.
- Backend env load-order fix:
  - `apps/backend-legacy/src/legacy-app.js` now loads dotenv before importing `./config/env`,
  - fixes issue where tokens in `.env` were ignored due to module-load snapshot order.
- Validation:
  - backend `/api/v1/auth/verify` accepts configured internal token successfully (`source=internal`).

## Latest progress snapshot (2026-02-11, continuation #74)
- Dev orchestration now respects configured proxy port:
  - `start-dev.js` reads `PORT` from `apps/backend-legacy/.env` (or `.env.example`) and preflights the correct port instead of hardcoding `3001`.
  - runner spawns proxy with `PORT` explicitly set and prints the configured proxy URL in the “Available endpoints” banner.

## Latest progress snapshot (2026-02-11, continuation #75)
- Dev CORS fix for Vite port drift:
  - `apps/backend-legacy/src/bootstrap/http-middleware.js` now permits `http://localhost:5174` (and `127.0.0.1:5174`) in `development`,
  - prevents CORS preflight failures when Vite bumps dev port from `5173` to `5174`.
- Validation:
  - `npm run -s check:backend:syntax` is green.
