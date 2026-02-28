# VM Workspace Global Refactor (Zustand + Decoupled Panels)

## TL;DR

> **Quick Summary**: Replace the current `useVmsPageViewModel` prop-drilling architecture with a Zustand-based client-state workspace model, while keeping all server state in React Query/domain APIs.
>
> **Deliverables**:
> - Zustand store for workspace client state (layout + queue UI + log UI)
> - `VMWorkspace` reduced to layout shell (no business god-props)
> - `VMsPage` no longer passes `workspaceProps`
> - Panels (`VmTargetStrip`, `VMListContainer`, `VMQueuePanel`, `VMOperationLog`) subscribe autonomously
> - `useVmsPageViewModel` removed or reduced to page-level realtime bridge only
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: Store foundation -> Workspace shell conversion -> Panel autonomy -> Cleanup + parity verification

---

## Context

### Original Request
Global VM workspace refactor to remove prop drilling/god-object and move to Zustand client state, with server state preserved in React Query.

### Interview Summary
**Key Discussions**:
- Existing `VMWorkspace` receives an oversized props contract and redistributes business data/actions to all panels.
- `useVmsPageViewModel` currently orchestrates queue/log/proxmox/settings/targets/shortcuts, creating high coupling.
- Refactor must preserve current UX and operational behavior (resizers, F5/F6, queue lifecycle).
- Verification strategy selected: **Tests-after** (no new frontend unit-test infra in this epic).

**Research Findings**:
- `zustand` is currently absent in `apps/frontend/package.json`.
- Frontend already supports strong verification gates (`typecheck`, `build`, Playwright e2e infra).
- Duplicate refresh subscription risk exists (`useProxmox` SSE + `useRefreshOnVmMutationEvents`).

### Metis Review
**Identified Gaps (addressed in plan)**:
- State ownership ambiguity -> Added explicit ownership guardrails and per-task boundaries.
- SSE duplication risk -> Added single-bridge consolidation task and acceptance checks.
- Queue/log coupling via implicit key parsing -> Added explicit validation and guardrails during migration.
- Scope creep risk -> Added strict exclusions (no server-state migration to Zustand, no UX changes).

---

## Work Objectives

### Core Objective
Refactor VM workspace architecture so each panel fetches/subscribes to only what it needs, eliminating cross-layer prop drilling and reducing unnecessary rerenders without changing user-facing behavior.

### Concrete Deliverables
- `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts` (new Zustand store)
- `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx` transformed into layout shell
- `apps/frontend/src/pages/vms/VMsPage.tsx` simplified to render workspace without aggregated props
- `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts` removed or reduced to realtime bridge role
- Panel-level autonomy implemented in:
  - `apps/frontend/src/widgets/vm-workspace/ui/VmTargetStrip.tsx`
  - `apps/frontend/src/widgets/vm/VMListContainer.tsx`
  - `apps/frontend/src/widgets/vm/VMOperationLog.tsx`
  - `apps/frontend/src/widgets/vm/VMQueuePanel.tsx`

### Definition of Done
- [x] `zustand` present in `apps/frontend/package.json`
- [x] `VMWorkspaceProps` removed or reduced to layout-only props
- [x] `VMsPage` no longer passes `workspaceProps`
- [x] Target/list/queue/log panels consume state/query directly
- [x] `useVmsPageViewModel` no longer aggregates all panel business data
- [x] `pnpm --filter @botmox/frontend typecheck` passes
- [x] `pnpm --filter @botmox/frontend build` passes

### Must Have
- Keep server state in React Query/domain data hooks.
- Keep queue execution behavior and keyboard shortcuts unchanged.
- Preserve current visual layout and interaction model.

### Must NOT Have (Guardrails)
- Do not store Proxmox VM inventory/targets/settings in Zustand.
- Do not introduce new UX features or redesign while refactoring.
- Do not keep dual ownership of the same state field in both Query and Zustand.
- Do not leave multi-level business prop drilling path (`Page -> Workspace -> Panel -> Child`) for VM workspace state.

### Migration Invariants (mandatory)
- **Ownership artifact** must exist in `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts` as exported typed map/constant (`WorkspaceStateOwnership`) with entries: field, owner, read path, write path.
- **Queue-log link contract** must remain explicit and validated:
  - Canonical mapping key: `vm:{queueItemId}`
  - On cancel from log: parse key -> if valid queue item exists, patch queue status/error
  - If key missing/malformed: cancel log task only, do not mutate queue, and emit warning log entry.
