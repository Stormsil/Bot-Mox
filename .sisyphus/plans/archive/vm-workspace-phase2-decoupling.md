# VM Workspace Phase 2: Full Decoupling and God Object Removal

## TL;DR
> **Summary**: Make Zustand the single source of truth for VM queue/log workflow state, remove business prop drilling from VMs page panels, and reduce page viewmodel to page-level orchestration only.
> **Deliverables**:
> - Queue/log ownership migration to Zustand (no local mirror state)
> - Smart panel conversion (`VMQueuePanel`, `VMStatusBar`, `VMOperationLog`, `VMPageModals`)
> - `VMsPage` business-prop cleanup and minimal `useVmsPageViewModel`
> - Tests-after verification with typecheck + targeted e2e
> **Effort**: Large
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 -> 2 -> 3 -> 5 -> 6/7/8/9 -> 10

## Context
### Original Request
Epic requires hard decoupling of VM workspace: remove dual-state pattern (`useState` + mirror to Zustand), eliminate panel prop drilling, and destroy page-level God Object behavior.

### Interview Summary
- Tests strategy: `tests-after`.
- `useVmsPageViewModel.ts` must remain only as minimal page orchestrator (<30 lines).
- `task.key = vm:<queueItemId>` linkage hardening is deferred; keep convention unchanged in this epic.

### Metis Review (gaps addressed)
- Added guardrails: ownership-first migration (state authority before UI decomposition).
- Added rollback guards and anti-scope rules to prevent semantic rewrites of processor/persistence.
- Added explicit acceptance checks to prove mirror removal and panel autonomy.

## Work Objectives
### Core Objective
Complete VM workspace architecture cutover so queue/log workflow state is owned by Zustand and panels self-serve data/actions without page business props.

### Deliverables
- Zustand queue/log slices extended to hold authoritative runtime state needed by queue/log/status panels.
- `useVMQueue` rewritten as store-backed controller (no local queue/isProcessing source state).
- `useVMLog` rewritten as store-backed controller for task/log arrays (no local arrays as source state).
- Smart panels consume store/query/hooks directly.
- `VMsPage` renders panel components without business props.
- `useVmsPageViewModel.ts` reduced to page-level orchestration only, <= 30 lines.

### Definition of Done (verifiable conditions with commands)
- `pnpm --filter @botmox/frontend typecheck` exits 0.
- `pnpm --filter @botmox/frontend build` exits 0.
- `pnpm exec rg "setWorkspace(LogTasks|QueueItems)\\(" apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts` returns no matches.
- `pnpm exec rg "<VMQueuePanel\\s|<VMStatusBar\\s|<VMOperationLog\\s|<VMPageModals\\s" apps/frontend/src/pages/vms/VMsPage.tsx` shows no business-prop fan-out.
- `pnpm --filter @botmox/frontend test:e2e -- --grep "vm workspace decoupling parity"` exits 0.

### Must Have
- One writable owner for queue/log entities (Zustand).
- No `useEffect` mirroring local queue/log to store.
- Panel autonomy for the four target panels.
- Existing runtime semantics preserved (queue process, cancel, log persistence behavior).

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No server-entity duplication Query -> Zustand.
- No processor algorithm rewrite in `vm/queue/processor.ts`.
- No typed linkage redesign for `task.key` in this phase.
- No `useProxmox` ownership consolidation in `VMListContainer` during this phase (explicitly deferred).
- No edits outside VM workspace scope unless required to compile.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + Playwright + TypeScript typecheck.
- QA policy: Every task includes happy + edge/failure scenario.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave.

Wave 1: State ownership migration and orchestration cleanup (Tasks 1-5)
Wave 2: Smart panel autonomy and page cleanup (Tasks 6-10)

### Dependency Matrix (full, all tasks)
- T1 blocks: T2, T3, T4
- T2 blocks: T5, T6, T7
- T3 blocks: T5, T8
- T4 blocks: T6, T7, T8, T9
- T5 blocks: T10
- T6, T7, T8, T9 block: T10
- T10 blocks: Final Verification Wave

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 5 tasks -> `deep`, `general`, `quick`
- Wave 2 -> 5 tasks -> `visual-engineering`, `general`, `quick`
- Final Verification -> 4 tasks -> `oracle`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.

