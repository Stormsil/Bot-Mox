## 2026-02-28T20:54:40.212Z Task: bootstrap
- Plan selected and work session resumed.
- Initial direction: Zustand for client UI state only; server state remains in Query/domain hooks.

## 2026-02-28 Task 1: add Zustand + workspace scaffold
- `vm-workspace/model` currently had only local layout hook state; introducing a separate store file does not conflict with existing model exports.
- Narrow selector hooks per field/action keep panel integrations ready without whole-store subscriptions.
- Client-only slices (`layout`, `queue`, `logs`) can mirror existing UI behavior while avoiding backend entity duplication.

## 2026-03-01 Task 2: ownership map + selector contract
- Added explicit `WorkspaceStateOwnership` artifact with one owner per domain (`layout`, `queue`, `logs`, `targets`, `vms`, `settings`, `shortcuts`) to prevent dual-ownership drift during migration.
- Kept Task 1 runtime semantics intact by codifying ownership as metadata only and refactoring selector hooks to shared narrow selector functions.

## 2026-03-01 Task 3: VMWorkspace shell conversion
- `VMWorkspace` can be reduced to a layout shell safely by switching to slot/render-context props (`renderStatusBar`, `targetStrip`, `servicePane`, `queuePane`, `logPane`, `renderModals`) while preserving the same DOM structure/CSS classes.
- Moving split/log resize state to Zustand-backed selectors/actions inside `useVmWorkspaceLayout` keeps drag UX parity and localStorage persistence behavior without reintroducing page-level god-props.

## 2026-03-01 Task 4: VMsPage bridge refactor
- Keyboard shortcuts and VM mutation SSE refresh can be hoisted to `VMsPage` safely as single bridge side-effects, while business handlers stay sourced from `useVmsPageViewModel`.
- Flattening `useVmsPageViewModel` output to domain state/actions (instead of per-panel `*Props` groups) removes the panel-prop aggregation pattern without changing queue/log/delete/settings behavior.

## 2026-03-01 Task 5: VmTargetStrip autonomy
- `VmTargetStrip` can own target query + selection resolution safely by reusing `vmSelectionFacade` persistence and preserving priority order `state -> localStorage -> active target`.
- Keeping target-change race protection (`isCurrent` sequence guard) inside strip-local hook preserves existing refresh-chain semantics while removing target data prop drilling from `VMsPage`.
- SSH status rendering remains stable when only connectivity flags are passed in, so strip autonomy does not require moving server-owned status into Zustand.

## 2026-03-01 Task 6: VMListContainer autonomy
- `VMListContainer` can own `useProxmox` safely while preserving start/stop/rename behavior because list actions already depend on `node + refreshVMs` from the same source.
- VM recreate remains compatible with page-owned queue logic when only `onRecreate(vm)` is passed down; VM list server data no longer needs to flow through `VMsPage`.
- `useVmsPageViewModel` can expose a narrowed `proxmoxStatus` slice for target-strip UI while keeping queue/storage refresh orchestration on its existing proxmox instance.

## 2026-03-01 Task 7: VMOperationLog from Zustand logs slice
- `VMOperationLog` can safely read tasks from `useVmWorkspaceStore` (`logs.tasks`) without changing sorting, modal handling, copy behavior, or clear UX.
- A minimal explicit bridge effect in `useVmsPageViewModel` (`setWorkspaceLogTasks(log.tasks)`) keeps existing `useVMLog` runtime/persistence as source while migrating view consumption to Zustand ownership.
- Cancel queue-link coupling is safer when malformed/missing `task.key` cases emit `log.warn(...)` instead of silently skipping queue patching.

## 2026-03-01 Task 8: VMQueuePanel from Zustand queue slice
- `VMQueuePanel` can consume queue items directly from `useVmWorkspaceQueueItems()` while preserving existing `VMQueueContext` behavior because row rendering and panel-state hooks only require the queue array and existing action callbacks.
- Adding `queue.items` + `queueActions.setItems` to the workspace store enables explicit bridge synchronization without moving queue engine semantics out of `useVMQueue`.
- A narrow bridge effect in `useVmsPageViewModel` (`setWorkspaceQueueItems(queue.queue)`) removes queue-list prop drilling from `VMsPage` while keeping add/remove/update/start flows unchanged.

## 2026-03-01 Task 9: consolidate SSE/realtime refresh ownership
- Removing VM mutation SSE handling from `useProxmox` is behavior-safe when `VMsPage` mounts `useRefreshOnVmMutationEvents` and forwards to `handleVmMutationTerminalEvent`.
- Debounce parity is preserved by retaining a single 500ms debounce in `useRefreshOnVmMutationEvents`, which still coalesces burst terminal events into one refresh sequence.
- `useProxmox` remains responsible for initial connection/list bootstrap only (`checkConnections` + `refreshVMs` on mount), which keeps ownership boundaries explicit and deterministic.

## 2026-03-01 Task 10: final hardening and regression verification
- Removed unused pre-refactor hooks `useVmTargetSelection` and page-level `useVmWorkspaceLayout`; both had no remaining imports after panel autonomy + workspace-shell migration.
- Confirmed no residual `workspaceProps` chain remains and no `Page -> Workspace -> Panel -> Child` business prop-drilling path was reintroduced for workspace business state.
- Final frontend gates passed on current branch state: `pnpm --filter @botmox/frontend typecheck` and `pnpm --filter @botmox/frontend build`.
