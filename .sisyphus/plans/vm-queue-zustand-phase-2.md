# VM Queue Zustand Phase 2 - Single Source and Decoupling

## TL;DR
> **Summary**: Remove split-brain VM queue state by making Zustand the only queue source, then decouple page-to-panel wiring so `VMQueuePanel` is smart and `VMsPage` renders it without business prop drilling.
> **Deliverables**:
> - `useVMQueue` writes/reads queue items directly in Zustand with no local queue state/ref path.
> - `useVmsPageViewModel` queue mirror effect is deleted.
> - `VMQueuePanel` consumes required actions via hooks/store and `VMsPage` uses `<VMQueuePanel />`.
> - Architectural cleanliness checks prove legacy queue paths are removed.
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: T2 -> T3 -> T4 -> T6 -> T7 -> T9

## Context
### Original Request
Epic: Surgical Refactoring Phase 2 - migrate VM Queue to pure Zustand and remove prop drilling. Required sequence: (1) remove local queue state/ref in `useVMQueue`, (2) remove synchronization effect in `useVmsPageViewModel`, (3) decouple `VMQueuePanel` so page callsite becomes `<VMQueuePanel />`.

### Interview Summary
- User requires engineering cleanliness, not regression-only confidence.
- Forbidden outcome: keeping legacy paths via wrappers/duplication while tests still pass.
- Decoupling direction is fixed: smart `VMQueuePanel` via hooks/store.
- Scope includes queue state ownership migration and prop-surface collapse only.

### Metis Review (gaps addressed)
- Added guardrail to remove all `queueRef`-based pipeline references, including processor and provisioning phase.
- Added explicit anti-split-brain checks for queue mirror removal and forbidden symbol detection.
- Added acceptance criteria for bare `<VMQueuePanel />` callsite in page.
- Added behavioral edge checks for cancellation/start/status transitions to protect against stale snapshot regressions.

## Work Objectives
### Core Objective
Establish a decision-complete, implementation-ready path to make `useVmWorkspaceStore.queue.items` the sole VM queue authority and remove page-level queue prop drilling into `VMQueuePanel`.

### Locked Decisions (no executor discretion)
- Phase boundary: only queue item ownership is migrated; `isProcessing`, `uiState`, `operationText`, and `readyVmIds` stay in `useVMQueue` local state for this phase.
- Queue pipeline contract: remove `queueRef`; use explicit fresh-read accessor (`getQueueItems`) passed into processing phases.
- Workspace interaction fields (`selectedTaskKey`, `hoveredTaskKey`) remain unchanged in this phase unless type/lint requires trivial cleanup.

### Deliverables
- Queue ownership migrated to Zustand-only flow.
- Queue processing pipeline no longer depends on `queueRef` contract.
- `useVmsPageViewModel` no longer mirrors queue state into workspace store.
- `VMQueuePanelProps` reduced to minimal/empty surface and wired as smart component.
- `VMsPage` queue pane callsite simplified to `<VMQueuePanel />`.
- Static cleanliness checks and runtime QA evidence under `.sisyphus/evidence/`.

### Definition of Done (verifiable conditions with commands)
- `pnpm --filter @botmox/frontend lint` exits 0.
- `pnpm --filter @botmox/frontend typecheck` exits 0.
- `pnpm --filter @botmox/frontend build` exits 0.
- `pnpm --filter @botmox/frontend test:e2e -- --grep "VM|queue"` exits 0.
- Node static checks confirm:
  - no `setWorkspaceQueueItems(queue.queue)` mirror effect in `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`.
  - no `queueRef` symbol in queue pipeline files.
  - `apps/frontend/src/pages/vms/VMsPage.tsx` contains bare `<VMQueuePanel />` callsite.