- [ ] 1. Promote Zustand queue/log slices to authoritative workflow state

  **What to do**: Extend `useVmWorkspaceStore.ts` queue/log domains with authoritative runtime fields used by VM workflow (`isProcessing`, `uiState`, `operationText`, `readyVmIds`, and current task collections). Add typed actions for atomic updates and resets; keep selectors granular.
  **Must NOT do**: Do not add server-owned VM entities from React Query into Zustand.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: state ownership contract change across multiple consumers.
  - Skills: `[]` - no special skill required.
  - Omitted: `frontend-ui-ux` - visual work is not the primary risk.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2,3,4 | Blocked By: none

  **References**:
  - Pattern: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts` - existing slices/actions/selectors structure.
  - Pattern: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceLayout.ts` - action-based store mutations.
  - API/Type: `apps/frontend/src/shared/types/vm.ts` - `VMQueueItem`, `VMTaskEntry`, `VMUiState` contracts.
  - External: `https://zustand.docs.pmnd.rs/guides/flux-inspired-practice` - colocated actions.
  - External: `https://zustand.docs.pmnd.rs/guides/prevent-rerenders-with-use-shallow` - selector rerender guard.

  **Acceptance Criteria**:
  - [ ] New queue/log runtime fields and actions compile and are exported via selectors.
  - [ ] No selector subscribes to whole store object in panel-facing hooks.

  **QA Scenarios**:
  ```bash
  Scenario: Store contracts compile
    Tool: Bash
    Steps: pnpm --filter @botmox/frontend typecheck
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-1-store-contracts.txt

  Scenario: Anti-pattern guard for broad subscriptions
    Tool: Bash
    Steps: pnpm exec rg "useVmWorkspaceStore\(\(state\) => state\)" apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts
    Expected: No matches
    Evidence: .sisyphus/evidence/task-1-store-contracts-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vm-workspace): promote zustand queue and log ownership` | Files: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`

- [ ] 2. Refactor `useVMQueue` to store-backed ownership (remove local queue/isProcessing)

  **What to do**: Rewrite `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts` so queue mutations read/write via `useVmWorkspaceStore.getState().queueActions` and queue selectors; remove local `useState` queue/isProcessing ownership and mirror paths.
  **Must NOT do**: Do not change `processVmQueue` algorithmic sequence or statuses.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: behavior-preserving ownership migration with async flow.
  - Skills: `[]`.
  - Omitted: `test` - tests are covered in task QA.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5,6,7 | Blocked By: 1

  **References**:
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts` - current queue controller API to preserve.
  - API/Type: `apps/frontend/src/features/vm-management/model/vm/queue/types.ts` - `ProcessVmQueueContext` signatures.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/queue/processor.ts` - processing pipeline contract.
  - External: `https://github.com/pmndrs/zustand/blob/main/README.md` - `getState`/`setState` usage caveats.

  **Acceptance Criteria**:
  - [ ] `useVMQueue.ts` contains no local `useState` for queue or processing ownership.
  - [ ] Returned API shape of `useVMQueue` remains compatible for current consumers.

  **QA Scenarios**:
  ```bash
  Scenario: Queue ownership migration static proof
    Tool: Bash
    Steps: pnpm exec rg "const \[queue, setQueue\]|const \[isProcessing, setIsProcessing\]" apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts
    Expected: No matches
    Evidence: .sisyphus/evidence/task-2-queue-ownership.txt

  Scenario: Build-time compatibility
    Tool: Bash
    Steps: pnpm --filter @botmox/frontend typecheck
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-2-queue-ownership-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vm-queue): route queue mutations through workspace store` | Files: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts`, `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`

- [ ] 3. Refactor `useVMLog` to store-backed task/log arrays (remove dual arrays)

  **What to do**: Migrate `tasks` and `entries` ownership in `apps/frontend/src/features/vm-management/model/useVMLog.ts` to Zustand log actions/selectors; keep persistence debounce logic and API paths unchanged.
  **Must NOT do**: Do not change task history backend path (`/api/v1/settings/vmgenerator/task_logs`) or polling policy.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: persistence + runtime lifecycle edge cases.
  - Skills: `[]`.
  - Omitted: `frontend-ui-ux`.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 5,8 | Blocked By: 1

  **References**:
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts` - existing persistence and timeout sweeper behavior.
  - Pattern: `apps/frontend/src/features/vm-management/model/vmTaskHistoryPersistence.ts` - persistence contract.
  - API/Type: `apps/frontend/src/shared/types/vm.ts` - task/detail/status contracts.

  **Acceptance Criteria**:
  - [ ] No local source `useState` arrays remain for queue/log entities in `useVMLog.ts`.
  - [ ] `startTask/taskLog/finishTask/cancelTask/clear/getFullLog` behavior is API-compatible.

  **QA Scenarios**:
  ```bash
  Scenario: Log ownership migration static proof
    Tool: Bash
    Steps: pnpm exec rg "const \[tasks, setTasks\]|const \[entries, setEntries\]" apps/frontend/src/features/vm-management/model/useVMLog.ts
    Expected: No matches
    Evidence: .sisyphus/evidence/task-3-log-ownership.txt

  Scenario: Persistence contract remains wired
    Tool: Bash
    Steps: pnpm exec rg "VM_LOG_TASKS_API_PATH|loadPersistedTasks|apiPut" apps/frontend/src/features/vm-management/model/useVMLog.ts
    Expected: All three symbols present
    Evidence: .sisyphus/evidence/task-3-log-ownership-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vm-log): move task state ownership to workspace store` | Files: `apps/frontend/src/features/vm-management/model/useVMLog.ts`, `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`

