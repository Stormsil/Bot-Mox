# Task 1 Baseline: `useVMLog` Edge-Path Contract

Scope: current edge/failure behavior relevant to cancel/timeout/persistence parity.

## Edge path 1: malformed cancel link key (caller integration)

Source: `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts`.

- Cancel flow first checks task existence + `status === 'running'`; otherwise early return.
- It always calls `queue.cancelProcessing()` before attempting log-level task close.
- It calls `log.cancelTask(taskId, 'Task cancelled by user from Operation Console')`.
- If `log.cancelTask(...)` returns `false`, no queue item patch is applied.
- Queue patch guard semantics:
  - If `task.key` does not start with `vm:`, emit `log.warn("...has no queue link key; queue item patch skipped.")` and return.
  - If `task.key` starts with `vm:` but suffix is empty/whitespace, emit `log.warn("...has malformed queue link key; patch skipped.")` and return.
- Therefore malformed ids/keys do not crash and do not call `queue.updateQueueItem(...)`; behavior degrades to warning-only.

## Edge path 2: timeout auto-close of stale running tasks

Source: `apps/frontend/src/features/vm-management/model/useVMLog.ts` (`timeoutStaleRunningTasks`).

- Sweep executes immediately on mount and then every 15s.
- For each task, timeout check is delegated to `hasTaskTimedOut(task, now)`.
- For timed-out tasks:
  - Force status to `'error'`.
  - Set `finishedAt=now`.
  - Append error detail message:
    - `Task timed out after ${Math.trunc(RUNNING_TASK_TIMEOUT_MS / 60000)} minutes and was auto-stopped.`
- For non-timed-out tasks: no mutation.
- If no tasks changed, function returns without persistence call.
- If any changed, it commits full cloned array to refs/state and schedules persistence once.

## Edge path 3: persistence failure during flush

Source: `apps/frontend/src/features/vm-management/model/useVMLog.ts` (`flushLatestTasks`).

- On `apiPut('/api/v1/settings/vmgenerator/task_logs', snapshot.tasks)` error:
  - Emits `uiLogger.error('Failed to persist VM tasks:', error)`.
  - Resets `lastQueuedHashRef` to `lastPersistedHashRef` (drops optimistic queued-hash state).
  - Returns from flush loop immediately (does not continue writing further in same run).
- `finally` block still clears pending snapshot when seq matches current snapshot.
- `flushInFlightRef` is always cleared in outer `.finally(...)`.
- Contract implication:
  - Local refs/state mutations remain applied even when remote write fails.
  - The failed snapshot is not guaranteed to auto-retry unless a later state change enqueues a new snapshot.

## Related cancel edge semantics inside `useVMLog`

- `cancelTask(taskId, reason?)` is id-based (not key-based).
- Returns `false` for unknown `taskId` or non-running task; no mutation/persist on those paths.
- Reason normalization uses `String(reason || '').trim()` with default fallback message.

## Parity-sensitive notes for future refactor

- Keep ordering: cancel/timeout first mutate local task list, then enqueue persistence.
- Keep warning-only malformed queue-link behavior in operation-log action layer.
- Keep persistence-failure behavior non-throwing for UI callers (error is logged, hook API remains callable).
