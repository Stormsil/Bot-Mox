# VM Logs Surgical Refactor to Pure Zustand

## TL;DR
> **Summary**: Remove dual-state residue from VM logging so `useVMLog` acts as an action-only facade writing directly to Zustand for log/task updates.
> **Deliverables**:
> - `addLogEntry` action added to VM workspace store logs slice
> - `useVMLog` write paths migrated to direct store actions with action-time reads
> - `useVmsPageViewModel` confirmed free of task-sync log bridging
> - frontend type/build verification and static anti-pattern assertions captured as evidence
> **Effort**: Short
> **Parallel**: YES - 2 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 7

## Context
### Original Request
User requested a strict-scope surgical refactor to eliminate dual-state anti-pattern in VM logs, keeping `useVMLog` stateless for business data and writing directly into Zustand.

### Interview Summary
- Scope locked to requested core work only (no additional hardening in this plan).
- Verification should prove architectural quality gates (single source of truth, removed anti-pattern paths), not only generic regression checks.
- `setWorkspaceLogTasks(log.tasks)` removal request is retained as an explicit verification check even though current code already appears clean.

### Metis Review (gaps addressed)
- Guardrail added: do not expand into hydration-race hardening in this plan.
- Guardrail added: preserve existing `VMLog` action API consumed by queue modules.
- Acceptance checks include static assertions for anti-pattern removal and required new store action presence.

## Work Objectives
### Core Objective
Make VM log state updates flow directly to Zustand actions, with no local business state ownership in `useVMLog` and no stale log-task synchronization bridge in VMS page orchestration.

### Deliverables
- Updated logs slice action contract in `useVmWorkspaceStore` with `addLogEntry(entry)`.
- Updated `useVMLog` internals to use direct store actions for entry appends and task reads/writes.
- Confirmed compatibility in `vmLogWriters` and `vmLogUtils` with action-only `useVMLog` surface.
- Confirmed/cleaned `useVmsPageViewModel` log synchronization effects.
- Evidence artifacts for compile/build + static architecture assertions.

### Definition of Done (verifiable conditions with commands)
- `pnpm --dir apps/frontend run typecheck` exits `0`.
- `pnpm --dir apps/frontend run build` exits `0`.
- Static assertion confirms `addLogEntry` interface + implementation exists in store file.
- Static assertion confirms legacy entry append pattern (`[...getEntries(), entry]`) is absent in `useVMLog.ts`.
- Static assertion confirms `setWorkspaceLogTasks(` is absent in `useVmsPageViewModel.ts`.

### Must Have
- No `useState`/`useRef` business state for entries/tasks in `useVMLog.ts`.
- No hook-selector (`useVmWorkspaceStore(state => ...)`) reads inside action callbacks in `useVMLog.ts`.
- `useVMLog` returns only action methods.
- Store remains source of truth for `VMOperationLog` data consumption.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No migration of queue ownership from local state to Zustand in this plan.
- No hydration/polling race hardening changes in this plan.
- No API contract changes in queue processor consumers of `VMLog` methods.
- No commented-out dead code; remove obsolete code paths directly.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after + TypeScript compile/build + targeted static assertions.
- QA policy: Every task includes happy + failure/edge scenario with concrete command-level checks.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. <3 per wave (except final) = under-splitting.
> Extract shared dependencies as Wave-1 tasks for max parallelism.

Wave 1: store contract + core hook refactor + compatibility checks
Wave 2: page bridge cleanup + anti-pattern assertions + compile/build gate

