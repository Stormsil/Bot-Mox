## 2026-02-28T20:54:40.212Z Task: bootstrap
- Known risk: duplicate SSE subscriptions in proxmox hooks vs page refresh hook.
- Known risk: queue/log coupling currently relies on `task.key` format.

## 2026-02-28 Task 1: add Zustand + workspace scaffold
- No new blockers found for scaffold step.
- Existing known risks (duplicate SSE subscriptions and queue/log coupling by `task.key`) remain unchanged and intentionally untouched in this task.

## 2026-03-01 Task 2: ownership map + selector contract
- No new blockers introduced.
- Existing risks still active and unchanged: duplicate SSE subscriptions and queue/log coupling by `task.key`.

## 2026-03-01 Task 3: VMWorkspace shell conversion
- No new blockers introduced in shell/layout step.
- Existing known risks remain unchanged and intentionally out of scope for this task: duplicate SSE subscriptions and queue/log coupling by `task.key`.

## 2026-03-01 Task 4: VMsPage bridge refactor
- No new blockers introduced.
- Existing known risks remain active and unchanged: duplicate SSE subscriptions (not fully eliminated yet, only page-level refresh bridge ownership clarified) and queue/log coupling by `task.key`.

## 2026-03-01 Task 5: VmTargetStrip autonomy
- No new blockers introduced.
- Existing known risks remain active and unchanged: duplicate SSE subscriptions cleanup pending and queue/log coupling by `task.key`.

## 2026-03-01 Task 6: VMListContainer autonomy
- No new blockers introduced during VM list ownership shift.
- Existing known risks remain active and intentionally untouched: duplicate SSE subscription ownership cleanup pending and queue/log coupling by `task.key`.

## 2026-03-01 Task 7: VMOperationLog from Zustand logs slice
- No new blockers introduced while removing `VMOperationLog` task prop drilling.
- Queue/log coupling via `task.key` remains an active risk by design; this step adds explicit warning logging on malformed/missing keys to improve observability but does not remove the coupling.

## 2026-03-01 Task 8: VMQueuePanel from Zustand queue slice
- No new blockers introduced while removing queue-list prop drilling into `VMQueuePanel`.
- Existing risks remain unchanged and intentionally untouched: duplicate SSE subscription ownership cleanup pending and queue/log coupling by `task.key`.

## 2026-03-01 Task 9: consolidate SSE/realtime refresh ownership
- Duplicate SSE ownership risk resolved for VM mutation refresh path by removing the redundant `useProxmox` subscription.
- No new blockers introduced.
- Remaining known risk (unchanged): queue/log coupling by `task.key`.

## 2026-03-01 Task 10: final hardening and regression verification
- No new blockers introduced during dead-code cleanup and final gates.
- Remaining known risk intentionally unchanged: queue/log coupling via `task.key`.

## 2026-03-01 Acceptance block re-check: Task 1 criteria
- No new blockers found while verifying the first unchecked acceptance block.
- Remaining known risk unchanged and out of scope for this acceptance step: queue/log coupling via `task.key`.

## 2026-03-01 Acceptance block re-check: Task 4 criteria
- Blocker: `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts` is still a wide orchestration hook (queue/log/proxmox/settings/storage/start actions/delete workflow), so the criterion "removed or reduced to narrow bridge role" is not yet met.

## 2026-03-01 Acceptance block re-check: Task 7 criteria
- Blocker: parent log prop drilling remains. `VMOperationLog` still requires parent callbacks (`onClear`, `onCancelTask`, `getFullLog`) (`apps/frontend/src/widgets/vm/VMOperationLog.tsx:17`), and `VMsPage` still injects them from controller/log ports (`apps/frontend/src/pages/vms/VMsPage.tsx:76`, `apps/frontend/src/pages/vms/VMsPage.tsx:77`, `apps/frontend/src/pages/vms/VMsPage.tsx:78`).

## 2026-03-01 Task 10 acceptance finalization blocker
- Target-switching manual parity verification could not be completed due selector interaction timeout in automation.
