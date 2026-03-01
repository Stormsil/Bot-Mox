# VM Workspace Step 1: Log Ownership Cutover

## TL;DR
> **Summary**: Remove dual-state ownership from `useVMLog` and make Zustand logs slice the only source of truth for VM operation tasks/log APIs, then remove log mirror effect from VMs page bridge.
> **Deliverables**:
> - `useVMLog` rewritten without local `tasks/entries` source state
> - ViewModel log mirror effect removed
> - Log API contract preserved for current callers
> - Typecheck/build/QA parity evidence
> **Effort**: Short
> **Parallel**: YES - 2 waves
> **Critical Path**: 1 -> 2 -> 3 -> 4 -> 6

## Context
### Original Request
After failed VM workspace decoupling, execute only Step 1: hard refactor of logs ownership in `useVMLog.ts` and remove log mirroring in `useVmsPageViewModel.ts`.

### Interview Summary
- Strict scope lock to Step 1 only (logs domain).
- No queue/panel decoupling in this pass.
- Must preserve existing behavior and cancellation semantics.

### Metis Review (gaps addressed)
- Preserve method contracts (`startTask/taskLog/finishTask/cancelTask/clear/getFullLog`) to avoid ripple breakage.
- Prevent scope creep into queue ownership and prop drilling fixes.
- Keep persistence ordering/hydration guards unchanged while ownership migrates.

## Work Objectives
### Core Objective
Make Zustand logs slice authoritative for VM log task state and remove page-level mirror synchronization.

### Deliverables
- `useVMLog.ts` without local source ownership (`useState/useRef` for task/entry collections).
- Reads/writes routed through `useVmWorkspaceStore.getState().logs` and `logsActions`.
- `useVmsPageViewModel.ts` no longer mirrors `log.tasks` into store.
- Existing log API remains callable by current consumers.

### Definition of Done (verifiable conditions with commands)
- `pnpm --filter @botmox/frontend typecheck` exits 0.
- `pnpm --filter @botmox/frontend build` exits 0.
- `pnpm exec rg "setWorkspaceLogTasks\(" apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts` returns no matches.
- `pnpm exec rg "const \[tasks, setTasks\]|const tasksRef = useRef|const \[entries, setEntries\]|const entriesRef = useRef" apps/frontend/src/features/vm-management/model/useVMLog.ts` returns no matches.

### Must Have
- Single source of truth for log/task collections in Zustand.
- No log mirror effects in page viewmodel.
- Behavioral parity for start/log/finish/cancel/timeout/clear/persist.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No edits in queue ownership (`useVMQueue.ts`) during this step.
- No panel prop-contract rewrites in `VMsPage.tsx`/panel components.
- No `task.key` format changes.
- No changes to persistence endpoint path.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after (typecheck + build + targeted VM page QA run).
- QA policy: Every task includes happy + failure/edge scenario.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave.

Wave 1: Ownership and contract migration (Tasks 1-4)
Wave 2: Bridge cleanup and regression verification (Tasks 5-6)

### Dependency Matrix (full, all tasks)
- T1 blocks: T2, T3
- T2 blocks: T4, T5
- T3 blocks: T4
- T4 blocks: T6
- T5 blocks: T6
- T6 blocks: Final Verification Wave

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 4 tasks -> `deep`, `general`
- Wave 2 -> 2 tasks -> `quick`, `unspecified-high`

## TODOs
> Implementation + Test = ONE task. Never separate.

