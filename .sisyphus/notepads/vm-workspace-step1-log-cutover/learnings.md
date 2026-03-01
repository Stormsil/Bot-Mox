# 2026-03-01 Task 1 learnings

- `useVMLog` current contract is dual-owned locally (`useState` + `useRef`), with refs treated as mutation source and state as render mirror.
- Persistence is guarded by hydration for debounced writes, but `clear()` bypasses that guard through `persistTasksImmediately([])`.
- Timeout handling is proactive: one immediate sweep on mount plus 15s interval, and only persists when at least one task transitions.
- Cancel semantics are id-based in `useVMLog`; queue-link key validation/malformed handling lives in `useVmOperationLogActions` and degrades to warn-only.

- 2026-03-01: Zustand recommends a single global store, updates via set/setState, and colocated actions; use selectors for both data and actions to avoid broad subscriptions.
- 2026-03-01: React recommends removing mirrored/redundant state from effects; derive from source state during render when possible and keep effects for external synchronization only.
- 2026-03-01: Custom hooks should expose purpose-constrained APIs (inputs/actions/handlers) and keep implementation details hidden; this aligns with action-only hook contracts.
- 2026-03-01 Task 2: Task reads can be routed through `useVmWorkspaceStore.getState().logs.tasks` safely for mutation-time freshness while still exposing reactive `tasks` via store selector return value.
- 2026-03-01 Task 2: Preserving persistence semantics during ownership migration requires keeping write ordering unchanged: mutate task collection, then call `persistTasks`/`persistTasksImmediately` with the same array snapshot.
- 2026-03-01 Task 3: Entries ownership can follow the same split as tasks: reactive selector for render (`state.logs.entries`) and `getState()` reads for mutation-time append/full-log generation.
- 2026-03-01 Task 3: `getFullLog()` parity is preserved by keeping the formatter call unchanged (`formatFullLog(...)`) while switching only the source collection to store-owned entries.
- 2026-03-01 Task 3: Acceptance evidence paths corrected to required filenames (`task-3-zustand-entries.txt` and `task-3-zustand-entries-edge.txt`) without app-logic changes.
- 2026-03-01 Task 4: `useVMLog` can be action-only by removing reactive `entries`/`tasks` from its return while keeping all imperative reads/writes on `useVmWorkspaceStore.getState()` unchanged.
- 2026-03-01 Task 4: Direct sync effects from `log.tasks` to workspace store become redundant once logs are store-owned; callers should consume `useVmWorkspaceLogTasks()` selectors instead.
- 2026-03-01 Task 4 QA: Operation Console flow still works with action-only wiring when store selectors feed UI (`Copy` clipboard readback, `Cancel Task` status transition to `Cancelled`, `Clear` persists empty task list).
- 2026-03-01 Task 4 QA: On `/vms`, two visible `Clear` buttons exist; targeting `getByRole('button', { name: 'Clear' }).nth(1)` opens Operation Console history confirmation reliably in automation.
- 2026-03-01 Task 5: `useVmsPageViewModel.ts` already has no `setWorkspaceLogTasks` mirror effect; no code changes were required, and queue mirror effect (`setWorkspaceQueueItems(queue.queue)`) remains intact.
- 2026-03-01 Task 6 QA: For local verification without backend, `/vms` can be exercised reliably with Playwright by stubbing `/api/v1/**` and seeding `settings/vmgenerator/task_logs` with running tasks.
- 2026-03-01 Task 6 QA: Malformed queue-link cancellation parity is confirmed by preserving `Cancelled` status transition while avoiding runtime errors; warning-path behavior remains graceful.
- 2026-03-01 F2 review: Persist correctness depends on sequence-gated flushing (`pendingPersistSnapshotRef` + `lastCommittedSeqRef`), which safely coalesces rapid task updates without reordering final server state.
- 2026-03-01 F1 compliance audit: Step 1 stayed within guardrails by moving log state ownership to Zustand and removing only the page-level log mirror, with `task.key` passthrough and `/api/v1/settings/vmgenerator/task_logs` persistence path unchanged.
- 2026-03-01 F3 evidence completion: Final manual-QA artifact can be closed by consolidating already executed Task 4/Task 6 results into a self-contained pass/fail matrix and reusing the Task 6 screenshot, with no app-logic reruns or code edits.

- 2026-03-01 F3 QA: In `/vms` automation, `Copy` and `Clear` labels are duplicated between toolbar and modal/popconfirm, so scoped locators (dialog/popover context) are required for stable interaction checks.