### Must Have
- One canonical queue source (`useVmWorkspaceStore.queue.items`).
- No local queue duplication (`useState<VMQueueItem[]>`, `queueRef`) in `useVMQueue`.
- Queue processor reads current items from store-backed accessor/getState path.
- Smart `VMQueuePanel` with no business-prop garland from `VMsPage`.
- Every task includes executable QA happy + failure/edge scenarios.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No dual-write or mirror-sync queue paths.
- No wrapper-only refactor that leaves dead legacy paths intact.
- No unrelated architecture migration outside VM queue/page/widget scope.
- No backend/domain behavior changes unrelated to queue ownership/decoupling.
- No acceptance criteria that require manual human interpretation.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after using existing frontend stack (`lint`, `typecheck`, `build`, Playwright e2e) plus static architecture-cleanliness checks.
- QA policy: every implementation task includes both happy-path and failure/edge scenario.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. Shared dependencies extracted into Wave 1.

Wave 1: State ownership foundation and queue pipeline contract migration (T1-T5)
Wave 2: UI decoupling and callsite collapse (T6-T8)
Wave 3: Hard verification, anti-pattern enforcement, evidence packaging (T9-T10)

### Dependency Matrix (full, all tasks)
| Task | Blocks | Blocked By |
|---|---|---|
| T1 | T2,T3,T4 | - |
| T2 | T3,T4,T5 | T1 |
| T3 | T5,T9 | T1,T2 |
| T4 | T5,T6,T7 | T1,T2 |
| T5 | T6,T7,T9 | T2,T3,T4 |
| T6 | T7,T8,T9 | T4,T5 |
| T7 | T8,T9 | T4,T6 |
| T8 | T9 | T6,T7 |
| T9 | T10 | T3,T5,T7,T8 |
| T10 | - | T9 |

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 5 tasks -> `deep` (contract migration), `quick` (surgical removals), `unspecified-high` (cross-file wiring)
- Wave 2 -> 3 tasks -> `visual-engineering` (widget interface refactor), `general` (controller integration)
- Wave 3 -> 2 tasks -> `quick` (gates/checks), `deep` (end-to-end regression and evidence)

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST include Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Establish queue ownership baseline and forbidden-symbol guardrails

  **What to do**: Map and freeze all current queue ownership touchpoints before code edits. Create explicit pre/post check list for `useState<VMQueueItem[]>`, `queueRef`, `setWorkspaceQueueItems(queue.queue)`, and `<VMQueuePanel ...props>` callsite shape so cleanup is measurable, not inferred.
  **Must NOT do**: Do not modify runtime behavior in this task; only baseline and guardrail setup.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused discovery + deterministic static checks.
  - Skills: `[]` - no special skill required.
  - Omitted: [`frontend-ui-ux`] - no design work.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: T2,T3,T4 | Blocked By: -

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:7` - local queue state to remove.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:13` - `queueRef` to remove.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:60` - mirror effect to remove.
  - Pattern: `apps/frontend/src/pages/vms/VMsPage.tsx:57` - prop-drilled queue panel callsite.
  - API/Type: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts:66` - canonical queue ownership (`queue.items`).
  - External: `.github/workflows/ci.yml:74` - lint/type/build/e2e quality gates.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Baseline artifact created at `.sisyphus/evidence/task-1-queue-baseline.txt` listing each forbidden symbol and its file occurrences before refactor.
  - [ ] Baseline includes command snippets that can fail fast when forbidden paths still exist after implementation.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - baseline generated]
    Tool: Bash
    Steps: Run grep/node scans for `queueRef`, `setWorkspaceQueueItems(queue.queue)`, and `VMQueuePanel` prop usage; write outputs into `.sisyphus/evidence/task-1-queue-baseline.txt`.
    Expected: Evidence file exists and contains at least one pre-refactor hit for each tracked legacy path.
    Evidence: .sisyphus/evidence/task-1-queue-baseline.txt

  Scenario: [Failure/edge case - missing detector]
    Tool: Bash
    Steps: Execute post-check command set against a known legacy snapshot (or intentionally stale branch state) to validate non-zero exit on forbidden symbols.
    Expected: Detector exits non-zero and prints which forbidden symbol remains.
    Evidence: .sisyphus/evidence/task-1-queue-baseline-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/evidence/task-1-queue-baseline.txt`

- [x] 2. Migrate `useVMQueue` to direct Zustand queue ownership

  **What to do**: In `useVMQueue.ts`, remove local queue state and `queueRef`. Replace `syncQueue` with direct store read/write using `useVmWorkspaceStore.getState().queue.items` + `queueActions.setItems`. Replace all queue reads previously using ref with store reads. Remove `queue` from hook return contract.
  **Must NOT do**: Do not leave compatibility wrappers (`queueRef` aliases, shadow queue state, or hidden mirror writes).

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: core state ownership migration with many downstream impacts.
  - Skills: `[]` - local codebase patterns are sufficient.
  - Omitted: [`test`] - test generation is not the primary change.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: T3,T4,T5 | Blocked By: T1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:16` - existing `syncQueue` implementation to replace.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:27` - queue-name generation currently reads from `queueRef`.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:60` - delete-task dedupe currently reads from `queueRef`.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:141` - processor call currently passes `queueRef`.
  - API/Type: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts:147` - store access pattern and actions.
  - API/Type: `apps/frontend/src/features/vm-management/model/vm/queue/types.ts:38` - `ProcessVmQueueContext` needs contract alignment.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts` contains no `useState<VMQueueItem[]>` and no `queueRef` declaration.
  - [ ] `syncQueue` writes directly to Zustand queue actions.
  - [ ] `useVMQueue` return object has no `queue` array field.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - hook ownership migrated]
    Tool: Bash
    Steps: Run static check command that scans `useVMQueue.ts` for forbidden symbols (`useState<VMQueueItem[]>`, `queueRef`, `return { ... queue, ... }`).
    Expected: Command exits 0 with "PASS: useVMQueue is Zustand-only".
    Evidence: .sisyphus/evidence/task-2-usevmqueue-zustand.txt

  Scenario: [Failure/edge case - legacy path leakage]
    Tool: Bash
    Steps: Run same static check against intentionally stale revision/state containing `queueRef`.
    Expected: Command exits non-zero and identifies leaked symbol and file.
    Evidence: .sisyphus/evidence/task-2-usevmqueue-zustand-error.txt
  ```

  **Commit**: YES | Message: `refactor(vm-queue): move useVMQueue state ownership to zustand` | Files: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts`

- [x] 3. Remove `queueRef` contract from queue processor pipeline

  **What to do**: Replace `ProcessVmQueueContext.queueRef` contract with fresh-read accessor pattern (e.g., `getQueueItems`) and propagate through processor and provisioning phase usage. Ensure all previous `queueRef.current` reads are replaced with accessor/store reads and behavior remains equivalent.
  **Must NOT do**: Do not keep `queueRef` in types as deprecated/unused residue.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: cross-file async pipeline semantics and cancellation edge handling.
  - Skills: `[]` - no external framework guidance needed.
  - Omitted: [`frontend-ui-ux`] - logic-only backend-like pipeline change.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: T5,T9 | Blocked By: T1,T2

  **References** (executor has NO interview context - be exhaustive):
  - API/Type: `apps/frontend/src/features/vm-management/model/vm/queue/types.ts:42` - `queueRef` field to replace.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/queue/processor.ts:55` - pending items read from ref.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/queue/processor.ts:189` - error fallback iteration from ref.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/queue/processor.ts:158` - provisioning phase arg currently passes ref.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/queue/provisioningPhase.ts:48` - ref consumer to migrate.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Queue pipeline types no longer declare `queueRef` in context.
  - [ ] Processor and provisioning phase compile and use fresh queue read accessor/store path.
  - [ ] No `queueRef` symbol remains under `apps/frontend/src/features/vm-management/model/vm/queue/`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - pipeline contract migrated]
    Tool: Bash
    Steps: Run grep/node static scan over queue pipeline directory for `queueRef`; run TypeScript typecheck.
    Expected: Zero matches for `queueRef` and typecheck exits 0.
    Evidence: .sisyphus/evidence/task-3-processor-contract.txt

  Scenario: [Failure/edge case - cancellation path integrity]
    Tool: Playwright
    Steps: Trigger queue processing, request cancel during active phase, observe status/log transitions for cooperative cancel.
    Expected: No crash; operation ends in expected cancelled/error UI path and logs record cooperative stop.
    Evidence: .sisyphus/evidence/task-3-processor-contract-error.png
  ```

  **Commit**: YES | Message: `refactor(vm-queue): remove queueRef from processing pipeline contracts` | Files: `apps/frontend/src/features/vm-management/model/vm/queue/types.ts`, `apps/frontend/src/features/vm-management/model/vm/queue/processor.ts`, `apps/frontend/src/features/vm-management/model/vm/queue/provisioningPhase.ts`

