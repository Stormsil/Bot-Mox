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

## 2026-03-01 Acceptance block re-check: Task 1 criteria
- Verified `zustand` exists in `apps/frontend/package.json` dependencies.
- Verified `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts` exists and defines typed `layout`, `queue`, `logs` slices/actions.
- Verified no server-state collections are introduced into store runtime state (`targets`, `vms`, `settings` only appear in ownership metadata as react-query owned domains).
- Re-ran `pnpm --filter @botmox/frontend typecheck` and it passed.

## 2026-03-01 Acceptance block re-check: Task 2 criteria
- Verified `WorkspaceStateOwnership` is exported from `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`.
- Verified ownership map includes exactly the required keys: `layout`, `queue`, `logs`, `targets`, `vms`, `settings`, `shortcuts`.
- Verified each ownership key appears once with one `owner` entry (no dual-owner field in the artifact); `pnpm --filter @botmox/frontend typecheck` passed.

## 2026-03-01 Acceptance block re-check: Task 3 criteria
- Verified `VMWorkspaceProps` is layout-shell only (`renderStatusBar`, `targetStrip`, `servicePane`, `queuePane`, `logPane`, `renderModals`) in `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx`.
- Verified resize and modal toggle parity evidence via unchanged `useVmWorkspaceLayout` resize handlers + `panelOpen/setPanelOpen/openSettings` render-context wiring in `VMWorkspace`.
- Verified no nested panel business prop drilling from workspace: `VMsPage` passes composed panel nodes into `VMWorkspace`, and `VMWorkspace` renders slots without forwarding business objects.
- Re-ran `pnpm --filter @botmox/frontend typecheck` and it passed.

## 2026-03-01 Acceptance block re-check: Task 4 criteria
- Verified `VMsPage` mounts `VMWorkspace` directly and has no `workspaceProps` usage.
- Verified keyboard shortcut bindings remain mapped to `onStart/onStop/onReset/onAddVM/onCopyLog` and are registered once at page level.
- Verified no new hook exposes grouped panel-props objects (`workspaceProps`/`*PanelProps` patterns absent via grep).
- `useVmsPageViewModel` still contains broad orchestration responsibilities beyond a narrow bridge role; criterion left unchecked.

## 2026-03-01 Task 4 completion: narrow `useVmsPageViewModel` bridge
- Split responsibilities into `useVmWorkspaceController` (workspace business orchestration) and a slim `useVmsPageViewModel` hook that now returns only page-level bridge concerns (`shortcutActions` + VM mutation terminal event handler).
- `VMsPage` now wires panel/status/modal props from `useVmWorkspaceController`, while page-only side effects (`useRefreshOnVmMutationEvents`, `useVMKeyboardShortcuts`) consume the slim `useVmsPageViewModel` output.
- Verified behavior safety and type integrity on changed files with clean diagnostics and `pnpm --filter @botmox/frontend typecheck` passing.

## 2026-03-01 Acceptance block re-check: Task 5 criteria
- Verified panel-local target fetch: `useVmTargetStripModel` calls `useProxmoxTargetsQuery()` directly and `VmTargetStrip` consumes model output without parent target props (`apps/frontend/src/widgets/vm-workspace/ui/useVmTargetStripModel.ts:15`, `apps/frontend/src/widgets/vm-workspace/ui/VmTargetStrip.tsx:18`).
- Verified selected target resolution order is unchanged: in-memory `selectedTargetId` -> persisted `getSelectedProxmoxTargetId()` -> active target fallback (`apps/frontend/src/widgets/vm-workspace/ui/useVmTargetStripModel.ts:23`, `apps/frontend/src/widgets/vm-workspace/ui/useVmTargetStripModel.ts:30`, `apps/frontend/src/widgets/vm-workspace/ui/useVmTargetStripModel.ts:38`).
- Verified target change refresh chain is triggered once per change path: strip calls `onTargetChanged` once with sequence guard (`apps/frontend/src/widgets/vm-workspace/ui/useVmTargetStripModel.ts:67`), `VMsPage` wires exactly one handler (`apps/frontend/src/pages/vms/VMsPage.tsx:52`), and handler executes one call each for dependent refreshes (`apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:99`).