### Dependency Matrix (full, all tasks)
| Task | Depends On | Blocks |
|---|---|---|
| 1 | - | 2, 5, 7 |
| 2 | 1 | 3, 4, 7 |
| 3 | 2 | 7 |
| 4 | 2 | 7 |
| 5 | 1 | 7 |
| 6 | - | 7 |
| 7 | 1,2,3,4,5,6 | Final Verification Wave |

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 5 tasks -> `quick`, `unspecified-low`
- Wave 2 -> 2 tasks -> `quick`, `unspecified-low`
- Final Verification -> 4 tasks -> `oracle`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Extend logs slice with atomic `addLogEntry`

  **What to do**: In `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`, add `addLogEntry: (entry: VMLogEntry) => void` to `VmWorkspaceLogsActions`, then implement it in `logsActions` using functional set: append to `state.logs.entries` without touching other log fields.
  **Must NOT do**: Do not remove existing `setEntries`/`setTasks` in this task; do not alter queue/layout slices.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: single-file store contract extension.
  - Skills: `[]` — minimal direct change.
  - Omitted: `["frontend-ui-ux"]` — no UI/layout work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2,5,7 | Blocked By: -

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts:101` — `VmWorkspaceLogsActions` shape location.
  - Pattern: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts:211` — existing `logsActions` implementation style.
  - API/Type: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts:72` — logs state includes `entries` and `tasks`.
  - API/Type: `apps/frontend/src/shared/types` — `VMLogEntry` type contract.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `addLogEntry` appears in `VmWorkspaceLogsActions` interface and logsActions implementation.
  - [ ] Implementation uses functional updater and appends to `logs.entries` preserving prior entries.
  - [ ] `pnpm --dir apps/frontend run typecheck` exits `0`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path - addLogEntry contract exists and appends
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/widgets/vm-workspace/model/useVmWorkspaceStore.ts','utf8');if(!/addLogEntry\s*:\s*\(entry:\s*VMLogEntry\)\s*=>\s*void/.test(s)) throw new Error('interface missing'); if(!/addLogEntry\s*:\s*\(entry\)\s*=>\s*set\(\(state\)\s*=>\s*\(\{[\s\S]*entries:\s*\[\.\.\.state\.logs\.entries,\s*entry\]/.test(s)) throw new Error('impl missing'); console.log('ok')"
    Expected: Prints `ok` and exits 0.
    Evidence: .sisyphus/evidence/task-1-add-log-entry.txt

  Scenario: Failure/edge case - no destructive slice overwrite
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/widgets/vm-workspace/model/useVmWorkspaceStore.ts','utf8');if(/set\(\{\s*logs\s*:/.test(s)) throw new Error('direct overwrite detected');console.log('ok')"
    Expected: No direct `set({ logs: ... })` overwrite pattern for `addLogEntry` path; exits 0.
    Evidence: .sisyphus/evidence/task-1-add-log-entry-error.txt
  ```

  **Commit**: NO | Message: `refactor(vm-store): add atomic addLogEntry action` | Files: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`

- [x] 2. Refactor `useVMLog` entry append path to direct store action

  **What to do**: In `apps/frontend/src/features/vm-management/model/useVMLog.ts`, replace entry append read-modify-write path (`getEntries` + array clone + `setEntries`) with direct action call `useVmWorkspaceStore.getState().logsActions.addLogEntry(entry)` inside `push`.
  **Must NOT do**: Do not change writer method signatures (`info/warn/error/debug/step/table/diffTable`); do not alter task persistence logic.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: contained hook refactor.
  - Skills: `[]` — direct migration.
  - Omitted: `["test"]` — no new test files requested.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3,4,7 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts:190` — current entries read helper.
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts:199` — current `push` callback append logic.
  - Pattern: `apps/frontend/src/features/vm-management/model/vmLogWriters.ts:5` — writers only need `push(entry)` contract.
  - API/Type: `apps/frontend/src/features/vm-management/model/useVMLog.ts:397` — writer integration call-site.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `push` writes via `logsActions.addLogEntry`.
  - [ ] Legacy `nextEntries = [...getEntries(), entry]` pattern is removed.
  - [ ] `vmLogWriters.ts` usage remains type-correct after change (`pnpm --dir apps/frontend run typecheck` exits `0`).

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path - push uses addLogEntry
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/features/vm-management/model/useVMLog.ts','utf8');if(!/logsActions\.addLogEntry\(entry\)/.test(s)) throw new Error('addLogEntry not used'); if(/\[\.\.\.getEntries\(\),\s*entry\]/.test(s)) throw new Error('legacy append remains'); console.log('ok')"
    Expected: Prints `ok` and exits 0.
    Evidence: .sisyphus/evidence/task-2-push-zustand.txt

  Scenario: Failure/edge case - writers API contract preserved
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/features/vm-management/model/useVMLog.ts','utf8');const required=['info','warn','error','debug','step','table','diffTable'];for(const k of required){if(!new RegExp('\\b'+k+'\\b').test(s)) throw new Error('missing '+k);}console.log('ok')"
    Expected: All writer method names still present; exits 0.
    Evidence: .sisyphus/evidence/task-2-push-zustand-error.txt
  ```

  **Commit**: NO | Message: `refactor(vm-log): route entry append via store action` | Files: `apps/frontend/src/features/vm-management/model/useVMLog.ts`