- [x] 4. Remove queue mirror synchronization in `useVmsPageViewModel`

  **What to do**: Delete queue mirror effect and unused queue-actions import from `useVmsPageViewModel.ts`. Rewire local variables so queue items consumed by downstream hooks come from canonical store selector/path rather than `queue.queue`.
  **Must NOT do**: Do not leave dead imports or noop effects.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: targeted effect removal and minimal wiring cleanup.
  - Skills: `[]` - straightforward hook cleanup.
  - Omitted: [`test`] - test creation not required.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: T5,T6,T7 | Blocked By: T1,T2

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:28` - queue actions import currently used for mirror.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:60` - effect to remove.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:35` - `queueItems = queue.queue` current derivation to adapt.
  - API/Type: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts:301` - queue items selector available.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `useVmsPageViewModel.ts` has no `setWorkspaceQueueItems(queue.queue)` effect.
  - [ ] File compiles with no unused imports related to removed mirror path.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - mirror effect removed]
    Tool: Bash
    Steps: Run static check to assert absent pattern `setWorkspaceQueueItems(` and absent `useVmWorkspaceQueueActions` import in file.
    Expected: Exit 0 with PASS markers.
    Evidence: .sisyphus/evidence/task-4-remove-mirror.txt

  Scenario: [Failure/edge case - stale mirror path]
    Tool: Bash
    Steps: Execute same checker against stale snapshot containing effect.
    Expected: Exit non-zero with explicit failure message naming the mirror effect.
    Evidence: .sisyphus/evidence/task-4-remove-mirror-error.txt
  ```

  **Commit**: YES | Message: `refactor(vms-page): remove queue mirror synchronization effect` | Files: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`

