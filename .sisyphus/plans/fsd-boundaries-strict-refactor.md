# Strict FSD Boundaries Refactor (Frontend)

## TL;DR

> **Quick Summary**: Perform a behavior-preserving structural refactor of `apps/frontend/src` to enforce FSD boundaries by relocating domain logic out of `pages`, migrating heavy UI blocks to `widgets`, migrating UI atoms to `shared/ui`, and removing `src/components`.
>
> **Deliverables**:
> - `apps/frontend/src/entities/bot/lib/statuses.ts` with extracted status calculators
> - `apps/frontend/src/features/vm-management/{lib,model}` with VM delete workflow logic
> - `apps/frontend/src/widgets/bot-profile/ui/*Widget.tsx` for heavy bot blocks
> - `apps/frontend/src/shared/ui/*` replacing `apps/frontend/src/components/ui/*`
> - `apps/frontend/src/components/` removed
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Task 0 -> Task 1 -> Task 2 -> Task 3 -> Task 3.5 -> Task 4 -> Task 5.5 -> Task 6 -> Task 8

---

## Context

### Original Request
Strictly apply FSD layer boundaries in frontend by moving business logic out of pages, migrating heavy component modules into widgets, migrating UI atoms into shared/ui, and deleting `src/components`, with no behavior changes.

### Interview Summary
**Key Discussions**:
- Preserve behavior fully: only move/rename/update imports.
- Keep this epic scoped to requested targets; defer `apps/frontend/src/pages/datacenter/page-helpers.ts` to prevent scope creep.
- Future backend migration is prepared now by isolating pure functions and tagging with `// TODO: @backend-migration`.
- Verification strategy chosen: add/extend tests (not typecheck-only).

**Research Findings**:
- Status logic exists in `apps/frontend/src/pages/project/utils.ts` and is consumed by `apps/frontend/src/pages/project/selectors.ts`.
- VM delete logic exists in `apps/frontend/src/pages/vms/deleteVmRules.ts` and hooks in `apps/frontend/src/pages/vms/hooks/*`.
- Heavy bot UI blocks are in `apps/frontend/src/components/bot/*` and consumed by `apps/frontend/src/pages/bot/page/sections.tsx`.
- `apps/frontend/src/components/ui/*` is widely imported across pages/features.
- Frontend verification supports `tsc -b --noEmit` and Playwright E2E (`apps/frontend/e2e/*.spec.ts`).

### Metis Review
**Identified Gaps (addressed in this plan)**:
- Missing boundary contract -> explicit import-direction guardrails added.
- Missing behavior lock definition -> mechanical move/rename-only policy and output parity checks added.
- Missing acceptance gates -> typecheck + boundary scan + focused E2E + no-components checks added.
- Barrel/circular risk -> explicit barrel update and cycle check task criteria added.

---

## Work Objectives

### Core Objective
Reorganize frontend code to FSD-compliant layers and remove `src/components` while preserving runtime behavior and compile integrity.

### Concrete Deliverables
- New entity lib for bot status calculators.
- New `features/vm-management` structure containing VM delete decision/workflow code.
- Bot profile heavy blocks relocated to `widgets/bot-profile/ui` and renamed to widget-oriented names.
- UI atoms moved into `shared/ui` with full project import rewiring.
- Former `components/*` modules relocated into `widgets/*` where applicable.

### Definition of Done
- [x] `pnpm --dir apps/frontend run typecheck` passes with zero errors.
- [x] `apps/frontend/src/components` does not exist.
- [x] No imports remain from `components/ui` or `components/*`.
- [x] `computeBotStatus` and `evaluateDeleteBot` include `// TODO: @backend-migration`.
- [x] Playwright focused smoke checks for touched surfaces pass.

### Must Have
- Strict FSD import direction:
  - `pages -> widgets|features|entities|shared`
  - `widgets -> features|entities|shared`
  - `features -> entities|shared`
  - `entities -> shared`
  - `shared ->` no upward imports