## 2026-03-01 Acceptance block re-check: Task 6 criteria
- Verified VM list data is local to panel: `VMListContainer` reads `useProxmox()` and passes `proxmox.vms/loading/connected/refreshVMs` to `VMListView` (`apps/frontend/src/widgets/vm/VMListContainer.tsx:14`, `apps/frontend/src/widgets/vm/VMListContainer.tsx:67`).
- Verified no parent VM-list data drilling: `VMsPage` mounts `VMListContainer` with only `onRecreate` (`apps/frontend/src/pages/vms/VMsPage.tsx:55`), and grep found no `VMListContainer` parent props for `vms/node/refreshVMs` or `workspaceProps/proxmoxPane` in `apps/frontend/src/**`.
- Verified node-sensitive actions remain correct after target changes: `useProxmox.refreshVMs` resolves node from selected target and updates local `node` (`apps/frontend/src/features/vm-management/model/useProxmox.ts:49`, `apps/frontend/src/features/vm-management/model/useProxmox.ts:51`), `useVmListController` mutations use injected `node` (`apps/frontend/src/widgets/vm/useVmListController.ts:29`, `apps/frontend/src/widgets/vm/useVmListController.ts:42`, `apps/frontend/src/widgets/vm/useVmListController.ts:75`), and `refreshAfterTargetChange` re-runs `proxmox.refreshVMs` on target switch (`apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:101`).
- Verified recreate/start/stop/rename wiring unchanged: `VMListContainer` still binds column actions to `handleStart/handleStop/openRenameModal/onRecreate` (`apps/frontend/src/widgets/vm/VMListContainer.tsx:38`, `apps/frontend/src/widgets/vm/VMListContainer.tsx:41`), and `VMsPage` still passes `handleRecreateVm` to list panel (`apps/frontend/src/pages/vms/VMsPage.tsx:55`).
- Verification gate: `pnpm --filter @botmox/frontend typecheck` passed.

## 2026-03-01 Acceptance block re-check: Task 7 criteria
- Verified tasks are consumed via store selector in log UI: `VMOperationLog` uses `useVmWorkspaceLogTasks()` (`apps/frontend/src/widgets/vm/VMOperationLog.tsx:27`).
- Verified clear path keeps success toast and clears task state via existing log port: `handleClear` awaits `onClear()` and shows success toast (`apps/frontend/src/widgets/vm/VMOperationLog.tsx:110`, `apps/frontend/src/widgets/vm/VMOperationLog.tsx:112`), and `log.clear` empties tasks (`apps/frontend/src/features/vm-management/model/useVMLog.ts:387`, `apps/frontend/src/features/vm-management/model/useVMLog.ts:389`).
- Verified cancel on running task sets status to `cancelled`: cancel handler delegates to `log.cancelTask` for running tasks (`apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts:74`, `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts:79`), and `cancelTask` closes task with `status='cancelled'` (`apps/frontend/src/features/vm-management/model/useVMLog.ts:343`).
- Verified queue patch contract for `vm:{id}` key: valid parsed key updates queue item to `{ status: 'error', error: 'Cancelled by user' }` (`apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts:85`, `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts:93`, `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts:102`).
- Verified malformed/missing key guard: non-matching/malformed keys emit `log.warn(...)` and return before queue mutation (`apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts:86`, `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts:95`, `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts:99`).
- Verified type gate: `pnpm --filter @botmox/frontend typecheck` passed.

## 2026-03-01 Acceptance block re-check: Task 8 criteria
- Queue data source is store-backed in panel: `VMQueuePanel` reads queue via `useVmWorkspaceQueueItems()` and has no `queue` prop in its prop contract (`apps/frontend/src/widgets/vm/VMQueuePanel.tsx:28`, `apps/frontend/src/widgets/vm/VMQueuePanel.tsx:61`); controller sync bridge writes queue state into workspace store (`apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:28`, `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:65`).
- `onAdd` path creates one pending item with generated id/name: page wires `onAdd` to `handleAddVM` (`apps/frontend/src/pages/vms/VMsPage.tsx:65`), which calls `addToQueue` without explicit name (`apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:130`); `addToQueue` generates fallback name and id, sets `status: 'pending'`, and appends one item (`apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:29`, `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:32`, `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:45`, `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:47`).
- `onRemove` removes by id and `onUpdate` patches only targeted item: `VMsPage` wires remove/update handlers (`apps/frontend/src/pages/vms/VMsPage.tsx:70`, `apps/frontend/src/pages/vms/VMsPage.tsx:71`); queue actions use id-based `filter` and id-guarded `map` preserving non-target entries (`apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:104`, `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:116`).
- Start action availability wiring is preserved: `canStartAll` still derives from `startableQueueItems.length > 0`, and start handlers remain `handleStartAllReady` / `handleStartOneReady` passed into panel unchanged (`apps/frontend/src/pages/vms/VMsPage.tsx:60`, `apps/frontend/src/pages/vms/VMsPage.tsx:68`, `apps/frontend/src/pages/vms/VMsPage.tsx:69`).
- Queue context remains internally consistent: context value/interface include matching queue/action fields and panel provides the value through `VMQueueContextProvider` around row/modal consumers (`apps/frontend/src/features/vm-queue/model/VMQueueContext.tsx:16`, `apps/frontend/src/features/vm-queue/model/VMQueueContext.tsx:28`, `apps/frontend/src/features/vm-queue/model/VMQueueContext.tsx:29`, `apps/frontend/src/widgets/vm/VMQueuePanel.tsx:70`, `apps/frontend/src/widgets/vm/VMQueuePanel.tsx:92`, `apps/frontend/src/widgets/vm/VMQueuePanel.tsx:114`).