- [x] 5. Realign queue-dependent workflows to store-backed queue items

  **What to do**: Update controller wiring where downstream hooks currently rely on `queue.queue` (`useDeleteVmWorkflow`, `useVmStartAndQueueActions`, queue live refs, recreate flow). Pass canonical queue items source explicitly while preserving current behavior contracts.
  **Must NOT do**: Do not reintroduce hidden queue duplication inside wrapper objects.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: multiple hook contracts must stay behavior-compatible.
  - Skills: `[]` - internal patterns sufficient.
  - Omitted: [`frontend-ui-ux`] - logic/dataflow work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: T6,T7,T9 | Blocked By: T2,T3,T4

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:139` - delete workflow queue wiring currently uses `queue.queue`.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:176` - start-and-queue hook wiring currently uses `queue.queue`.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmPageLiveRefs.ts:18` - queueItems ref synchronization consumer.
  - Pattern: `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts:53` - queued delete dedupe logic consumes queue array.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmStartAndQueueActions.ts:74` - queue item lookup/update flow.

  **Acceptance Criteria** (agent-executable only):
  - [ ] No `queue.queue` property access remains in `useVmsPageViewModel.ts`.
  - [ ] Queue stats/start/delete behavior compiles and remains wired through canonical queue items source.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - downstream wiring preserved]
    Tool: Playwright
    Steps: Add VM queue item, edit resources, queue delete task, verify counts/status UI updates remain consistent.
    Expected: Queue mutations reflect immediately; delete dedupe still prevents duplicate delete task for same VM.
    Evidence: .sisyphus/evidence/task-5-workflow-realign.png

  Scenario: [Failure/edge case - duplicate delete protection]
    Tool: Playwright
    Steps: Attempt adding delete task for same VM twice through delete modal flow.
    Expected: Second add is rejected/warned; only one delete task exists for target VM.
    Evidence: .sisyphus/evidence/task-5-workflow-realign-error.png
  ```

  **Commit**: YES | Message: `refactor(vms-controller): align queue consumers to zustand source` | Files: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`, `apps/frontend/src/pages/vms/hooks/useVmPageLiveRefs.ts`, `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts`, `apps/frontend/src/pages/vms/hooks/useVmStartAndQueueActions.ts`