- [x] 3. Enforce action-time store reads for task logic in `useVMLog`

  **What to do**: Audit `useVMLog.ts` task lifecycle callbacks (`startTask`, `updateTask`, `closeRunningTaskById`, `timeoutStaleRunningTasks`, etc.) and ensure task reads use `useVmWorkspaceStore.getState().logs.tasks` at invocation time. Keep writes through `logsActions.setTasks(cloned)`.
  **Must NOT do**: Do not introduce hook-selector reads in callbacks; do not reintroduce local `useState`/business `useRef` for tasks/entries.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: slightly broader callback audit in one file.
  - Skills: `[]` — localized logic verification.
  - Omitted: `["ultrabrain"]` — no hard algorithmic redesign.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7 | Blocked By: 2

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts:207` — current `getTasks` helper.
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts:261` — `startTask` callback.
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts:228` — `closeRunningTaskById` callback.
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts:362` — timeout sweep path.
  - External: `https://github.com/pmndrs/zustand/blob/main/README.md` — non-reactive reads via `getState` in action-time flows.

  **Acceptance Criteria** (agent-executable only):
  - [ ] No `useVmWorkspaceStore(state => ...)` selector usage inside action callbacks in `useVMLog.ts`.
  - [ ] Task reads in callbacks use action-time store snapshot (`getState().logs.tasks`) directly or via callback-safe helper.
  - [ ] No business-data `useState<VMTaskEntry[]>` / `useRef<VMTaskEntry[]>` / `useState<VMLogEntry[]>` remains.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path - callback-safe Zustand read pattern
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/features/vm-management/model/useVMLog.ts','utf8');if(!/getState\(\)\.logs\.tasks/.test(s)) throw new Error('missing action-time task reads'); if(/useVmWorkspaceStore\(\s*\(state\)\s*=>\s*state\.logs\.(tasks|entries)\s*\)/.test(s)) throw new Error('hook selector used in callbacks'); console.log('ok')"
    Expected: Prints `ok` and exits 0.
    Evidence: .sisyphus/evidence/task-3-action-time-reads.txt

  Scenario: Failure/edge case - forbidden local business state absent
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/features/vm-management/model/useVMLog.ts','utf8');const forbidden=[/useState<\s*VMTaskEntry\s*\[\]\s*>/,/useRef<\s*VMTaskEntry\s*\[\]\s*>/,/useState<\s*VMLogEntry\s*\[\]\s*>/,/useRef<\s*VMLogEntry\s*\[\]\s*>/];if(forbidden.some((r)=>r.test(s))) throw new Error('local business state found'); console.log('ok')"
    Expected: No forbidden patterns; exits 0.
    Evidence: .sisyphus/evidence/task-3-action-time-reads-error.txt
  ```

  **Commit**: NO | Message: `refactor(vm-log): enforce action-time task snapshot reads` | Files: `apps/frontend/src/features/vm-management/model/useVMLog.ts`

- [x] 4. Lock `getFullLog` to Zustand entries source

  **What to do**: Ensure `getFullLog` in `useVMLog.ts` reads current entries from store (`useVmWorkspaceStore.getState().logs.entries`) and formats them via `formatFullLog`.
  **Must NOT do**: Do not switch formatter behavior or output format; do not read from transient/local arrays.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: single callback verification/refinement.
  - Skills: `[]` — no complex branching.
  - Omitted: `["writing"]` — no documentation-only work.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7 | Blocked By: 2

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/features/vm-management/model/useVMLog.ts:416` — `getFullLog` callback.
  - Pattern: `apps/frontend/src/features/vm-management/model/vmLogUtils.ts:106` — `formatFullLog(entries)` contract.
  - Consumer: `apps/frontend/src/widgets/vm/VMOperationLog.tsx:35` — fallback copy path uses `getFullLog()`.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `getFullLog` callback reads from `getState().logs.entries` and returns `formatFullLog(...)`.
  - [ ] Copy-log consumer path in `VMOperationLog.tsx` still compiles and typechecks.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path - getFullLog source is store entries
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/features/vm-management/model/useVMLog.ts','utf8');if(!/getFullLog\s*=\s*useCallback\([\s\S]*getState\(\)\.logs\.entries[\s\S]*formatFullLog/.test(s)) throw new Error('getFullLog not store-backed'); console.log('ok')"
    Expected: Prints `ok` and exits 0.
    Evidence: .sisyphus/evidence/task-4-get-full-log.txt

  Scenario: Failure/edge case - formatter contract not bypassed
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/features/vm-management/model/useVMLog.ts','utf8');if(/return\s+JSON\.stringify\(/.test(s)) throw new Error('formatter bypass detected');console.log('ok')"
    Expected: No ad-hoc full-log serialization bypass; exits 0.
    Evidence: .sisyphus/evidence/task-4-get-full-log-error.txt
  ```

  **Commit**: NO | Message: `refactor(vm-log): keep getFullLog store-derived` | Files: `apps/frontend/src/features/vm-management/model/useVMLog.ts`

- [x] 5. Validate `vmLogWriters`/queue contract compatibility with action-only `VMLog`

  **What to do**: Verify `vmLogWriters.ts` still works with refactored `push` and that `VMLog` return type from `useVMLog` remains compatible with queue module expectations.
  **Must NOT do**: Do not add new methods to `VMLog`; do not rename existing methods consumed by queue phases.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` — Reason: multi-file type contract check.
  - Skills: `[]` — standard type-surface validation.
  - Omitted: `["deep"]` — no cross-service architecture redesign.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/features/vm-management/model/vmLogWriters.ts:5` — writer dependency only requires `push(entry)`.
  - API/Type: `apps/frontend/src/features/vm-management/model/useVMLog.ts:438` — `VMLog` type alias.
  - Consumer: `apps/frontend/src/features/vm-management/model/vm/queue/types.ts:7` — queue imports `VMLog`.
  - Consumer: `apps/frontend/src/features/vm-management/model/vm/queue/processor.ts` — queue runtime calls log action methods.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `VMLog` method names required by queue still exist.
  - [ ] `pnpm --dir apps/frontend run typecheck` exits `0` with queue modules compiling.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path - queue imports still typecheck against VMLog
    Tool: Bash
    Steps: pnpm --dir apps/frontend run typecheck
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/task-5-vmlog-compat.txt

  Scenario: Failure/edge case - no accidental VMLog API shrink
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/features/vm-management/model/useVMLog.ts','utf8');const keys=['startTask','taskLog','finishTask','info','warn','error','debug','step','table','diffTable','cancelTask','clear','getFullLog'];for(const k of keys){if(!new RegExp('\\b'+k+'\\b').test(s)) throw new Error('missing '+k);}console.log('ok')"
    Expected: Prints `ok` and exits 0.
    Evidence: .sisyphus/evidence/task-5-vmlog-compat-error.txt
  ```

  **Commit**: NO | Message: `chore(vm-log): verify writer and queue contracts` | Files: `apps/frontend/src/features/vm-management/model/useVMLog.ts`, `apps/frontend/src/features/vm-management/model/vmLogWriters.ts`

