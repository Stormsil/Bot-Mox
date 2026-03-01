# Epic Plan: Refine Integration Phase 2 - Aggressive Boilerplate Eradication

## TL;DR

> **Quick Summary**: Refactor licenses/proxies/subscriptions CRUD pages to fully delegate modal/form/table/action behavior to Refine primitives (`useModalForm`, `useTable`, `EditButton`, `DeleteButton`) and delete legacy imperative wrappers.
>
> **Deliverables**:
> - Standardized modal contracts (`modalProps` + `formProps`) for CRUD modals.
> - Removal of manual modal/loading/create/edit/delete boilerplate in target pages.
> - Table action columns migrated to Refine buttons.
> - Elimination of useTable/useList data mixing for table rendering.
> - Route ownership cleanup in `App.tsx` for licenses/proxies/subscriptions.
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Baseline tests -> modal/action refactor -> data-flow cleanup -> route cleanup -> regression

---

## Context

### Original Request
Aggressively remove leftover manual CRUD boilerplate after partial Refine integration. Do not wrap old code: delete it and hand control to Refine.

### Interview Summary
**Key Discussions**:
- Non-negotiable rule: no wrapper-style compatibility layer around old state/handlers.
- Scope includes licenses/proxies/subscriptions pages, related modals and columns, plus app routing cleanup.
- Anti-patterns explicitly forbidden: manual modal submit `try/catch`, manual modal visibility booleans, manual `useCreate`/`useUpdate` for standard forms.
- Test strategy selected: **TDD**.

**Research Findings**:
- Target files confirmed:
  - `apps/frontend/src/pages/licenses/index.tsx`
  - `apps/frontend/src/pages/licenses/page/LicenseModals.tsx`
  - `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx`
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
  - `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx`
  - `apps/frontend/src/pages/proxies/proxyColumns.tsx`
  - `apps/frontend/src/pages/subscriptions/index.tsx`
  - `apps/frontend/src/pages/subscriptions/subscription-columns.tsx`
  - `apps/frontend/src/App.tsx`
- Current anti-pattern coverage:
  - Manual create/edit/delete handlers still present.
  - Manual modal/loading state still present (especially licenses, proxies).
  - Table data mixed across `useTable` and `useList` in all three pages.
  - Action columns not consistently using Refine `EditButton`/`DeleteButton`.
  - Duplicate resource/path handling exists in `App.tsx` via both resources and hardcoded routes.

### Metis Review
**Identified Gaps (addressed in this plan)**:
- Missing explicit behavior-preservation baseline -> added pre-refactor regression matrix task.
- Risk of hidden side effects when deleting handlers -> added reference mapping and `lsp_find_references` requirement.
- Scope creep risk (UI redesign, schema shifts) -> added strict must-not-have list.
- Insufficient acceptance detail for request-count behavior -> added concrete anti-double-fetch checks.

---

## Work Objectives

### Core Objective
Remove imperative CRUD boilerplate and standardize to Refine-native declarative patterns for the three resource pages while preserving user-visible behavior.

### Concrete Deliverables
- Licenses/proxies/subscriptions pages without manual submitting/loading/modal state for standard CRUD forms.
- Modal components for licenses/proxies using `{ modalProps, formProps }` contract.
- Columns using `EditButton` and `DeleteButton` from `@refinedev/antd` for standard edit/delete actions.
- Table content sourced strictly from `useTable` query result; optional `useList` retained only for independent aggregate stats.
- `App.tsx` cleaned so Refine resources own these CRUD routes without redundant hardcoded duplicates.

### Definition of Done
- [x] No manual CRUD submitting/loading/modal visibility state remains in:
  - `apps/frontend/src/pages/licenses/index.tsx`
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
  - `apps/frontend/src/pages/subscriptions/index.tsx`
- [x] No manual `handleCreate`, `handleEdit`, `handleDelete` style flow remains for standard CRUD operations in those pages.
- [x] Column action files use Refine buttons for standard edit/delete:
  - `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx`
  - `apps/frontend/src/pages/proxies/proxyColumns.tsx`
  - `apps/frontend/src/pages/subscriptions/subscription-columns.tsx`
- [x] Modal contract standardized (`modalProps`, `formProps`) in modal components used by licenses/proxies CRUD.
- [ ] `pnpm run check:all:mono` passes.
- [x] `pnpm run test:e2e` passes.