- [x] 6. Convert `VMQueuePanel` to smart component with minimal/empty props

  **What to do**: Refactor `VMQueuePanel.tsx` to fetch required actions/data via hooks/store (including start/delete/update/add actions and resource metadata), reducing `VMQueuePanelProps` to minimal/empty. Keep existing queue context provider contract for rows unless simplification is clearly safe.
  **Must NOT do**: Do not move unrelated page orchestration into panel if not required for queue panel behavior.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` - Reason: widget boundary/UX behavior must stay intact while changing ownership.
  - Skills: `[]` - existing component patterns in repo are sufficient.
  - Omitted: [`test`] - implementation-first refactor.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: T7,T8,T9 | Blocked By: T4,T5

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/vm/VMQueuePanel.tsx:28` - oversized props interface to collapse.
  - Pattern: `apps/frontend/src/widgets/vm/VMQueuePanel.tsx:70` - context value assembly point to keep behavior stable.
  - Pattern: `apps/frontend/src/widgets/vm/VMQueuePanelHeader.tsx:3` - header action props dependency surface.
  - Pattern: `apps/frontend/src/features/vm-queue/model/VMQueueContext.tsx:15` - row subtree contract to preserve/align.
  - Pattern: `apps/frontend/src/widgets/vm/useVMQueuePanelState.ts` - panel-local smart state pattern.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `VMQueuePanelProps` no longer carries business prop garland (target empty/minimal).
  - [ ] Panel compiles and still supports add/clear/delete/start/update row actions.
  - [ ] Row context consumers remain type-safe and functionally wired.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - panel actions intact]
    Tool: Playwright
    Steps: Open `/vms`, use panel buttons (Add VM, Delete VM modal entry, Start all when available, Clear).
    Expected: Buttons trigger same behavior as pre-refactor; no runtime errors.
    Evidence: .sisyphus/evidence/task-6-smart-panel.png

  Scenario: [Failure/edge case - action disabled states]
    Tool: Playwright
    Steps: During active processing/start action, validate disabled states for conflicting controls.
    Expected: Controls follow previous safety constraints (no invalid concurrent action).
    Evidence: .sisyphus/evidence/task-6-smart-panel-error.png
  ```

  **Commit**: YES | Message: `refactor(vm-queue-panel): convert panel to smart hook-driven component` | Files: `apps/frontend/src/widgets/vm/VMQueuePanel.tsx`, `apps/frontend/src/widgets/vm/VMQueuePanelHeader.tsx`, `apps/frontend/src/features/vm-queue/model/VMQueueContext.tsx`

- [x] 7. Collapse VMs page queue-pane callsite to `<VMQueuePanel />`

  **What to do**: Update `VMsPage.tsx` queue pane render so it passes no business props to `VMQueuePanel`. Remove now-redundant wiring from controller bridge/page-level callsite.
  **Must NOT do**: Do not change status bar/service/log pane contracts beyond queue-pane decoupling needs.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: narrow callsite simplification with deterministic acceptance check.
  - Skills: `[]` - straightforward JSX cleanup.
  - Omitted: [`frontend-ui-ux`] - no visual redesign.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: T8,T9 | Blocked By: T4,T6

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/vms/VMsPage.tsx:57` - current prop-drilled queue panel invocation.
  - Pattern: `apps/frontend/src/pages/vms/VMsPage.tsx:32` - status bar still consumes controller queue status and must remain.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:216` - returned controller fields impacted by callsite cleanup.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `VMsPage.tsx` renders queue pane with bare `<VMQueuePanel />`.
  - [ ] Removed queue-panel-specific page props are not left as dead controller outputs.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - page renders smart panel]
    Tool: Bash
    Steps: Run static JSX check verifying `<VMQueuePanel />` appears without prop attributes in `VMsPage.tsx`.
    Expected: Exit 0 and PASS message.
    Evidence: .sisyphus/evidence/task-7-page-callsite.txt

  Scenario: [Failure/edge case - lingering prop drilling]
    Tool: Bash
    Steps: Run detector that fails if `<VMQueuePanel` contains `isProcessing=`/`onUpdate=`/`storageOptions=` etc.
    Expected: Non-zero on lingering props; output lists first offending attribute.
    Evidence: .sisyphus/evidence/task-7-page-callsite-error.txt
  ```

  **Commit**: YES | Message: `refactor(vms-page): remove queue panel prop drilling callsite` | Files: `apps/frontend/src/pages/vms/VMsPage.tsx`, `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`