- **SSE owner singleton**: retain exactly one owner hook at page level (thin bridge), remove duplicate terminal-event subscription from `useProxmox`.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: Tests-after
- **Framework**: Existing checks + Playwright/manual QA (no new unit-test framework in this epic)

### Tests-after Execution Protocol

Each task completes with targeted verification. Final gate requires:

```bash
pnpm --filter @botmox/frontend typecheck
pnpm --filter @botmox/frontend build
```

### Manual QA Requirements (critical flows)

- **Frontend/UI parity checks**:
  - Start app and open `/vms`
  - Verify workspace split resize still works (left/right pane)
  - Verify log panel vertical resize still works
  - Verify settings modal and delete VM modal open/close behavior unchanged
- **Keyboard shortcuts**:
  - F5 (start queue), F6 (cancel), F7 (reset), Ctrl+N (add VM), Ctrl+L (copy log)
  - Confirm shortcuts are ignored while typing in inputs
- **Queue/log consistency**:
  - Add queue items, run operations, ensure statuses and operation log update as before
  - Cancel running task from operation log and confirm queue item state remains coherent
- **Target/list autonomy**:
  - Change target in strip, confirm VM list updates for selected target
  - Refresh targets and VMs from panel controls without parent prop mediation

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (foundation):
- Task 1: Add Zustand dependency + workspace store skeleton
- Task 2: Define ownership boundaries and selector contract

Wave 2 (shell + bridge):
- Task 3: Convert `VMWorkspace` to layout shell + layout store wiring
- Task 4: Slim `VMsPage` and reduce `useVmsPageViewModel` to bridge role

Wave 3 (panel autonomy):
- Task 5: Refactor `VmTargetStrip` autonomous query/store usage
- Task 6: Refactor `VMListContainer` autonomous VM data usage
- Task 7: Refactor `VMOperationLog` to direct store subscription
- Task 8: Refactor `VMQueuePanel` to direct store subscription

Wave 4 (hardening):
- Task 9: Consolidate SSE subscription ownership and remove duplication
- Task 10: Final regression pass + cleanups + dead code removal

Critical Path: 1 -> 3 -> 6/7/8 -> 10

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 3, 5, 6, 7, 8 | 2 |
| 2 | None | 3, 4, 5, 6, 7, 8, 9 | 1 |
| 3 | 1,2 | 4,10 | 9 |
| 4 | 2,3 | 10 | 9 |
| 5 | 1,2 | 10 | 6,7,8 |
| 6 | 1,2 | 10 | 5,7,8 |
| 7 | 1,2 | 10 | 5,6,8 |
| 8 | 1,2 | 10 | 5,6,7 |
| 9 | 2 | 10 | 3,4 |
| 10 | 3,4,5,6,7,8,9 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|--------------------|
| 1 | 1,2 | `delegate_task(category="quick", load_skills=["frontend-ui-ux"])` |
| 2 | 3,4 | `delegate_task(category="unspecified-high", load_skills=["frontend-ui-ux"])` |
| 3 | 5,6,7,8 | Parallel per panel via `delegate_task(category="unspecified-high", load_skills=["frontend-ui-ux"])` |
| 4 | 9,10 | `delegate_task(category="general", load_skills=["frontend-ui-ux"])` |

---

## TODOs

- [x] 1. Add Zustand and create workspace store scaffold

  **What to do**:
  - Ensure `zustand` dependency is present in frontend package.
  - Create `useVmWorkspaceStore.ts` with slices for `layout`, `queue`, `logs`.
  - Expose narrow selectors and explicit actions; avoid broad object selectors.

  **Must NOT do**:
  - Do not place server-fetched entities (VM list, targets, settings) in store.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded setup + typed store bootstrap.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: good fit for React state architecture and component coupling reduction.
  - **Skills Evaluated but Omitted**:
    - `git-master`: not required at implementation stage unless committing.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 3,5,6,7,8
  - **Blocked By**: None

  **References**:
  - `apps/frontend/package.json:17` - current dependency set; confirms `zustand` missing and where to add.
  - `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceLayout.ts:64` - existing layout state contract to map into `layout` slice.
  - `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:6` - queue state/actions currently local hook; informs migration into store-owned client state.
  - `apps/frontend/src/features/vm-management/model/useVMLog.ts:38` - log task model/actions currently hook-owned; informs store integration boundary.
  - `apps/frontend/src/entities/vm/api/useVmQueries.ts:8` - server query hooks to keep outside Zustand.

  **Acceptance Criteria**:
  - [ ] `zustand` present in `apps/frontend/package.json`
  - [ ] `useVmWorkspaceStore.ts` exists with typed slices/actions
  - [ ] No server state fields introduced in store
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes

  **Commit**: YES
  - Message: `refactor(vms): add zustand workspace store foundation`