### Must Have
- Delete old imperative code instead of wrapping it.
- Keep behavior parity for create/edit/delete success and error UX.
- Use Refine mutation lifecycle (`useModalForm`) for standard CRUD forms.

### Must NOT Have (Guardrails)
- No manual `try/catch` wrapper around `modalProps.onOk()` or `form.submit()`.
- No new `isModalVisible`-style local modal state for standard CRUD forms.
- No new manual `useCreate`/`useUpdate` flow for standard CRUD forms.
- No table rendering from combined/mixed `useTable` + `useList` datasets.
- No visual redesign or unrelated column/schema/API contract changes.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: TDD
- **Framework**: Existing repo test stack + Playwright E2E

### TDD Strategy for This Epic

For each resource slice (licenses, proxies, subscriptions):

1. **RED**
   - Create or adjust targeted regression E2E for CRUD workflow currently expected.
   - Explicitly include table render source expectations and modal action behavior.
   - Run: `pnpm run test:e2e` (or focused project/spec command already used in repo).
   - Expected: fail on assertions tied to refactor delta before implementation.

2. **GREEN**
   - Implement refactor with Refine-native primitives.
   - Run focused E2E and relevant checks until pass.

3. **REFACTOR**
   - Remove remaining dead/legacy glue.
   - Run full verification:
     - `pnpm run check:all:mono`
     - `pnpm run test:e2e`

### Manual Execution Verification (required alongside tests)
- Browser validation for each resource list page:
  - open list,
  - trigger create modal,
  - save valid payload,
  - edit existing row,
  - delete existing row,
  - verify success/error notifications and table refresh behavior.
- Network verification in browser devtools:
  - table requests originate from `useTable` flow,
  - no duplicate list requests for same table dataset from mixed hooks.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (start immediately):
- Task 1: baseline behavior and reference map
- Task 2: licenses modal + action standardization
- Task 3: proxies modal + action standardization

Wave 2 (after Wave 1):
- Task 4: subscriptions action and modal-flow standardization
- Task 5: table data-source de-mixing and double-fetch cleanup (all pages)

Wave 3 (after Wave 2):
- Task 6: `App.tsx` routing ownership cleanup
- Task 7: full regression, dead code sweep, final verification

Critical path: Task 1 -> Task 5 -> Task 6 -> Task 7

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 5, 7 | 2, 3 |
| 2 | None | 5 | 1, 3 |
| 3 | None | 5 | 1, 2 |
| 4 | 1 | 5 | None |
| 5 | 1,2,3,4 | 6,7 | None |
| 6 | 5 | 7 | None |
| 7 | 6 | None | None |

---

## TODOs

- [x] 1. Baseline parity matrix and deletion map

  **What to do**:
  - Inventory all manual CRUD handlers/states in scoped files.
  - Map each handler/state to its Refine replacement (`show`, `modalProps`, `formProps`, `EditButton`, `DeleteButton`, table query source).
  - Add/adjust RED tests for parity-critical flows before touching implementation.

  **Must NOT do**:
  - Do not start implementation before parity criteria are documented.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: multi-file behavioral mapping with risk control.
  - **Skills**: `openspec`, `beads`
    - `openspec`: formalizes acceptance and change scope.
    - `beads`: tracks cross-file dependencies and sequence.
  - **Skills Evaluated but Omitted**:
    - `sin-bot-profiles`: unrelated domain.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 5, 7
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/pages/licenses/index.tsx` - primary source of manual create/edit/loading/state anti-patterns.
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx` - proxy-specific manual handlers and mixed fetch flow.
  - `apps/frontend/src/pages/subscriptions/index.tsx` - subscription CRUD flow and inline modal handling.
  - `apps/frontend/src/App.tsx` - route/resource ownership checks.

  **Acceptance Criteria**:
  - [ ] Manual handler/state inventory exists for all scoped files.
  - [ ] RED tests/assertions created for CRUD parity and duplicate-fetch risk.