- [x] 8. Remove dead queue contracts/imports and enforce boundary cleanliness

  **What to do**: Clean up obsolete types, imports, and helper shapes introduced by queue ownership migration and panel decoupling. Ensure no stale fields (`queue.queue`) remain in controller contracts and no unused props/types linger.
  **Must NOT do**: Do not delete active status/log/start contracts still consumed by `VMStatusBar` or keyboard shortcuts.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: deterministic dead-code/type cleanup.
  - Skills: `[]` - lint/type system provides sufficient feedback.
  - Omitted: [`deep`] - no new architecture decisions.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: T9 | Blocked By: T6,T7

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:216` - controller return surface.
  - Pattern: `apps/frontend/src/widgets/vm/VMQueuePanel.tsx:28` - props/type surface.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/queue/types.ts:38` - queue processing context contract.
  - Guardrail: `scripts/check-ui-boundaries.js` - page/widget import boundary safety.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Frontend lint reports no unused imports/types after refactor.
  - [ ] Typecheck passes with updated contracts and no stale queue-path references.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - dead code removed]
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend lint` and capture output.
    Expected: Exit 0; no unused import/type errors in touched files.
    Evidence: .sisyphus/evidence/task-8-clean-contracts.txt

  Scenario: [Failure/edge case - stale contract symbol]
    Tool: Bash
    Steps: Run static scan for `queue.queue` and removed prop names in touched controller/page/widget files.
    Expected: Non-zero if stale symbols remain; output includes file and symbol.
    Evidence: .sisyphus/evidence/task-8-clean-contracts-error.txt
  ```

  **Commit**: YES | Message: `chore(vm-queue): remove stale queue contracts and dead imports` | Files: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`, `apps/frontend/src/widgets/vm/VMQueuePanel.tsx`, `apps/frontend/src/features/vm-management/model/vm/queue/types.ts`

- [x] 9. Run architectural cleanup gates (anti-wrapper / anti-legacy)

  **What to do**: Execute deterministic static checks that enforce cleanliness constraints: no local queue state in `useVMQueue`, no `queueRef` in pipeline, no queue mirror effect, and bare `VMQueuePanel` page callsite. Store outputs in evidence files.
  **Must NOT do**: Do not mark task complete if any check is warning-only; all must hard-fail on violation.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: scripted gates with strict pass/fail.
  - Skills: `[]` - scripting and repo checks only.
  - Omitted: [`frontend-ui-ux`] - non-UI verification.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: T10 | Blocked By: T3,T5,T7,T8

  **References** (executor has NO interview context - be exhaustive):
  - Guardrail target: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts`.
  - Guardrail target: `apps/frontend/src/features/vm-management/model/vm/queue/types.ts`.
  - Guardrail target: `apps/frontend/src/features/vm-management/model/vm/queue/processor.ts`.
  - Guardrail target: `apps/frontend/src/features/vm-management/model/vm/queue/provisioningPhase.ts`.
  - Guardrail target: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`.
  - Guardrail target: `apps/frontend/src/pages/vms/VMsPage.tsx`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] Static guardrail command suite exits 0 and emits PASS for all four policy checks.
  - [ ] Evidence files include full command outputs for traceability.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - all guardrails pass]
    Tool: Bash
    Steps: Run node-based check suite for forbidden symbols and required callsite shape; save output.
    Expected: All checks PASS, exit 0.
    Evidence: .sisyphus/evidence/task-9-architecture-gates.txt

  Scenario: [Failure/edge case - detect wrapper residue]
    Tool: Bash
    Steps: Execute same suite against stale branch snapshot retaining one forbidden symbol.
    Expected: Non-zero exit with targeted failure identifier (symbol + file).
    Evidence: .sisyphus/evidence/task-9-architecture-gates-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/evidence/task-9-architecture-gates.txt`