- [x] 1. Baseline current `useVMLog` behavioral contract

  **What to do**: Document current behavior invariants from `useVMLog.ts` for start/log/finish/cancel/timeout/clear/hydration/persist so refactor can be parity-checked.
  **Must NOT do**: Do not modify code in this task.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: dense state machine behavior with persistence flow.
  - Skills: `[]` — no external skill required.
  - Omitted: `visual-engineering` — non-UI logic analysis.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2,3 | Blocked By: none

  **References**:
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts` — canonical behavior to preserve.
  - Pattern: `apps/frontend/src/features/vm-management/model/vmLogWriters.ts` — writer-side log API usage.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts` — cancellation integration contract.

  **Acceptance Criteria** (agent-executable only):
  - [x] Contract checklist file exists under `.sisyphus/evidence/task-1-usevmlog-contract.md` with explicit invariants for each public method.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```
  Scenario: Happy path baseline extraction
    Tool: Read
    Steps: Read `useVMLog.ts` and list invariants for each public action.
    Expected: Invariants captured with no missing public method.
    Evidence: .sisyphus/evidence/task-1-usevmlog-contract.md

  Scenario: Edge case baseline extraction
    Tool: Read
    Steps: Capture non-happy flows: malformed cancel id, timeout auto-close, persist failure branch.
    Expected: All three edge paths documented.
    Evidence: .sisyphus/evidence/task-1-usevmlog-contract-edge.md
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [x] 2. Migrate `useVMLog` task ownership to Zustand store

  **What to do**: Remove local `tasks` ownership (`useState/useRef`) and route all reads/writes through `useVmWorkspaceStore.getState().logs.tasks` and `logsActions` methods.
  **Must NOT do**: Do not alter method signatures or semantic outcomes.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: ownership migration with concurrency/persist flow.
  - Skills: `[]`.
  - Omitted: `artistry` — conventional refactor.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 4,5 | Blocked By: 1

  **References**:
  - API/Type: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts` — logs slice/actions/selectors.
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts` — existing behavior map.

  **Acceptance Criteria** (agent-executable only):
  - [x] `useVMLog.ts` has no `tasks` local source state declarations.
  - [x] All task mutations go through store logs actions.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path ownership removal
    Tool: Bash
    Steps: pnpm exec rg "const \[tasks, setTasks\]|const tasksRef = useRef" apps/frontend/src/features/vm-management/model/useVMLog.ts
    Expected: No matches
    Evidence: .sisyphus/evidence/task-2-zustand-tasks.txt

  Scenario: Edge path mutation routing
    Tool: Bash
    Steps: pnpm exec rg "logsActions\.setTasks|useVmWorkspaceStore\.getState\(\)\.logs" apps/frontend/src/features/vm-management/model/useVMLog.ts
    Expected: Matches show centralized store ownership.
    Evidence: .sisyphus/evidence/task-2-zustand-tasks-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vm-log): move task ownership to zustand logs slice` | Files: `apps/frontend/src/features/vm-management/model/useVMLog.ts`, `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`

- [x] 3. Migrate `useVMLog` entries ownership to Zustand store

  **What to do**: Remove local `entries` ownership (`useState/useRef`) and route log entry append/clear/full-log formatting to store-backed values/actions.
  **Must NOT do**: Do not change output format of `getFullLog()`.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: focused store wiring and formatting parity.
  - Skills: `[]`.
  - Omitted: `deep` — main complexity covered in T2.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 4 | Blocked By: 1

  **References**:
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts` — entries append and formatter usage.
  - API/Type: `apps/frontend/src/features/vm-management/model/vmLogUtils.ts` — `formatFullLog` behavior.

  **Acceptance Criteria** (agent-executable only):
  - [x] `useVMLog.ts` has no local `entries` source state declarations.
  - [x] `getFullLog()` builds from store-owned entries.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path entries ownership removal
    Tool: Bash
    Steps: pnpm exec rg "const \[entries, setEntries\]|const entriesRef = useRef" apps/frontend/src/features/vm-management/model/useVMLog.ts
    Expected: No matches
    Evidence: .sisyphus/evidence/task-3-zustand-entries.txt

  Scenario: Edge path format source
    Tool: Bash
    Steps: pnpm exec rg "formatFullLog\(|logs\.entries|logsActions\.setEntries" apps/frontend/src/features/vm-management/model/useVMLog.ts
    Expected: Store-backed source is used for final log export.
    Evidence: .sisyphus/evidence/task-3-zustand-entries-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vm-log): move entry ownership to zustand logs slice` | Files: `apps/frontend/src/features/vm-management/model/useVMLog.ts`, `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`

