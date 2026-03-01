# Learnings

- `useVMLog.push` must write through `useVmWorkspaceStore.getState().logsActions.addLogEntry(entry)` to remove dual-state append path.
- Action-time reads in callbacks remain stable using `useVmWorkspaceStore.getState().logs.tasks`.
- `getFullLog` stays store-backed via `formatFullLog(useVmWorkspaceStore.getState().logs.entries)`.
- `useVmsPageViewModel` should keep queue sync and operation API bridge, while stale `setWorkspaceLogTasks(...)` sync must remain absent.