- Transitional typing rule for this repo: `apps/frontend/src/types/*` is treated as shared-contract space for this migration; entities/features/widgets may import from it until a dedicated shared-types relocation is planned.
- Mechanical refactor only (move/rename/import rewiring).

### Must NOT Have (Guardrails)
- No business-rule rewrites, no API contract changes.
- No opportunistic refactors outside requested epic scope.
- No expansion into `apps/frontend/src/pages/datacenter/page-helpers.ts` in this plan.
- No temporary fallback aliases to keep `components/*` alive after completion.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (Tests-after for this structural refactor)
- **Framework**: Playwright E2E + TypeScript typecheck

### Tests-after Strategy
This is a structural migration, so test additions focus on regression detection for touched routes/surfaces:
- Extend or add focused E2E smoke coverage for:
  - project page render/status columns path,
  - vms delete modal/workflow open path,
  - bot page sections rendering with moved widgets.

Manual verification remains required for path-sensitive regressions.

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (Baseline + Independent prep)
├── Task 0: Baseline manifest and safety gates
└── Task 8: Draft focused E2E extension cases (scaffold only)

Wave 2 (Core relocations)
├── Task 1: Move project status logic to entities
├── Task 2: Move VM delete workflow to features/vm-management
└── Task 3: Move bot heavy modules to widgets/bot-profile/ui