- [x] 6. Remove/confirm removal of stale log-task sync in VMS page view model

  **What to do**: In `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`, remove any effect that syncs `log.tasks` to workspace store if present. If absent, keep file unchanged and capture explicit proof.
  **Must NOT do**: Do not remove queue sync effect (`setWorkspaceQueueItems(queue.queue)`); do not alter operation API bridge effect.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: narrow single-file cleanup/verification.
  - Skills: `[]` — deterministic grep-backed task.
  - Omitted: `["frontend-ui-ux"]` — no visual changes.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7 | Blocked By: -

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:60` — queue sync effect (must keep).
  - Pattern: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:157` — operation API bridge effect (must keep).
  - Requirement: remove log-task sync effect only, not unrelated orchestration effects.

  **Acceptance Criteria** (agent-executable only):
  - [ ] No `setWorkspaceLogTasks(` usage exists in `useVmsPageViewModel.ts`.
  - [ ] Queue sync and operation API sync effects still exist and typecheck.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path - stale log task sync absent
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/pages/vms/hooks/useVmsPageViewModel.ts','utf8');if(/setWorkspaceLogTasks\s*\(/.test(s)) throw new Error('stale sync found');console.log('ok')"
    Expected: Prints `ok` and exits 0.
    Evidence: .sisyphus/evidence/task-6-vmspage-sync.txt

  Scenario: Failure/edge case - required non-log effects retained
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const s=fs.readFileSync('src/pages/vms/hooks/useVmsPageViewModel.ts','utf8');if(!/setWorkspaceQueueItems\(queue\.queue\)/.test(s)) throw new Error('queue sync removed'); if(!/setWorkspaceLogOperationApi\(\{/.test(s)) throw new Error('operation api bridge removed'); console.log('ok')"
    Expected: Prints `ok` and exits 0.
    Evidence: .sisyphus/evidence/task-6-vmspage-sync-error.txt
  ```

  **Commit**: NO | Message: `chore(vms-page): remove stale log task sync bridge` | Files: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`

- [x] 7. Final compile/build + architecture anti-pattern gate

  **What to do**: Run final verification commands and static assertions for anti-pattern removal. Archive command outputs under `.sisyphus/evidence/`.
  **Must NOT do**: Do not treat passing compile alone as sufficient; include architecture assertions from this plan.

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: command-driven verification.
  - Skills: `[]` — no code writing.
  - Omitted: `["test"]` — no new test generation.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: Final Verification Wave | Blocked By: 1,2,3,4,5,6

  **References** (executor has NO interview context — be exhaustive):
  - Command source: `apps/frontend/package.json:10` (`typecheck`) and `apps/frontend/package.json:11` (`build`).
  - Guardrail source: `apps/frontend/src/features/vm-management/model/useVMLog.ts` anti-pattern checks.
  - Guardrail source: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts` `addLogEntry` checks.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --dir apps/frontend run typecheck` exits `0`.
  - [ ] `pnpm --dir apps/frontend run build` exits `0`.
  - [ ] Static assertions for `addLogEntry` presence, legacy append removal, and stale sync removal all pass.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```bash
  Scenario: Happy path - compile and build pass
    Tool: Bash
    Steps: pnpm --dir apps/frontend run typecheck && pnpm --dir apps/frontend run build
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/task-7-final-gate.txt

  Scenario: Failure/edge case - architecture assertions fail on regressions
    Tool: Bash
    Steps: pnpm --dir apps/frontend exec node -e "const fs=require('fs');const store=fs.readFileSync('src/widgets/vm-workspace/model/useVmWorkspaceStore.ts','utf8');const log=fs.readFileSync('src/features/vm-management/model/useVMLog.ts','utf8');const vm=fs.readFileSync('src/pages/vms/hooks/useVmsPageViewModel.ts','utf8');if(!/addLogEntry\s*:\s*\(entry/.test(store)) throw new Error('missing addLogEntry'); if(/\[\.\.\.getEntries\(\),\s*entry\]/.test(log)) throw new Error('legacy append remains'); if(/setWorkspaceLogTasks\s*\(/.test(vm)) throw new Error('stale sync present'); console.log('ok')"
    Expected: Prints `ok` and exits 0.
    Evidence: .sisyphus/evidence/task-7-final-gate-error.txt
  ```

  **Commit**: YES | Message: `refactor(vm-logs): migrate VM logs to pure zustand write flow` | Files: `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`, `apps/frontend/src/features/vm-management/model/useVMLog.ts`, `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts`, optional compatibility touch-ups

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Single commit after all tasks and verification pass.
- Suggested message: `refactor(vm-logs): route VM log writes through zustand actions`
- Include only touched frontend files in VM log/store/view-model scope.

## Success Criteria
- VM log business data ownership is Zustand-only for entries/tasks update paths.
- No stale task-sync bridge remains in VMS page hook for logs.
- UI log consumers continue reading from store without contract break.
- Type/build and static architecture assertions pass with evidence files generated.