- [x] 2. Licenses: modal contract + action refactor

  **What to do**:
  - Refactor licenses modal usage to `useModalForm` contract only.
  - Update modal component API in `LicenseModals.tsx` to accept only `{ modalProps, formProps }` for standard editor flow.
  - Remove manual submitting/modal/try-catch glue from `licenses/index.tsx`.
  - Ensure actions use Refine buttons for standard edit/delete flows.

  **Must NOT do**:
  - Do not keep compatibility props (`open`, `submitting`, `onSave`) for standard editor modal.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: UI modal/table integration with framework hooks.
  - **Skills**: `openspec`
    - `openspec`: keeps implementation aligned to contract-driven scope.
  - **Skills Evaluated but Omitted**:
    - `beads`: optional for tracking, not required for single-resource slice.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 3)
  - **Blocks**: 5
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/pages/licenses/index.tsx` - remove manual state/handlers and wire modal forms to hook outputs.
  - `apps/frontend/src/pages/licenses/page/LicenseModals.tsx` - enforce modal/form prop contract.
  - `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx` - standardize edit/delete action components.

  **Acceptance Criteria**:
  - [ ] No manual `createSubmitting`/`editSubmitting`/equivalent for standard CRUD.
  - [ ] Standard editor modal uses only `modalProps` and `formProps` contract.
  - [ ] Standard edit/delete actions use Refine buttons.


- [x] 3. Proxies: modal contract + action refactor

  **What to do**:
  - Refactor `ProxyCrudModal.tsx` to consume `modalProps` + `formProps` for standard create/edit.
  - Remove manual submit and manual visibility orchestration for standard CRUD in `ProxiesPage.tsx`.
  - Replace manual edit/delete action flow with Refine buttons where applicable.

  **Must NOT do**:
  - Do not preserve dual open-state props (`createOpen`, `editOpen`) for standard CRUD modal path.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: heavy modal/form integration changes in page and column actions.
  - **Skills**: `openspec`
    - `openspec`: keeps anti-pattern exclusions explicit.
  - **Skills Evaluated but Omitted**:
    - `beads`: optional but not mandatory for this isolated slice.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 5
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx` - remove manual CRUD control flow.
  - `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx` - convert to standardized modal contract.
  - `apps/frontend/src/pages/proxies/proxyColumns.tsx` - migrate edit/delete actions to Refine components.

  **Acceptance Criteria**:
  - [ ] No manual create/edit submitting state remains for standard CRUD modal flow.
  - [ ] Proxy CRUD modal contract is standardized to `modalProps` + `formProps`.
  - [ ] Standard edit/delete actions are Refine-native.


- [x] 4. Subscriptions: declarative CRUD action cleanup

  **What to do**:
  - Keep/expand `useModalForm`-driven modal flow and remove remaining manual create/edit/delete imperative handlers.
  - Standardize action column to Refine buttons for standard edit/delete.
  - Ensure no manual submit wrappers remain in page-level modal flow.

  **Must NOT do**:
  - Do not leave manual `handleCreateSubscription` / `handleEditSubscription` / `handleDelete` for standard CRUD.

  **Recommended Agent Profile**:
  - **Category**: `visual-engineering`
    - Reason: page-level modal/action cleanup with minimal structural disruption.
  - **Skills**: `openspec`
    - `openspec`: preserve scope and anti-pattern boundaries.
  - **Skills Evaluated but Omitted**:
    - `beads`: not essential for single file + column pair.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 5
  - **Blocked By**: 1

  **References**:
  - `apps/frontend/src/pages/subscriptions/index.tsx` - remove residual imperative CRUD logic.
  - `apps/frontend/src/pages/subscriptions/subscription-columns.tsx` - adopt Refine action buttons.

  **Acceptance Criteria**:
  - [ ] No manual standard CRUD handlers remain.
  - [ ] Subscriptions table actions use Refine edit/delete buttons.