- [ ] 4. Introduce panel-facing controller hooks (autonomy adapters)

  **What to do**: Create/adjust narrow hooks consumed by panels so each panel can read selectors and invoke actions without page bridge props. Reuse existing orchestration modules (`useVmStartAndQueueActions`, `useVmOperationLogActions`) by connecting them to store-backed owners.
  **Must NOT do**: Do not reintroduce giant aggregated bridge object.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: hook composition and module boundaries.
  - Skills: `[]`.
  - Omitted: `artistry` - conventional refactor.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6,7,8,9 | Blocked By: 1

  **References**:
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmStartAndQueueActions.ts` - start/queue orchestration API.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts` - reset/cancel/copy logic and `vm:` task key convention.
  - Pattern: `apps/frontend/src/widgets/vm/useVMQueuePanelState.ts` - queue panel local modal/editor state boundaries.
  - External: `https://react.dev/learn/scaling-up-with-reducer-and-context` - split read/write responsibilities.

  **Acceptance Criteria**:
  - [ ] Each target panel can resolve required data/actions without `VMsPage` business props.
  - [ ] Controllers expose narrow contracts per panel; no `bridge` object export.

  **QA Scenarios**:
  ```bash
  Scenario: Panel controllers compile through imports
    Tool: Bash
    Steps: pnpm --filter @botmox/frontend typecheck
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-4-panel-controllers.txt

  Scenario: God-object guard
    Tool: Bash
    Steps: pnpm exec rg "bridge\.|return \{[\s\S]{500,}\}" apps/frontend/src/pages/vms/hooks --glob "*ViewModel*.ts"
    Expected: No large bridge-like return shape in panel-facing controllers
    Evidence: .sisyphus/evidence/task-4-panel-controllers-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vms): add autonomous panel controller hooks` | Files: `apps/frontend/src/pages/vms/hooks/*`, `apps/frontend/src/widgets/vm/*`