## 2026-03-01 Acceptance block re-check: Task 7 criterion 6 closure
- Removed `VMsPage -> VMOperationLog` log callback drilling by mounting `VMOperationLog` without `onClear/onCancelTask/getFullLog` props (`apps/frontend/src/pages/vms/VMsPage.tsx:74`).
- Added a narrow workspace-store log operation bridge (`logs.operationApi`) so `VMOperationLog` reads `clear/cancelTask/getFullLog` internally via selector (`apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts:72`, `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts:277`, `apps/frontend/src/widgets/vm/VMOperationLog.tsx:22`).
- Wired bridge source from controller effect (`setWorkspaceLogOperationApi`) to preserve existing `useVMLog` + `useVmOperationLogActions` runtime semantics, including queue patch behavior for `vm:{id}` keys (`apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:154`, `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:161`).
- Verification gate: `pnpm --filter @botmox/frontend typecheck` passed.

## 2026-03-01 Acceptance block re-check: Task 9 criteria
- Verified `useProxmox` has no terminal mutation event subscription path; it only performs initial bootstrap and explicit refresh logic (`apps/frontend/src/features/vm-management/model/useProxmox.ts:75`, `apps/frontend/src/features/vm-management/model/useProxmox.ts:91`).
- Verified single bridge subscription ownership: `useRefreshOnVmMutationEvents` contains one `subscribeToVmOpsEvents(...)` call and is mounted once by `VMsPage` (`apps/frontend/src/entities/vm/api/useRefreshOnVmMutationEvents.ts:33`, `apps/frontend/src/pages/vms/VMsPage.tsx:21`).
- Verified debounce semantics: accepted terminal events schedule one timer and suppress duplicate triggers while timer exists; handler executes once per debounced window (`apps/frontend/src/entities/vm/api/useRefreshOnVmMutationEvents.ts:47`, `apps/frontend/src/entities/vm/api/useRefreshOnVmMutationEvents.ts:51`, `apps/frontend/src/entities/vm/api/useRefreshOnVmMutationEvents.ts:53`).
- Verified targeted refresh behavior remains wired after terminal events through `handleVmMutationTerminalEvent` (`refreshVMs`, `refreshStorageOptions`, `syncTemplateHardwareFromApi`) forwarded by page bridge (`apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:91`, `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:93`, `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:94`, `apps/frontend/src/pages/vms/VMsPage.tsx:18`, `apps/frontend/src/pages/vms/VMsPage.tsx:22`).
- Verification gate: `pnpm --filter @botmox/frontend typecheck` passed.

## 2026-03-01 Task 10 acceptance final evidence
- Confirmed no workspace business-state prop-drilling chain beyond one level.
- Final gates already collected as PASS: `pnpm --filter @botmox/frontend typecheck`, `pnpm --filter @botmox/frontend build`.
- Manual parity remains partially open: target-switching verification blocked by selector interaction timeout in automation.

## 2026-03-01 Task 10 manual parity closure: target switching on /vms
- Executed target switching verification on `/vms` with fallback strategy: role-based attempt -> CSS `.ant-select`/`.ant-select-selector` option selection -> keyboard fallback (successful path used CSS fallback).
- Before/after selected label evidence: `Target A (h1) (active)` -> `Target B (h2)`.
- Dependent update evidence after switch: VM refresh pipeline reacted to new target node (`list-vms` request nodes observed as `h1, h1, h2`), confirming target-coupled refresh trigger executed.
- Console errors captured during run: `1` (`Premium access is required for write operations` from resource-tree settings persistence side effect); target switching flow still completed.
- Final manual parity checkbox in plan updated to checked.
