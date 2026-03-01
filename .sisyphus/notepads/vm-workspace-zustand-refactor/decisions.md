## 2026-02-28T20:54:40.212Z Task: bootstrap
- Verification mode: tests-after with `pnpm --filter @botmox/frontend typecheck` and build at key milestones.
- Migration strategy: phased strangler, no big-bang rewrite.

## 2026-02-28 Task 1: add Zustand + workspace scaffold
- Added `zustand` to `apps/frontend/package.json` dependencies as base state library for upcoming workspace decoupling tasks.
- Created `useVmWorkspaceStore.ts` with typed `layout`, `queue`, and `logs` slices only; no server-owned VM/target/settings collections.
- Exposed slice-focused selectors and action hooks to guide future panel wiring toward narrow subscriptions.

## 2026-03-01 Task 2: ownership map + selector contract
- Standardized ownership contract shape to `{ owner, readFrom, writeVia }` and exported it as `WorkspaceStateOwnership` from `useVmWorkspaceStore.ts`.
- Declared `targets`, `vms`, and `settings` as `react-query` owned plus `shortcuts` as `local`, leaving Zustand ownership limited to `layout`, `queue`, and `logs`.
- Consolidated hook selectors through `VmWorkspaceStoreSelectors` to keep subscriptions narrow and contract-aligned without changing behavior.

## 2026-03-01 Task 3: VMWorkspace shell conversion
- Replaced business-domain `VMWorkspaceProps` with shell-centric slot API and kept modal/top-panel control as shell-owned UI state exposed through render context.
- Kept business wiring in `VMsPage`/`useVmsPageViewModel` through explicit component prop groups (`statusBarProps`, `targetStripProps`, `vmListProps`, `queuePanelProps`, `operationLogProps`, `pageModalsProps`) to avoid temporary wrapper god-objects.
- Updated `useVmWorkspaceLayout` to read/write layout state via `useVmWorkspaceStore` selectors/actions (`layout` + `layoutActions`) as required by migration plan.

## 2026-03-01 Task 4: VMsPage bridge refactor
- Chose incremental split: keep `useVmsPageViewModel` as shared domain bridge but move only realtime refresh (`useRefreshOnVmMutationEvents`) and keyboard shortcuts (`useVMKeyboardShortcuts`) ownership to `VMsPage`.
- Removed aggregated panel prop-object return shape from `useVmsPageViewModel`; the hook now returns domain primitives/handlers consumed directly at render sites.
- Preserved migration guardrails: server state remains in existing query/domain hooks and no queue/log semantic changes were introduced.

## 2026-03-01 Task 5: VmTargetStrip autonomy
- Added local widget hook `useVmTargetStripModel` and moved target query/refetch + selection persistence into widget scope instead of `useVmsPageViewModel`.
- Retained refresh orchestration in view-model as `refreshAfterTargetChange` callback, so strip no longer receives business data props while downstream refresh chain remains compatible.
- Explicitly kept server target list in React Query and did not introduce target collections into Zustand.

## 2026-03-01 Task 6: VMListContainer autonomy
- Shifted VM list data ownership to widget scope by making `VMListContainer` call `useProxmox` directly and feed its own `vms/loading/connected/node/refreshVMs` into list controller/view.
- Removed VM list business prop drilling from `VMsPage` (`VMListContainer` now receives only optional `onRecreate`).
- Replaced page bridge exposure from full `proxmox` object to `proxmoxStatus` for target-strip SSH indicators, dropping obsolete VM-list-specific aggregation from `useVmsPageViewModel` public API.

## 2026-03-01 Task 7: VMOperationLog from Zustand logs slice
- Extended Zustand `logs` slice with `tasks` + `setTasks` and added `useVmWorkspaceLogTasks` selector hook so log task list consumption is store-owned per `WorkspaceStateOwnership.logs`.
- Removed `tasks` prop from `VMOperationLog` and from `VMsPage` render wiring to eliminate operation-log task prop drilling.
- Kept queue update semantics strict in cancel handler: only `task.key` with `vm:{queueItemId}` patches queue item to `{ status: 'error', error: 'Cancelled by user' }`; malformed/missing keys now append warning via log flow.

## 2026-03-01 Task 8: VMQueuePanel from Zustand queue slice
- Extended workspace `queue` slice with `items` and `setItems` action, and exposed `useVmWorkspaceQueueItems` selector for panel-level consumption.
- Applied explicit migration bridge in `useVmsPageViewModel` (`setWorkspaceQueueItems(queue.queue)`) so existing `useVMQueue` remains runtime source while UI ownership moves to Zustand.
- Removed `queue` prop from `VMQueuePanel` and from `VMsPage` queue-pane wiring to reduce prop drilling with no queue action contract changes.

## 2026-03-01 Task 9: consolidate SSE/realtime refresh ownership
- Chose `VMsPage` + `useRefreshOnVmMutationEvents` as the single retained owner for VM mutation terminal-event refresh orchestration.
- Removed duplicate VM mutation SSE subscription and local debounce timer from `useProxmox` to prevent parallel refresh ownership.
- Kept debounce contract at `VM_COMMAND_REFRESH_DEBOUNCE_MS = 500` so one terminal event still triggers one debounced refresh sequence (`refreshVMs` + storage/options sync chain).

## 2026-03-01 Task 10: final hardening and regression verification
- Deleted orphaned page-hook artifacts (`apps/frontend/src/pages/vms/hooks/useVmTargetSelection.ts`, `apps/frontend/src/pages/vms/hooks/useVmWorkspaceLayout.ts`) instead of preserving dormant compatibility wrappers.
- Kept `useVmsPageViewModel` as page bridge owner for cross-panel actions while preventing multi-level workspace business prop chains through `VMWorkspace` shell slots.
- Final verification decision: treat typecheck/build as mandatory completion gate for this task and record pass status in task notes.