- [x] 5. Eliminate table double-fetch and data mixing

  **What to do**:
  - Enforce one table data path: table rows come only from `useTable` query result in each page.
  - Keep `useList` only where required for independent aggregate statistics/cards.
  - Remove any interface-level data blending between full-list hook and table hook.

  **Must NOT do**:
  - Do not compute table rows from `useList` while also using `useTable` for same resource list.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: cross-resource data-flow normalization with performance impact.
  - **Skills**: `openspec`, `beads`
    - `openspec`: codifies consistency constraints.
    - `beads`: tracks cross-page dependency closure.
  - **Skills Evaluated but Omitted**:
    - `sin-bot-profiles`: unrelated.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 2
  - **Blocks**: 6, 7
  - **Blocked By**: 1, 2, 3, 4

  **References**:
  - `apps/frontend/src/pages/licenses/index.tsx` - mixed hooks currently present; split table vs stats responsibilities.
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx` - same double-fetch pattern to normalize.
  - `apps/frontend/src/pages/subscriptions/index.tsx` - same pattern to normalize.

  **Acceptance Criteria**:
  - [ ] In each page, table rows derive only from `useTable` result.
  - [ ] Any `useList` retained is isolated to aggregate cards/statistics.
  - [ ] No duplicate table-dataset fetching pattern remains.


- [x] 6. Route ownership cleanup in App

  **What to do**:
  - Remove redundant hardcoded CRUD list routes for licenses/proxies/subscriptions when resources already define ownership.
  - Keep navigation behavior valid through Refine resource routing and shell layout.

  **Must NOT do**:
  - Do not remove unrelated routes.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: targeted routing cleanup in one app file after data-flow changes settle.
  - **Skills**: `openspec`
    - `openspec`: prevents overreach outside agreed route scope.
  - **Skills Evaluated but Omitted**:
    - `beads`: unnecessary for narrow single-file step.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: 7
  - **Blocked By**: 5

  **References**:
  - `apps/frontend/src/App.tsx` - source of current route/resource duplication for targeted resources.

  **Acceptance Criteria**:
  - [ ] No redundant hardcoded route definitions remain for licenses/proxies/subscriptions list ownership.
  - [ ] Navigation for those resources remains functional via Refine resources.


- [x] 7. Final regression, anti-pattern sweep, and sign-off

  **What to do**:
  - Run static/manual pattern sweep for forbidden leftovers.
  - Execute full verification suite.
  - Confirm DoD and line-count reduction intent (substantial simplification, target >=2x reduction in CRUD page imperative boilerplate sections).

  **Must NOT do**:
  - Do not close task without passing both verification commands.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: final integration confidence gate across all touched files.
  - **Skills**: `openspec`, `beads`
    - `openspec`: validate acceptance rigor.
    - `beads`: ensure no task/dependency residue remains.
  - **Skills Evaluated but Omitted**:
    - `sin-bot-profiles`: unrelated.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 final gate
  - **Blocks**: None
  - **Blocked By**: 1, 5, 6

  **References**:
  - `apps/frontend/src/pages/licenses/index.tsx`
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
  - `apps/frontend/src/pages/subscriptions/index.tsx`
  - `apps/frontend/src/pages/licenses/page/LicenseModals.tsx`
  - `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx`
  - `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx`
  - `apps/frontend/src/pages/proxies/proxyColumns.tsx`
  - `apps/frontend/src/pages/subscriptions/subscription-columns.tsx`
  - `apps/frontend/src/App.tsx`

  **Acceptance Criteria**:
  - [ ] `pnpm run check:all:mono` passes.
  - [ ] `pnpm run test:e2e` passes.
  - [ ] Forbidden anti-patterns are absent in scoped files.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2 | `refactor(licenses): switch CRUD modal/actions to refine primitives` | licenses page/modals/columns | focused e2e + check gates |
| 3 | `refactor(proxies): remove manual CRUD wrappers in favor of refine hooks` | proxies page/modal/columns | focused e2e + check gates |
| 4 | `refactor(subscriptions): declarative refine CRUD actions` | subscriptions page/columns | focused e2e + check gates |
| 5 | `perf(crud-pages): remove table/list data-source mixing` | three page files | network/request verification + tests |
| 6 | `refactor(routing): delegate CRUD route ownership to refine resources` | `App.tsx` | app navigation validation |
| 7 | `chore(crud): enforce anti-pattern-free refine integration` | all touched scope | full gates |

---

## Success Criteria

### Verification Commands

```bash
pnpm run check:all:mono  # Expected: success
pnpm run test:e2e         # Expected: success
```

### Final Checklist
- [x] All Must Have conditions met.
- [x] All Must NOT Have conditions absent.
- [x] CRUD standardization complete across licenses/proxies/subscriptions.
- [x] No duplicate table data-source usage remains.
- [x] Routing ownership cleanup complete for targeted resources.