- [x] 2. Create explicit state ownership map and selector contract

  **What to do**:
  - Add concrete ownership artifact in `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceStore.ts`:
    - export `WorkspaceStateOwnership` with keys for layout/queue/log/targets/vms/settings.
    - each key must define `{ owner: 'zustand' | 'react-query' | 'local', readFrom: string, writeVia: string }`.
  - Define selector usage rules for panels (one panel reads only required slice keys).
  - Lock guardrails: no dual ownership for same logical field.

  **Must NOT do**:
  - Do not introduce temporary duplicated state beyond migration-safe adapter fields.

  **Recommended Agent Profile**:
  - **Category**: `writing`
    - Reason: boundary definition and contracts.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: architecture readability and component-level boundaries.
  - **Skills Evaluated but Omitted**:
    - `openspec`: optional; not required for this repo workflow.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: 3,4,5,6,7,8,9
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:24` - central god-hook return shape that currently blends domains.
  - `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx:76` - oversized prop contract proving coupling source.
  - `apps/frontend/src/entities/vm/api/useVmQueries.ts:15` - target query ownership boundary.
  - `apps/frontend/src/features/vm-management/model/useProxmox.ts:27` - runtime server-data hook currently mixed with UI orchestration.

  **Acceptance Criteria**:
  - [ ] `WorkspaceStateOwnership` exported from `useVmWorkspaceStore.ts`
  - [ ] Entries exist for `layout`, `queue`, `logs`, `targets`, `vms`, `settings`, `shortcuts`
  - [ ] No field appears with two owners in the artifact

  **Commit**: NO

- [x] 3. Convert `VMWorkspace` into layout shell

  **What to do**:
  - Remove business-heavy `VMWorkspaceProps` sections (`status`, `targets`, `proxmoxPane`, `queuePanel`, `logPanel`, `deleteVm`).
  - Keep only layout/container responsibilities and minimal UI props if necessary.
  - Wire layout interactions (`panelOpen`, split ratio, log height) via store selectors/actions.

  **Must NOT do**:
  - Do not re-introduce business object props through alternate wrappers.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: high-impact structural UI refactor with many dependencies.
  - **Skills**: `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `artistry`: not needed; no visual redesign requested.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential
  - **Blocks**: 4,10
  - **Blocked By**: 1,2

  **References**:
  - `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx:76` - current god-props interface to dismantle.
  - `apps/frontend/src/widgets/vm-workspace/model/useVmWorkspaceLayout.ts:64` - layout behavior that must be preserved.
  - `apps/frontend/src/widgets/vm-workspace/ui/VMPageModals.tsx:8` - modal dependencies currently supplied via parent props.

  **Acceptance Criteria**:
  - [ ] `VMWorkspaceProps` is empty/minimal layout-only
  - [ ] Resizers and modal toggles still behave identically
  - [ ] No panel business data passed as nested props from workspace

  **Commit**: YES
  - Message: `refactor(vms): turn vmworkspace into pure layout shell`