- [ ] 5. Shrink `useVmsPageViewModel.ts` to page-level orchestration only

  **What to do**: Remove queue/log mirroring effects and business aggregation from `useVmsPageViewModel.ts`. Keep only global page orchestration relevant to page lifecycle (SSE refresh glue, keyboard shortcut wiring dependencies), final size <= 30 lines.
  **Must NOT do**: Do not leave dead imports/callbacks from removed bridge paths.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused cleanup after ownership migration.
  - Skills: `[]`.
  - Omitted: `deep` - complexity already handled upstream.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 10 | Blocked By: 2,3

  **References**:
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts` - current god-object source.
  - Pattern: `apps/frontend/src/pages/vms/VMsPage.tsx` - current consumers to unwind.
  - Pattern: `apps/frontend/src/entities/vm/api/useRefreshOnVmMutationEvents.ts` - keep page-level SSE behavior.
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMKeyboardShortcuts.ts` - keep page-level shortcut behavior.

  **Acceptance Criteria**:
  - [ ] File is <= 30 lines and contains no queue/log mirror effects.
  - [ ] No `setWorkspaceQueueItems`/`setWorkspaceLogTasks` references remain.

  **QA Scenarios**:
  ```bash
  Scenario: Mirror effect removal
    Tool: Bash
    Steps: pnpm exec rg "setWorkspace(LogTasks|QueueItems)|useEffect\(\(\) => \{\s*setWorkspace" apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts
    Expected: No matches
    Evidence: .sisyphus/evidence/task-5-minimal-viewmodel.txt

  Scenario: Size constraint
    Tool: Bash
    Steps: pnpm exec node -e "const fs=require('fs');const n=fs.readFileSync('apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts','utf8').split(/\r?\n/).length; if(n>30){process.exit(1)}"
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-5-minimal-viewmodel-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vms-page): reduce viewmodel to page-level orchestration` | Files: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`

- [ ] 6. Convert `VMQueuePanel` to fully autonomous smart component

  **What to do**: Remove business props from `VMQueuePanelProps`; panel must self-load queue data and queue actions through selectors/hooks (`useVmWorkspaceStore`, queue controller hooks, storage options hook, delete-open hook).
  **Must NOT do**: Do not break queue row editing modals (`custom resources`, `unattend`) behavior.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: UI wiring + state hooks.
  - Skills: `[]`.
  - Omitted: `deep` - heavy ownership work already completed.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 2,4

  **References**:
  - Pattern: `apps/frontend/src/widgets/vm/VMQueuePanel.tsx` - current prop-heavy interface.
  - Pattern: `apps/frontend/src/widgets/vm/VMQueuePanelHeader.tsx` - command button states and enablement.
  - Pattern: `apps/frontend/src/widgets/vm/useVMQueuePanelState.ts` - local editor state internals.

  **Acceptance Criteria**:
  - [ ] `VMQueuePanel` renders with no business props in `VMsPage.tsx`.
  - [ ] Start/Add/Delete/Clear/Update actions still function through internal hooks.

  **QA Scenarios**:
  ```bash
  Scenario: Prop drilling removal proof
    Tool: Bash
    Steps: pnpm exec rg "<VMQueuePanel\s+[^/>]*(isProcessing|storageOptions|onAdd|onStartAll|onUpdate|onRemove)=" apps/frontend/src/pages/vms/VMsPage.tsx
    Expected: No matches
    Evidence: .sisyphus/evidence/task-6-queue-panel-autonomy.txt

  Scenario: Queue panel command surface still present
    Tool: Playwright
    Steps: Open /vms; click button " + VM "; verify new queue row appears; click "Clear"; verify empty-state text "Queue is empty".
    Expected: Row add and clear both succeed without console errors.
    Evidence: .sisyphus/evidence/task-6-queue-panel-autonomy-edge.png
  ```

  **Commit**: YES | Message: `refactor(vm-queue-panel): make panel self-sufficient` | Files: `apps/frontend/src/widgets/vm/VMQueuePanel.tsx`, related panel hooks

- [ ] 7. Convert `VMStatusBar` to autonomous smart component

  **What to do**: Remove queue business props from `VMStatusBar`; derive metrics (`queueTotal`, `pendingCount`, `activeCount`, `doneCount`, `errorCount`) from store selectors and call start/stop actions from autonomous controller.
  **Must NOT do**: Do not remove settings toggle UI (`onOpenSettings`, `activeTopPanel`) from workspace shell contract.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused prop-to-selector migration.
  - Skills: `[]`.
  - Omitted: `deep`.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 2,4

  **References**:
  - Pattern: `apps/frontend/src/widgets/vm/VMStatusBar.tsx` - current prop contract.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmStartAndQueueActions.ts` - queue stats derivation and start/stop actions.
  - Pattern: `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx` - settings panel integration boundaries.

  **Acceptance Criteria**:
  - [ ] `VMStatusBar` no longer receives queue business props from page.
  - [ ] Start/Stop buttons keep existing disabled logic behavior.

  **QA Scenarios**:
  ```bash
  Scenario: Status bar prop cleanup proof
    Tool: Bash
    Steps: pnpm exec rg "<VMStatusBar\s+[^/>]*(uiState|operationText|isProcessing|queueTotal|pendingCount|activeCount|doneCount|errorCount|onStart|onStop)=" apps/frontend/src/pages/vms/VMsPage.tsx
    Expected: No matches
    Evidence: .sisyphus/evidence/task-7-statusbar-autonomy.txt

  Scenario: Edge - stop disabled when idle
    Tool: Playwright
    Steps: Open /vms; locate "Stop processing" button; assert disabled before queue run.
    Expected: Button is disabled in idle state.
    Evidence: .sisyphus/evidence/task-7-statusbar-autonomy-edge.png
  ```

  **Commit**: YES | Message: `refactor(vm-statusbar): source metrics and actions internally` | Files: `apps/frontend/src/widgets/vm/VMStatusBar.tsx`, related controller hook

