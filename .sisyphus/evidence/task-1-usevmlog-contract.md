# Task 1 Baseline: `useVMLog` Behavioral Contract

Scope: current behavior in `apps/frontend/src/features/vm-management/model/useVMLog.ts` (no refactor applied).

## State ownership and lifecycle invariants

- Source of truth is local hook state + refs:
  - `entries` + `entriesRef` for operation-console log entries.
  - `tasks` + `tasksRef` for task timeline/cards.
- Refs are mutation-first; React state mirrors refs for rendering (`setEntries`, `setTasks`).
- Persistence is debounce-based (`LOG_PERSIST_DEBOUNCE_MS=250`) with serialized-hash dedupe and sequence ordering.
- Running-task timeout sweep runs on mount + every `RUNNING_TASK_SWEEP_INTERVAL_MS=15000`.
- Hydration gate:
  - No debounced persistence until `hydratedRef.current === true`.
  - Hydration success applies server tasks, seeds persisted/queued hashes, then marks hydrated.
  - Hydration error logs and still marks hydrated (allows future writes).

## Persistence ordering and guards

- `enqueuePersistSnapshot(nextTasks)`:
  - Serializes tasks and no-ops when identical to either last persisted hash or last queued hash.
  - Otherwise increments monotonic `seq`, updates queued hash, and replaces pending snapshot.
- `persistTasks(nextTasks)`:
  - Returns early when not hydrated.
  - Enqueues snapshot and starts/restarts debounce timer.
  - Timer callback clears timer ref and calls `flushLatestTasks()`.
- `flushLatestTasks()`:
  - Single-flight guarded by `flushInFlightRef`; concurrent callers await active flush.
  - While pending snapshot exists:
    - If snapshot hash already persisted: clear pending (when same seq), sync queued hash, advance committed seq.
    - Else `apiPut('/api/v1/settings/vmgenerator/task_logs', snapshot.tasks)`.
  - On success: updates `lastPersistedHashRef` and committed seq.
  - On failure: logs error, rolls queued hash back to persisted hash, exits loop.
  - Finalizer clears `flushInFlightRef`.
  - Tail-recurses once more if a newer pending seq appeared after the run.
- `persistTasksImmediately(nextTasks)`:
  - Enqueues snapshot even if not hydrated, cancels debounce timer, then awaits immediate flush.

## Public action contract invariants

### `startTask(taskKey, description, meta?)`

- Finds by `task.key`.
- If existing:
  - Resets task to fresh running lifecycle (`status='running'`, `finishedAt=undefined`, `details=[]`, `startedAt=now`).
  - Updates `description` and metadata with fallback semantics:
    - `node`: `meta.node || existing.node || '-'`
    - `userName`: `meta.userName || existing.userName || '-'`
    - `vmName`: `meta.vmName || existing.vmName`
- If missing:
  - Appends new task with generated `id`, given `key`, running status, empty details.
  - Defaults `node` and `userName` to `'-'` when absent.
- Always mirrors into state + schedules persistence through `persistTasks`.

### `taskLog(taskKey, message, level='info')`

- No-op if task with `taskKey` is missing.
- Otherwise appends a detail row (`id`, `timestamp=Date.now()`, `level`, `message`) to that task.
- Uses `updateTask` path, which clones tasks array and schedules persistence.

### `finishTask(taskKey, status, summary?)`

- No-op if task missing (via `updateTask`).
- If task is not `running`, leaves task unchanged (idempotent for closed tasks).
- If task is `running`:
  - Sets `status` and `finishedAt=now`.
  - Appends summary detail only when `summary` is truthy.
  - Summary detail level is derived by `taskLevelFromStatus(status)`.
- Changes persist through `updateTask`/`persistTasks`.

### `cancelTask(taskId, reason?) => boolean`

- Trims reason; default summary text: `Task cancelled by user from Operation Console`.
- Delegates to `closeRunningTaskById(taskId, 'cancelled', summary, 'warn')`.
- Returns `true` only when:
  - Task with matching `id` exists, and
  - Current status is exactly `running`.
- Successful cancel sets `finishedAt=now`, status to `cancelled`, appends warn-level summary detail, and persists.
- Returns `false` for unknown id or already-closed task.

### `clear() => Promise<void>`

- Clears both refs and state arrays (`entries=[]`, `tasks=[]`).
- Forces hydration gate open (`hydratedRef.current=true`).
- Calls `persistTasksImmediately([])` and awaits completion.
- Net effect: local UI clear + immediate remote task history clear attempt.

### `getFullLog() => string`

- Returns `formatFullLog(entriesRef.current)`.
- Export content is sourced from ref (latest mutation state), not directly from React state variable.

## Additional exposed API behaviors

- Writer helpers (`info`, `warn`, `error`, `debug`, `step`, `table`, `diffTable`) append only to `entries` via `push`.
- Hook currently returns both data and actions: `{ entries, tasks, ...actions }`.

## Hydration contract notes

- `useQuery` loads persisted task history (`refetchInterval=4000`, `retry=false`).
- On new hydrated payload:
  - Applies payload unless already hydrated with identical serialized content.
  - Updates refs/state and both persisted/queued hashes.
- On load error:
  - Emits `uiLogger.error('Failed to load VM task history:', error)`.
  - Marks hydrated to avoid permanent write lock.

## Cleanup/interval invariants

- Unmount cleanup clears pending debounce timer.
- Separate effect manages timeout interval and clears it on unmount.
