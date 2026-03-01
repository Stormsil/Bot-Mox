# 2026-03-01 Task 1 decisions

- Baseline contract evidence is split into two artifacts:
  - `task-1-usevmlog-contract.md` for full public method and lifecycle invariants.
  - `task-1-usevmlog-contract-edge.md` for failure/edge branches required by the plan.
- Parity notes explicitly preserve current non-throwing persistence failure behavior (log + local state retained) to prevent accidental semantic hardening in future refactor.
- Edge documentation includes cross-file integration behavior where required (`useVmOperationLogActions` malformed queue-link branch), because plan QA explicitly names malformed cancel-id/key path.
- Task 2 task ownership migration is implemented only in `useVMLog.ts`; Zustand store schema/actions are reused as-is to avoid scope creep and keep downstream contracts stable.
- `useVMLog` keeps returning `tasks` from a store selector for render reactivity while routing all task mutations through `useVmWorkspaceStore.getState().logsActions.setTasks(...)`.
- Task 3 extends `VmWorkspaceLogsState` with `entries` and adds `logsActions.setEntries(...)` in the existing store to centralize log entry ownership instead of keeping a hook-local mirror.
- Task 3 keeps public `useVMLog` method signatures untouched and limits behavior changes to source-of-truth relocation (local entries state/ref -> Zustand logs.entries).
- Task 4 narrows `useVMLog` public API to actions only (`startTask`, `taskLog`, `finishTask`, writer helpers, `cancelTask`, `clear`, `getFullLog`) to enforce store-selector data access at call sites.
- Task 4 removes the `useVmsPageViewModel` relay effect that copied `log.tasks` into workspace logs; operation-log cancellation continues reading tasks through `useVmWorkspaceLogTasks()` in `useVmOperationLogActions`.
- Task 5 execution decision: keep `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts` unchanged because the page-level log mirror is already absent; produce verification/evidence only to avoid churn.
- Task 6 execution decision: keep verification scope strictly to compile/build gates and targeted `/vms` Operation Console behaviors (copy, clear confirm, cancel running, malformed key cancel path) with no queue/panel contract changes.
- Task 6 tooling decision: use Playwright fallback instead of `dev-browser` and capture evidence via deterministic API stubs plus screenshot artifact to preserve repeatability under backend-unavailable conditions.
- Scope-governance learning (F4): pairing `git diff --name-only` guards for queue/panel paths with spot checks of `task.key` and persistence constants in `useVMLog` catches scope creep early without widening Step 1 implementation surface.