- [ ] 8. Convert `VMOperationLog` to autonomous smart component

  **What to do**: Remove `onClear`, `onCancelTask`, `getFullLog` props from `VMOperationLog`; resolve these via internal hooks (`useVMLog`, operation-log action hook) while keeping modal/fullscreen behavior unchanged.
  **Must NOT do**: Do not break escape-key modal close and copy behavior.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: combines store + action side effects.
  - Skills: `[]`.
  - Omitted: `visual-engineering`.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 3,4

  **References**:
  - Pattern: `apps/frontend/src/widgets/vm/VMOperationLog.tsx` - current prop usage points.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts` - clear/reset/cancel flow.
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts` - source API for full log + task actions.

  **Acceptance Criteria**:
  - [ ] `VMOperationLog` in `VMsPage.tsx` is rendered without business props.
  - [ ] Cancel flow still patches queue item status for `vm:<id>` links.

  **QA Scenarios**:
  ```bash
  Scenario: Operation log prop cleanup proof
    Tool: Bash
    Steps: pnpm exec rg "<VMOperationLog\s+[^/>]*(onClear|onCancelTask|getFullLog)=" apps/frontend/src/pages/vms/VMsPage.tsx
    Expected: No matches
    Evidence: .sisyphus/evidence/task-8-oplog-autonomy.txt

  Scenario: Edge - malformed link handled gracefully
    Tool: Bash
    Steps: pnpm exec rg "startsWith\('vm:'\)|malformed queue link key" apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts
    Expected: Guard checks and warning branch remain present.
    Evidence: .sisyphus/evidence/task-8-oplog-autonomy-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vm-operation-log): internalize actions and log source` | Files: `apps/frontend/src/widgets/vm/VMOperationLog.tsx`, `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts`