- [x] 4. Keep `useVMLog` API action-only while preserving callers

  **What to do**: Ensure `useVMLog` returns only action API (no `entries/tasks` arrays). Update direct consumers to read arrays from Zustand selectors where needed.
  **Must NOT do**: Do not break `useVMQueue` and `useVmOperationLogActions` compile-time contracts.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: API contract change with callsite compatibility.
  - Skills: `[]`.
  - Omitted: `frontend-ui-ux`.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 6 | Blocked By: 2,3

  **References**:
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts` — log object usage.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts` — `VMLog` type consumption.
  - Pattern: `apps/frontend/src/features/vm-management/model/vm/queue/types.ts` — `VMLog` type import.

  **Acceptance Criteria** (agent-executable only):
  - [x] `useVMLog` return value excludes raw task/entry arrays.
  - [x] All existing consumers compile with updated contract.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path API surface
    Tool: Bash
    Steps: pnpm exec rg "return \{[\s\S]*entries|return \{[\s\S]*tasks" apps/frontend/src/features/vm-management/model/useVMLog.ts
    Expected: No returned raw arrays from hook API.
    Evidence: .sisyphus/evidence/task-4-action-only-api.txt

  Scenario: Edge path callsite compatibility
    Tool: Bash
    Steps: pnpm --filter @botmox/frontend typecheck
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-4-action-only-api-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vm-log): expose action-only hook api` | Files: `apps/frontend/src/features/vm-management/model/useVMLog.ts`, dependent consumers

- [x] 5. Remove page-level log mirror effect from viewmodel

  **What to do**: Delete `useEffect(() => setWorkspaceLogTasks(log.tasks), ...)` from `useVmsPageViewModel.ts` and remove obsolete imports/variables.
  **Must NOT do**: Do not remove queue mirror in this step.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: focused cleanup.
  - Skills: `[]`.
  - Omitted: `deep`.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 6 | Blocked By: 2

  **References**:
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts` — current mirror effect location.

  **Acceptance Criteria** (agent-executable only):
  - [x] No `setWorkspaceLogTasks(log.tasks)` mirror effect remains.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path mirror removal
    Tool: Bash
    Steps: pnpm exec rg "setWorkspaceLogTasks\(" apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts
    Expected: No matches
    Evidence: .sisyphus/evidence/task-5-remove-log-mirror.txt

  Scenario: Edge path dead import cleanup
    Tool: Bash
    Steps: pnpm --filter @botmox/frontend typecheck
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-5-remove-log-mirror-edge.txt
  ```

  **Commit**: YES | Message: `refactor(vms-page): remove log mirror effect to workspace store` | Files: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`

- [x] 6. Regression gate for log behavior parity

  **What to do**: Run final compile/build and execute targeted VM operation-log QA flow to verify clear/cancel/copy still works with store ownership.
  **Must NOT do**: Do not broaden into queue/panel decoupling.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: mixed compile + behavior verification.
  - Skills: `[]`.
  - Omitted: `artistry`.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Final Verification | Blocked By: 4,5

  **References**:
  - Pattern: `apps/frontend/src/widgets/vm/VMOperationLog.tsx` — UI behavior expected.
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts` — cancel/clear side effects.
  - Pattern: `apps/frontend/src/pages/vms/VMsPage.tsx` — integration surface.

  **Acceptance Criteria** (agent-executable only):
  - [x] `pnpm --filter @botmox/frontend typecheck` passes.
  - [x] `pnpm --filter @botmox/frontend build` passes.
  - [x] Operation log clear/cancel/copy targeted flow passes without runtime exceptions.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path compile/build gate
    Tool: Bash
    Steps: pnpm --filter @botmox/frontend typecheck && pnpm --filter @botmox/frontend build
    Expected: Both commands exit 0.
    Evidence: .sisyphus/evidence/task-6-regression-gate.txt

  Scenario: Failure/edge case behavior
    Tool: Playwright
    Steps: Open `/vms`; open Operation Console; invoke Copy, Clear(confirm), Cancel on running task and malformed key path.
    Expected: No crash; cancel path follows existing warning/error semantics.
    Evidence: .sisyphus/evidence/task-6-regression-gate-edge.png
  ```

  **Commit**: YES | Message: `test(vm-log): verify parity after zustand ownership cutover` | Files: evidence + optional QA script only if needed

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Keep atomic commits by concern: ownership migration, API compatibility, mirror removal, final verification.
- Do not mix queue/panel decoupling changes into Step 1 commits.

## Success Criteria
- `useVMLog` has no local task/entry source ownership.
- Log state ownership is exclusively Zustand-backed.
- `useVmsPageViewModel.ts` no longer mirrors log tasks into store.
- Compile/build pass and targeted VM log behavior remains stable.