Wave 3 (Boundary completion + consolidation)
├── Task 3.5: Relocate remaining components/bot modules (full folder removal readiness)
├── Task 4: Move components/ui to shared/ui + global import rewrites
├── Task 5: Move remaining components/* to widgets/*
├── Task 5.5: Remove widgets->pages coupling in vm-workspace
├── Task 6: Delete components dir + enforce boundary scans
└── Task 8: Finalize and run focused E2E + typecheck

Critical Path: 0 -> 1 -> 2 -> 3 -> 3.5 -> 4 -> 5.5 -> 6 -> 8
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 0 | None | 1,2,3,3.5,4,5,5.5,6,8 | 8 (scaffold only) |
| 1 | 0 | 4,6,8 | 2,3 |
| 2 | 0 | 4,5.5,6,8 | 1,3 |
| 3 | 0 | 3.5,4,5,6,8 | 1,2 |
| 3.5 | 3 | 6,8 | 4,5 |
| 4 | 1,2,3,3.5 | 6,8 | 5 |
| 5 | 3,3.5 | 6,8 | 4 |
| 5.5 | 2,5 | 6,8 | 4 |
| 6 | 4,5,5.5 | 8 | None |
| 8 | 0,1,2,3,3.5,4,5,5.5,6 | None | None |

---

## TODOs

- [x] 0. Build relocation manifest and freeze behavior boundaries

  **What to do**:
  - Create manifest file: `.sisyphus/artifacts/fsd-move-manifest.md`.
  - Use required columns: `Old Path | New Path | Target Layer | Rename? | Import Consumers | Notes`.
  - Create a mapping table `old path -> new path` for all files in scope before any moves.
  - Mark each mapping with target FSD layer and whether rename is required.
  - Define behavior lock: no code-path logic changes, only structural rewiring.

  **Must NOT do**:
  - Do not start file moves before manifest is complete.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: planning/inventory work with low algorithmic complexity.
  - **Skills**: `writing`
    - `writing`: keeps manifest precise and auditable.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 1,2,3,3.5,4,5,5.5,6,8
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/pages/project/utils.ts` - source of status calculators being extracted.
  - `apps/frontend/src/pages/vms/deleteVmRules.ts` - source of delete decision logic being relocated.
  - `apps/frontend/src/components/bot/index.ts` - current export barrel to be replaced by widgets imports.
  - `apps/frontend/src/components/ui/ErrorBoundary.tsx` - concrete atom source file.
  - `apps/frontend/src/components/ui/MetricCard.tsx` - concrete atom source file.
  - `apps/frontend/src/components/ui/StatusBadge.tsx` - concrete atom source file.
  - `apps/frontend/src/components/ui/TableActionButton.tsx` - concrete atom source file.
  - `rg -n "components/ui" apps/frontend/src` - canonical consumer discovery command for import rewiring.

  **Acceptance Criteria**:
  - [x] `.sisyphus/artifacts/fsd-move-manifest.md` exists and covers every file in Tasks 1,2,3,3.5,4,5,5.5.
  - [x] Explicitly marks deferred file: `apps/frontend/src/pages/datacenter/page-helpers.ts`.

- [x] 1. Move project status business logic into `entities/bot/lib/statuses.ts`

  **What to do**:
  - Create `apps/frontend/src/entities/bot/lib/statuses.ts`.
  - Create `apps/frontend/src/entities/bot/lib/statuses.types.ts` for extracted ownership of:
    - `BotRecord`, `ProxyLike`, `ProxyStatus`, `SubscriptionStatus`, `OFFLINE_THRESHOLD_MS`.
  - Ensure `statuses.ts` imports from entity/shared/core types only; it must not import from `pages/project/*`.
  - Move `computeBotStatus`, `computeProxyStatus`, `computeSubscriptionStatus`, `computeLicenseStatus` from `apps/frontend/src/pages/project/utils.ts`.
  - Add `// TODO: @backend-migration - This logic should be computed on backend` above these functions.
  - Update imports in:
    - `apps/frontend/src/pages/project/selectors.ts`
    - `apps/frontend/src/pages/project/columns.tsx` (if direct/indirect references require path updates)
  - Keep page-level formatting helpers in page layer if they are view-specific.

  **Must NOT do**:
  - Do not alter decision thresholds/labels/sort semantics of status outputs.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: mostly deterministic moves + import rewiring.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: safe TS/React module relocation and import hygiene in frontend code.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 2,3)
  - **Blocks**: 4,6,8
  - **Blocked By**: 0

  **References**:
  - `apps/frontend/src/pages/project/utils.ts` - contains the exact status calculators to extract.
  - `apps/frontend/src/pages/project/selectors.ts` - immediate consumer currently importing from `./utils`.
  - `apps/frontend/src/pages/project/types.ts` - DTO/status type contracts consumed by selectors and columns.
  - `apps/frontend/src/pages/project/index.tsx` - integration surface for project page behavior verification.

  **Acceptance Criteria**:
  - [x] New file exists: `apps/frontend/src/entities/bot/lib/statuses.ts`.
  - [x] New file exists: `apps/frontend/src/entities/bot/lib/statuses.types.ts`.
  - [x] TODO backend-migration comments present above moved status functions.
  - [x] `entities/bot/lib/statuses.ts` has zero imports from `pages/*`.
  - [x] `pages/project` no longer owns these business calculators.
  - [x] Typecheck passes for this move increment.

- [x] 2. Move VM delete rules/workflow from pages to `features/vm-management`

  **What to do**:
  - Create:
    - `apps/frontend/src/features/vm-management/lib/`
    - `apps/frontend/src/features/vm-management/model/`
  - Move:
    - `apps/frontend/src/pages/vms/deleteVmRules.ts` -> `features/vm-management/lib/deleteVmRules.ts`
    - `apps/frontend/src/pages/vms/hooks/deleteVmWorkflowCandidates.ts` -> `features/vm-management/lib/deleteVmWorkflowCandidates.ts`
    - `apps/frontend/src/pages/vms/hooks/useDeleteVmWorkflow.ts` -> `features/vm-management/model/useDeleteVmWorkflow.ts`
    - `apps/frontend/src/pages/vms/hooks/deleteVmWorkflow.types.ts` -> `features/vm-management/model/deleteVmWorkflow.types.ts`
  - Rewire imports in:
    - `apps/frontend/src/pages/vms/VMsPage.tsx`
    - `apps/frontend/src/pages/vms/page/VMPageModals.tsx`
    - `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`
    - `apps/frontend/src/pages/vms/DeleteVmModal.tsx`
    - `apps/frontend/src/pages/vms/page/DeleteVmFilterPopovers.tsx`
    - `apps/frontend/src/pages/vms/page/DeleteVmCandidateItem.tsx`
    - `apps/frontend/src/pages/vms/hooks/deleteVmWorkflow.types.ts`
  - Add `// TODO: @backend-migration - evaluateDeleteBot must execute on backend` above `evaluateDeleteBot`.
  - Public API contract for this feature:
    - add `apps/frontend/src/features/vm-management/index.ts` as the only external import surface.
    - add `apps/frontend/src/features/vm-management/lib/index.ts` and `apps/frontend/src/features/vm-management/model/index.ts` for internal re-exports.
    - pages/widgets must import vm-management symbols via `features/vm-management` public exports.

  **Must NOT do**:
  - Do not change filter semantics or `canDelete` decisions.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: multi-file move with high import fan-out and type coupling.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: robust TS/React refactor execution.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 1,3)
  - **Blocks**: 4,5.5,6,8
  - **Blocked By**: 0

  **References**:
  - `apps/frontend/src/pages/vms/deleteVmRules.ts` - canonical delete-evaluation logic and types.
  - `apps/frontend/src/pages/vms/hooks/useDeleteVmWorkflow.ts` - orchestration hook to relocate.
  - `apps/frontend/src/pages/vms/hooks/deleteVmWorkflowCandidates.ts` - candidate-evaluation helper.
  - `apps/frontend/src/pages/vms/hooks/deleteVmWorkflow.types.ts` - type dependencies to rewire.
  - `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts` - parent view-model integration point.
  - `apps/frontend/src/pages/vms/page/VMPageModals.tsx` - modal entrypoint impacted by import path changes.

  **Acceptance Criteria**:
  - [x] `features/vm-management/{lib,model}` contains moved files.
  - [x] `deleteVmWorkflow.types.ts` is owned by `features/vm-management/model` and no longer depends on `pages` paths.
  - [x] `evaluateDeleteBot` has backend-migration TODO marker.
  - [x] No `pages/vms/*` imports from old deleted locations.
  - [x] `features/vm-management/index.ts` exists and external consumers use it (no ad-hoc deep imports from pages/widgets).
  - [x] Typecheck passes for this move increment.

- [x] 3. Move heavy bot blocks to `widgets/bot-profile/ui` and rename to widgets

  **What to do**:
  - Create `apps/frontend/src/widgets/bot-profile/ui/`.
  - Move and rename:
    - `BotSummary.tsx` (+ `summary/`) -> `BotSummaryWidget.tsx` (+ adjusted internal paths)
    - `BotCharacter.tsx` (+ `character/`) -> `BotCharacterWidget.tsx`
    - `BotFinance.tsx` + `botFinanceData.ts` -> widget equivalents
    - `BotLeveling.tsx` -> `BotLevelingWidget.tsx`
    - `BotLogs.tsx` -> `BotLogsWidget.tsx`
    - `BotProfession.tsx` -> `BotProfessionWidget.tsx`
    - `BotLifeStages.tsx` (+ `lifeStages/`) -> `BotLifeStagesWidget.tsx`
  - Update bot page section imports in `apps/frontend/src/pages/bot/page/sections.tsx` to widget paths.
  - Update all known consumers (not only sections) for moved heavy widgets, including barrel consumers discovered via search.
  - Add widget barrel exports if used by page sections.

  **Must NOT do**:
  - Do not rework widget internals beyond path/identifier renaming.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: heavy UI modules with many JSX/CSS/module references.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: safest for preserving UI behavior during large file moves.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 1,2)
  - **Blocks**: 3.5,4,5,6,8
  - **Blocked By**: 0

  **References**:
  - `apps/frontend/src/components/bot/index.ts` - current export surface to replace.
  - `apps/frontend/src/pages/bot/page/sections.tsx` - page integration that must consume widgets.
  - `apps/frontend/src/components/bot/BotSummary.tsx` - canonical heavy block example with nested deps.
  - `apps/frontend/src/components/bot/BotCharacter.tsx` - likely complex form/data interactions.
  - `apps/frontend/src/components/bot/lifeStages/` and `apps/frontend/src/components/bot/summary/` - nested folders needing coordinated moves.

  **Acceptance Criteria**:
  - [x] All listed heavy bot modules live under `widgets/bot-profile/ui`.
  - [x] `pages/bot/page/sections.tsx` imports from widgets, not components/bot.
  - [x] `rg -n "from ['\"][^'\"]*components/bot" apps/frontend/src` returns zero matches for `BotFinance|BotLeveling|BotLogs` consumers.
  - [x] Typecheck passes for this move increment.

- [x] 3.5. Relocate remaining `components/bot/*` modules so `components` can be deleted

  **What to do**:
  - Move remaining bot modules not covered in Task 3 to FSD-safe destinations (default target: `apps/frontend/src/widgets/bot-profile/ui/`), including:
    - `BotLicense.tsx`, `BotPerson.tsx`, `BotProxy.tsx`, `BotSchedule*.tsx`, `BotSubscription.tsx`, `BotVMInfo.tsx`, and subfolders `license/`, `person/`, `proxy/`, `subscription/`.
  - Replace/retire `apps/frontend/src/components/bot/index.ts` with widget-side export surface.
  - Rewire all imports that still point to `components/bot/*`.

  **Must NOT do**:
  - Do not redesign forms/interaction logic; preserve behavior.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: broad module fan-out and high chance of stale import breakage.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: safest for large TSX move/rename rewiring.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 4,5)
  - **Blocks**: 6,8
  - **Blocked By**: 3

  **References**:
  - `apps/frontend/src/components/bot/` - full set must be drained before deleting `components`.
  - `apps/frontend/src/pages/bot/page/sections.tsx` - primary consumer of bot profile blocks.
  - `apps/frontend/src/components/bot/index.ts` - old barrel requiring replacement.

  **Acceptance Criteria**:
  - [x] No files remain under `apps/frontend/src/components/bot`.
  - [x] `rg -n "from ['\"][^'\"]*components/bot" apps/frontend/src` returns zero matches.
  - [x] Typecheck passes for this move increment.

- [x] 4. Move `components/ui` atoms to `shared/ui` and perform global import rewiring

  **What to do**:
  - Move files from `apps/frontend/src/components/ui/*` to `apps/frontend/src/shared/ui/*`.
  - Rewrite imports across project from `components/ui/*` to `shared/ui/*`.
  - Barrel policy: keep per-file imports as canonical pathing; do not require introducing a barrel export contract.
  - If an index barrel is created, it must be explicit named re-exports only.
  - Ensure style module co-location still resolves after move.

  **Must NOT do**:
  - Do not alter UI atom APIs unless required for path compatibility.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: mostly mechanical search/replace + path updates.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: avoids JSX/TS import mistakes during mass rewrite.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 5)
  - **Blocks**: 6,8
  - **Blocked By**: 1,2,3,3.5

  **References**:
  - `apps/frontend/src/components/ui/ErrorBoundary.tsx`
  - `apps/frontend/src/components/ui/LoadingState.tsx`
  - `apps/frontend/src/components/ui/MetricCard.tsx`
  - `apps/frontend/src/components/ui/StatusBadge.tsx`
  - `apps/frontend/src/components/ui/TableActionButton.tsx`
  - `apps/frontend/src/pages/project/columns.tsx` - concrete consumer importing atoms.
  - `apps/frontend/src/pages/dashboard/index.tsx` - additional atom consumer.

  **Acceptance Criteria**:
  - [x] No imports remain from `components/ui`.
  - [x] Atoms resolve from `shared/ui` everywhere.
  - [x] Typecheck passes for this move increment.

- [x] 5. Relocate remaining `components/*` domains into `widgets/*`

  **What to do**:
  - Move directories:
    - `apps/frontend/src/components/finance` -> `apps/frontend/src/widgets/finance`
    - `apps/frontend/src/components/layout` -> `apps/frontend/src/widgets/layout`
    - `apps/frontend/src/components/notes` -> `apps/frontend/src/widgets/notes-editor`
    - `apps/frontend/src/components/schedule` -> `apps/frontend/src/widgets/schedule`
    - `apps/frontend/src/components/subscriptions` -> `apps/frontend/src/widgets/subscriptions`
    - `apps/frontend/src/components/vm` -> `apps/frontend/src/widgets/vm`
  - Rewire imports with explicit canonical mapping:
    - `components/finance/*` -> `widgets/finance/*`
    - `components/layout/*` -> `widgets/layout/*`
    - `components/notes/*` -> `widgets/notes-editor/*`
    - `components/schedule/*` -> `widgets/schedule/*`
    - `components/subscriptions/*` -> `widgets/subscriptions/*`
    - `components/vm/*` -> `widgets/vm/*`
  - Update any widget barrels to keep page imports stable.

  **Must NOT do**:
  - Do not convert domain logic between layers in this step.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: broad fan-out migration touching many pages and existing widgets.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: robust refactor handling for TSX module trees.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 4)
  - **Blocks**: 6,8
  - **Blocked By**: 3

  **References**:
  - `apps/frontend/src/App.tsx` - imports layout widgets from `components/layout`.
  - `apps/frontend/src/pages/finance/index.tsx` - imports from `components/finance` and layout.
  - `apps/frontend/src/pages/notes/index.tsx` - imports from `components/notes`.
  - `apps/frontend/src/pages/subscriptions/index.tsx` - imports from `components/subscriptions`.
  - `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx` - currently imports from `components/vm`.

  **Acceptance Criteria**:
  - [x] All non-ui domains moved from `components` to `widgets`.
  - [x] No unresolved imports remain after rewiring.
  - [x] Typecheck passes for this move increment.

- [x] 5.5. Remove `widgets -> pages` coupling in VM workspace

  **What to do**:
  - Refactor `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx` so it no longer imports from `apps/frontend/src/pages/vms/page/*`.
  - Move page-coupled collaborators to explicit destinations:
    - `apps/frontend/src/pages/vms/page/cx.ts` -> `apps/frontend/src/widgets/vm-workspace/ui/cx.ts`
    - `apps/frontend/src/pages/vms/page/VmTargetStrip.tsx` -> `apps/frontend/src/widgets/vm-workspace/ui/VmTargetStrip.tsx`
    - `apps/frontend/src/pages/vms/page/VMPageModals.tsx` -> `apps/frontend/src/widgets/vm-workspace/ui/VMPageModals.tsx`
    - `apps/frontend/src/pages/vms/DeleteVmModal.tsx` -> `apps/frontend/src/features/vm-management/ui/DeleteVmModal.tsx`
    - transitively required modal helpers from `pages/vms/page/*` -> matching widget path under `widgets/vm-workspace/ui/`.
  - Update imports so `VMWorkspace` consumes only widgets/features/entities/shared.

  **Must NOT do**:
  - Do not keep any fallback import from `widgets` to `pages`.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: architecture-sensitive dependency inversion.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: component boundary and import-graph safe refactor.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 6,8
  - **Blocked By**: 2,5

  **References**:
  - `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx` - current forbidden widgets->pages imports.
  - `apps/frontend/src/pages/vms/page/VMPageModals.tsx` - modal module currently consumed by widget.
  - `apps/frontend/src/pages/vms/page/VmTargetStrip.tsx` - UI strip currently consumed by widget.
  - `apps/frontend/src/pages/vms/page/cx.ts` - className binding helper currently consumed by widget.

  **Acceptance Criteria**:
  - [x] `VMWorkspace.tsx` has zero imports from `pages/vms/page/*`.
  - [x] Moved modal/strip/cx modules have zero imports from `pages/vms/*` once relocated.
  - [x] `rg -n "from ['\"][^'\"]*pages/vms" apps/frontend/src/widgets/vm-workspace apps/frontend/src/features/vm-management` returns zero matches.
  - [x] Moved collaborators compile from their new widget/feature locations.
  - [x] Typecheck passes for this move increment.

- [x] 6. Remove `apps/frontend/src/components` and enforce boundary checks

  **What to do**:
  - Delete now-empty `apps/frontend/src/components`.
  - Run project-wide scan for forbidden legacy imports.
  - Run explicit, repeatable layer-direction checks with pass/fail outputs.

  **Must NOT do**:
  - Do not leave compatibility stubs in `components`.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: cleanup and policy checks.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: ensures import graph remains valid after cleanup.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 8
  - **Blocked By**: 4,5,5.5

  **References**:
  - `apps/frontend/src/components/` - must be absent after completion.
  - `apps/frontend/src/pages/` - scan for legacy `components/*` imports.
  - `apps/frontend/src/features/`, `apps/frontend/src/entities/`, `apps/frontend/src/widgets/` - scan for layer-direction violations.

  **Acceptance Criteria**:
  - [x] `apps/frontend/src/components` directory does not exist.
  - [x] `rg -n "components/" apps/frontend/src` returns zero matches.
  - [x] `rg -n "from ['\"][^'\"]*pages/" apps/frontend/src/entities apps/frontend/src/features apps/frontend/src/widgets apps/frontend/src/shared` returns zero matches.
  - [x] `rg -n "from ['\"][^'\"]*widgets/" apps/frontend/src/entities apps/frontend/src/features` returns zero matches.
  - [x] `rg -n "from ['\"][^'\"]*features/" apps/frontend/src/entities` returns zero matches.

- [x] 8. Extend focused E2E checks and run final verification gates

  **What to do**:
  - Add deterministic migration-focused spec: `apps/frontend/e2e/fsd-boundaries-migration.spec.ts`.
  - Cover touched surfaces in that spec:
    - project page critical render path,
    - VMs delete modal open/candidate list path,
    - bot profile sections render path.
  - Run final verification commands.

  **Must NOT do**:
  - Do not broaden E2E scope beyond migration-affected routes.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: test updates + end-to-end regression verification.
  - **Skills**: `dev-browser`
    - `dev-browser`: suitable for browser-path validation and Playwright-oriented checks.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (final gate)
  - **Blocks**: None
  - **Blocked By**: 0,1,2,3,3.5,4,5,5.5,6

  **References**:
  - `apps/frontend/e2e/smoke.spec.ts` - baseline smoke pattern to extend.
  - `apps/frontend/e2e/authenticated-shell.spec.ts` - authenticated routing/navigation examples.
  - `apps/frontend/playwright.config.ts` - test runtime configuration.
  - `apps/frontend/package.json` - canonical scripts (`typecheck`, `test:e2e`).

  **Acceptance Criteria**:
  - [x] Added `apps/frontend/e2e/fsd-boundaries-migration.spec.ts` with assertions for all touched surfaces.
  - [x] `pnpm --dir apps/frontend run typecheck` -> PASS.
  - [x] `pnpm --dir apps/frontend run test:e2e -- e2e/fsd-boundaries-migration.spec.ts` -> PASS.
  - [x] Final scan confirms no `components/` imports and no missing module resolution.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `refactor(frontend): move project status logic to entities` | pages/project + entities/bot/lib | typecheck |
| 2 | `refactor(frontend): move vm delete workflow into feature slice` | pages/vms + features/vm-management | typecheck |
| 3 | `refactor(frontend): migrate bot heavy blocks to widgets` | components/bot + widgets/bot-profile | typecheck |
| 4-6 | `refactor(frontend): replace components with shared-ui and widgets` | components/ui + shared/ui + widgets/* + imports | typecheck + boundary scan |
| 8 | `test(frontend): add smoke coverage for fsd migration paths` | e2e/*.spec.ts | typecheck + focused e2e |

---

## Success Criteria

### Verification Commands

```bash
pnpm --dir apps/frontend run typecheck
pnpm --dir apps/frontend run test:e2e -- e2e/fsd-boundaries-migration.spec.ts
```

### Final Checklist
- [x] All required files are relocated to target FSD layers.
- [x] `apps/frontend/src/components` is absent.
- [x] Target functions include `// TODO: @backend-migration` comments.
- [x] Import direction aligns with FSD guardrails.
- [x] Typecheck and focused E2E verification pass.