- [x] 4. Refactor `VMsPage` and shrink/remove `useVmsPageViewModel`

  **What to do**:
  - Remove `workspaceProps` pass-through from `VMsPage`.
  - Delete `useVmsPageViewModel` if fully obsolete, or keep only page-level realtime bridge/SSE wiring.
  - Ensure keyboard shortcuts registration remains active exactly once.
  - Enforce responsibility split:
    - `VMsPage`: mount `VMWorkspace` + realtime bridge only.
    - Panels: fetch/query/store subscriptions locally.
    - Store: client UI state/actions only.

  **Must NOT do**:
  - Do not keep hidden aggregation logic in another monolithic hook.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`
  - **Skills Evaluated but Omitted**:
    - `beads`: unnecessary unless project explicitly tracks issues with Beads.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 9)
  - **Blocks**: 10
  - **Blocked By**: 2,3

  **References**:
  - `apps/frontend/src/pages/vms/VMsPage.tsx:5` - current direct god-props spread.
  - `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:199` - aggregated return object to remove.
  - `apps/frontend/src/features/vm-management/model/useVMKeyboardShortcuts.ts:11` - shortcut behavior to preserve when moving responsibilities.

  **Acceptance Criteria**:
  - [ ] `VMsPage` renders workspace without `workspaceProps`
  - [ ] `useVmsPageViewModel` removed or reduced to narrow bridge role
  - [ ] F5/F6/F7/Ctrl+N/Ctrl+L still function as before
  - [ ] No new hook returning aggregated panel props object

  **Commit**: YES
  - Message: `refactor(vms): remove vmpage god-viewmodel aggregation`

- [x] 5. Make `VmTargetStrip` autonomous

  **What to do**:
  - Move target fetching into panel (or panel-owned hook) using `useProxmoxTargetsQuery`.
  - Read/write selected target from store/local selection facade instead of parent props.
  - Keep refresh behavior and SSH status display parity.

  **Must NOT do**:
  - Do not fetch targets in page and pass through multiple levels.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 6,7,8)
  - **Blocks**: 10
  - **Blocked By**: 1,2

  **References**:
  - `apps/frontend/src/widgets/vm-workspace/ui/VmTargetStrip.tsx:10` - current prop-driven contract.
  - `apps/frontend/src/entities/vm/api/useVmQueries.ts:15` - direct target query hook.
  - `apps/frontend/src/entities/vm/api/vmSelectionFacade.ts:8` - persisted target id/node APIs.
  - `apps/frontend/src/pages/vms/hooks/useVmTargetSelection.ts:36` - current behavior for selection + refresh sequencing.

  **Acceptance Criteria**:
  - [ ] Panel fetches targets directly
  - [ ] Selected target resolution unchanged (state -> localStorage -> active fallback)
  - [ ] Changing target refreshes dependent data exactly once

  **Commit**: YES
  - Message: `refactor(vms): make target strip self-sufficient`

- [x] 6. Make `VMListContainer` autonomous for VM data

  **What to do**:
  - Move VM list data source closer to `VMListContainer` (direct hook/query usage).
  - Read selected target/node from store/facade.
  - Preserve list actions (`start/stop/rename/recreate`) behavior.

  **Must NOT do**:
  - Do not keep VM list coming from parent `proxmoxPane` prop object.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 10
  - **Blocked By**: 1,2

  **References**:
  - `apps/frontend/src/widgets/vm/VMListContainer.tsx:8` - current prop-driven inputs to remove.
  - `apps/frontend/src/features/vm-management/model/useProxmox.ts:51` - current VM refresh and node resolution logic.
  - `apps/frontend/src/widgets/vm/useVmListController.ts` - action controller dependency chain.

  **Acceptance Criteria**:
  - [ ] VM list panel obtains data without parent drilling
  - [ ] Node-sensitive operations remain correct after target changes
  - [ ] Recreate/start/stop/rename behavior unchanged

  **Commit**: YES
  - Message: `refactor(vms): localize vm list data access`

- [x] 7. Make `VMOperationLog` read from Zustand log slice

  **What to do**:
  - Replace `tasks/onClear/onCancelTask/getFullLog` parent props with store selectors/actions.
  - Keep sorting, modal, copy, and clear behavior identical.
  - Preserve queue-cancel integration semantics when canceling running task.

  **Must NOT do**:
  - Do not change task status semantics or task ordering behavior.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 10
  - **Blocked By**: 1,2

  **References**:
  - `apps/frontend/src/widgets/vm/VMOperationLog.tsx:16` - prop contract to remove.
  - `apps/frontend/src/features/vm-management/model/useVMLog.ts:247` - task lifecycle APIs to mirror/connect.
  - `apps/frontend/src/pages/vms/hooks/useVmOperationLogActions.ts:67` - cancel-flow coupling with queue state.

  **Acceptance Criteria**:
  - [ ] `VMOperationLog` consumes tasks via store selector
  - [ ] Clear action empties task list and success toast still shown
  - [ ] Cancel action on running task sets task status to `cancelled`
  - [ ] If `task.key` matches `vm:{id}`, corresponding queue item patched to `status=error` and `error="Cancelled by user"`
  - [ ] If `task.key` missing/malformed, queue is unchanged and warning is appended to operation log
  - [ ] No parent log prop drilling remains

  **Commit**: YES
  - Message: `refactor(vms): connect operation log directly to workspace store`

- [x] 8. Make `VMQueuePanel` read queue from Zustand

  **What to do**:
  - Replace parent-drilled queue/update/remove/add callbacks with store-backed accessors/actions.
  - Keep `VMQueueContext` for row-internal ergonomics if needed, but source data from workspace store.
  - Preserve queue UI modals/resources behavior.

  **Must NOT do**:
  - Do not break queue status progression or start action gating.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 10
  - **Blocked By**: 1,2

  **References**:
  - `apps/frontend/src/widgets/vm/VMQueuePanel.tsx:27` - prop contract to shrink/remove.
  - `apps/frontend/src/widgets/vm/useVMQueuePanelState.ts:43` - queue panel local state dependencies.
  - `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts:24` - queue mutation actions and process semantics.
  - `apps/frontend/src/features/vm-queue/model/VMQueueContext.tsx` - internal table context boundary.

  **Acceptance Criteria**:
  - [ ] Panel queue data comes from store, not parent props
  - [ ] `onAdd` creates one new pending queue item with generated id/name
  - [ ] `onRemove` removes exactly one item by id
  - [ ] `onUpdate` mutates only addressed item and preserves other items
  - [ ] `onStartAll` and `onStartOne` availability flags are unchanged versus pre-refactor behavior
  - [ ] Queue context remains internally consistent

  **Commit**: YES
  - Message: `refactor(vms): wire queue panel to zustand queue slice`

- [x] 9. Consolidate SSE/realtime refresh ownership

  **What to do**:
  - Keep one retained owner: page-level bridge hook (thin layer mounted by `VMsPage` or successor hook).
  - Remove duplicate subscription path from `apps/frontend/src/features/vm-management/model/useProxmox.ts`.
  - Route SSE effects to refresh/invalidation bridge without duplicate refresh storms.
  - Keep debounce behavior equivalent.

  **Must NOT do**:
  - Do not leave both `useProxmox` and page hook duplicating the same refresh trigger path.

  **Recommended Agent Profile**:
  - **Category**: `general`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: 10
  - **Blocked By**: 2

  **References**:
  - `apps/frontend/src/features/vm-management/model/useProxmox.ts:102` - embedded SSE subscription in proxmox hook.
  - `apps/frontend/src/entities/vm/api/useRefreshOnVmMutationEvents.ts:21` - second refresh subscription hook.
  - `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:89` - current integration point of refresh hook.

  **Acceptance Criteria**:
  - [ ] `useProxmox.ts` no longer subscribes to terminal mutation events
  - [ ] Exactly one subscription call remains in page-level bridge path
  - [ ] Triggering one terminal event produces one debounced refresh sequence
  - [ ] Targeted refresh behavior preserved after terminal events

  **Commit**: YES
  - Message: `refactor(vms): unify vm mutation event refresh bridge`

- [x] 10. Final hardening, dead code cleanup, and regression verification

  **What to do**:
  - Remove obsolete props/types/hooks left by migration.
  - Validate no residual prop drilling chain remains.
  - Run final checks and document parity evidence.

  **Must NOT do**:
  - Do not broaden scope into unrelated modules.

  **Recommended Agent Profile**:
  - **Category**: `general`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential finalization
  - **Blocks**: None
  - **Blocked By**: 3,4,5,6,7,8,9

  **References**:
  - `apps/frontend/src/pages/vms/VMsPage.tsx:1` - ensure no workspace prop spread remains.
  - `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx:1` - ensure shell-only responsibilities.
  - `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts:1` - ensure removed/slimmed and no god-object reintroduction.

  **Acceptance Criteria**:
  - [ ] No prop drilling chain for workspace business state beyond one level
  - [ ] `pnpm --filter @botmox/frontend typecheck` -> PASS
  - [ ] `pnpm --filter @botmox/frontend build` -> PASS
  - [ ] Manual parity checklist complete (resizers, shortcuts, queue/log, target switching)

  **Commit**: YES
  - Message: `refactor(vms): finalize workspace decoupling and parity checks`

---

## Commit Strategy

| After Task | Message | Verification |
|------------|---------|--------------|
| 1 | `refactor(vms): add zustand workspace store foundation` | `pnpm --filter @botmox/frontend typecheck` |
| 3 | `refactor(vms): turn vmworkspace into pure layout shell` | `pnpm --filter @botmox/frontend typecheck` |
| 4 | `refactor(vms): remove vmpage god-viewmodel aggregation` | manual shortcuts + typecheck |
| 5-8 (can batch) | `refactor(vms): decouple vm workspace panels from prop drilling` | typecheck + manual panel checks |
| 9-10 | `refactor(vms): stabilize realtime bridge and finalize cleanup` | typecheck + build + parity checklist |

---

## Success Criteria

### Verification Commands

```bash
pnpm --filter @botmox/frontend typecheck
pnpm --filter @botmox/frontend build
```

### Final Checklist
- [x] Zustand added and used for client UI state only
- [x] Server state remains in Query/domain hooks
- [x] `VMWorkspace` no longer acts as business-data hub
- [x] Panels fetch/subscribe autonomously
- [x] No duplicate SSE refresh subscriptions
- [x] UX parity preserved for resize, shortcuts, queue, and logs