- [x] 10. Execute full regression wave and collect QA evidence

  **What to do**: Run required frontend gates and targeted VM queue e2e checks to confirm behavioral parity after architectural cleanup. Archive run outputs/screenshots/videos under evidence paths.
  **Must NOT do**: Do not skip failed checks; fix and rerun until all required checks are green.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: multi-check verification and behavior parity confirmation.
  - Skills: `[]` - existing QA tooling suffices.
  - Omitted: [`artistry`] - no creative problem framing needed.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: - | Blocked By: T9

  **References** (executor has NO interview context - be exhaustive):
  - Command source: `apps/frontend/package.json:10` - `typecheck`.
  - Command source: `apps/frontend/package.json:12` - `lint`.
  - Command source: `apps/frontend/package.json:11` - `build`.
  - Command source: `apps/frontend/package.json:14` - Playwright e2e.
  - Config: `apps/frontend/playwright.config.ts`.
  - Representative e2e: `apps/frontend/e2e/authenticated-shell.spec.ts`, `apps/frontend/e2e/fsd-boundaries-migration.spec.ts`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @botmox/frontend lint` exits 0.
  - [ ] `pnpm --filter @botmox/frontend typecheck` exits 0.
  - [ ] `pnpm --filter @botmox/frontend build` exits 0.
  - [ ] `pnpm --filter @botmox/frontend test:e2e -- --grep "VM|queue"` exits 0.
  - [ ] Evidence bundle exists with command logs and Playwright artifacts.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```bash
  Scenario: [Happy path - full regression green]
    Tool: Bash
    Steps: Execute lint, typecheck, build, and targeted Playwright VM/queue runs; capture outputs.
    Expected: All commands return exit 0.
    Evidence: .sisyphus/evidence/task-10-regression-wave.txt

  Scenario: [Failure/edge case - queue operation error handling]
    Tool: Playwright
    Steps: Trigger queue action with invalid/missing prerequisite (e.g., start action on non-ready item path) and observe UI behavior.
    Expected: Graceful failure path (disabled action or clear warning), no crash/blank state.
    Evidence: .sisyphus/evidence/task-10-regression-wave-error.png
  ```

  **Commit**: YES | Message: `chore(vm-queue): validate refactor with architecture and regression gates` | Files: `.sisyphus/evidence/task-10-regression-wave.txt`

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit - oracle
- [x] F2. Code Quality Review - unspecified-high
- [x] F3. Real UI QA (agent-executed) - unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check - deep

## Commit Strategy
- Commit 1: queue ownership + processor contract migration (`refactor(vm-queue): unify queue ownership in zustand store`).
- Commit 2: panel smart decoupling + page callsite cleanup (`refactor(vms-page): decouple queue panel from business prop drilling`).
- Commit 3: verification scripts/evidence adjustments (`chore(vm-queue): enforce architectural cleanup checks`).

## Success Criteria
- Queue state ownership is singular and demonstrably enforced by static checks.
- No stale/legacy queue path remains in queue hook, controller mirror, or processor contracts.
- `VMQueuePanel` no longer depends on page-level business prop chain.
- Existing VM queue UX behaviors (add/update/remove/start/cancel/delete-task flows) remain functional under automated checks.