- [ ] 9. Convert `VMPageModals` to autonomous business state sourcing

  **What to do**: Keep shell props (`panelOpen`, `setPanelOpen`) only; internalize `deleteVm` workflow and `storageOptions` sourcing inside `VMPageModals` via dedicated hooks tied to shared owners.
  **Must NOT do**: Do not change `DeleteVmModal` behavior or settings modal open/close behavior.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: cross-feature wiring in modal boundary.
  - Skills: `[]`.
  - Omitted: `deep`.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10 | Blocked By: 4

  **References**:
  - Pattern: `apps/frontend/src/widgets/vm-workspace/ui/VMPageModals.tsx` - current prop contract.
  - Pattern: `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts` - delete workflow API.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmStorageOptions.ts` - storage options source.
  - Pattern: `apps/frontend/src/widgets/vm/VMSettingsForm.tsx` - modal content dependency.

  **Acceptance Criteria**:
  - [ ] `VMPageModals` no longer takes `deleteVm` or `storageOptions` from `VMsPage`.
  - [ ] Delete and settings modals remain functional with unchanged UX flow.

  **QA Scenarios**:
  ```bash
  Scenario: Modal prop cleanup proof
    Tool: Bash
    Steps: pnpm exec rg "<VMPageModals\s+[^/>]*(deleteVm|storageOptions)=" apps/frontend/src/pages/vms/VMsPage.tsx
    Expected: No matches
    Evidence: .sisyphus/evidence/task-9-modals-autonomy.txt

  Scenario: Edge - settings panel still opens
    Tool: Playwright
    Steps: Open /vms; click "Settings" in status bar; assert modal title "Virtual Machines Settings" visible; close modal.
    Expected: Modal opens and closes correctly.
    Evidence: .sisyphus/evidence/task-9-modals-autonomy-edge.png
  ```

  **Commit**: YES | Message: `refactor(vm-modals): internalize modal business dependencies` | Files: `apps/frontend/src/widgets/vm-workspace/ui/VMPageModals.tsx`, related hooks

- [ ] 10. Clean `VMsPage` composition and finalize no-business-props contract

  **What to do**: Update `VMsPage.tsx` to render panels as autonomous components (`<VMQueuePanel />`, `<VMStatusBar />`, `<VMOperationLog />`), keeping only shell-level props required by `VMWorkspace` (`openSettings`, `panelOpen`, `setPanelOpen`).
  **Must NOT do**: Do not remove page-level SSE mutation refresh and keyboard shortcut registrations.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: final contract cleanup.
  - Skills: `[]`.
  - Omitted: `deep`.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Final Verification | Blocked By: 5,6,7,8,9

  **References**:
  - Pattern: `apps/frontend/src/pages/vms/VMsPage.tsx` - current bridge fan-out.
  - Pattern: `apps/frontend/src/widgets/vm/index.ts` - panel exports.
  - Pattern: `apps/frontend/src/entities/vm/api/useRefreshOnVmMutationEvents.ts` - keep page-level mutation refresh.
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMKeyboardShortcuts.ts` - keep page-level shortcut registration.

  **Acceptance Criteria**:
  - [ ] Target panels are instantiated without business props in `VMsPage.tsx`.
  - [ ] Page still wires SSE refresh and keyboard shortcuts.

  **QA Scenarios**:
  ```bash
  Scenario: Final page contract audit
    Tool: Bash
    Steps: pnpm exec rg "<VMQueuePanel\s*/>|<VMStatusBar\s*/>|<VMOperationLog\s*/>" apps/frontend/src/pages/vms/VMsPage.tsx
    Expected: Autonomous component invocations present.
    Evidence: .sisyphus/evidence/task-10-vmspage-contract.txt

  Scenario: Edge - no accidental business prop regressions
    Tool: Bash
    Steps: pnpm exec rg "onAdd=|onStartAll=|onCancelTask=|storageOptions=|queueStats=|isProcessing=" apps/frontend/src/pages/vms/VMsPage.tsx
    Expected: No matches for removed business props.
    Evidence: .sisyphus/evidence/task-10-vmspage-contract-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vms-page): remove panel business prop drilling` | Files: `apps/frontend/src/pages/vms/VMsPage.tsx`, `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [ ] F1. Plan Compliance Audit - oracle
- [ ] F2. Code Quality Review - unspecified-high
- [ ] F3. Real Manual QA - unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check - deep

## Commit Strategy
- Commit after each task (or tightly coupled task pair) to keep rollback boundaries small.
- Preferred sequence: T1, T2, T3, T4+T5, T6, T7, T8, T9, T10.
- Conventional format: `refactor(vm-*): ...`.

## Success Criteria
- No dual-state mirroring for VM queue/log in page/viewmodel layer.
- `VMsPage` panel composition has no business prop drilling.
- `useVmsPageViewModel.ts` is minimal page-orchestration-only and <= 30 lines.
- Typecheck/build/e2e checks pass with evidence files under `.sisyphus/evidence/`.
