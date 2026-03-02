# Design System & Shared UI Kit (Deduplication Elimination)

## TL;DR
> **Summary**: Introduce strict shared UI wrappers (`AppTable`, `AppModal`), migrate target CRUD + bot-profile modal surfaces to wrappers, and replace manual page headers with Refine `<List>` for licenses/proxies/subscriptions.
> **Deliverables**:
> - `AppTable` and `AppModal` in `apps/frontend/src/shared/ui/**`
> - CRUD page migrations (`licenses`, `proxies`, `subscriptions`) to wrapper usage
> - Bot-profile modal wrapper migration for license/proxy/subscription UIs
> - Manual header removal and Refine `<List>` adoption
> **Effort**: Medium
> **Parallel**: YES - 3 waves
> **Critical Path**: T2 AppTable + T3 AppModal -> T4/T5/T6 page migrations -> T7/T8 modal migrations -> T9 cleanup -> verification wave

## Context
### Original Request
Create shared UI wrappers for AntD `Table`/`Modal`, remove duplicated local pagination/header configuration, migrate licenses/proxies/subscriptions CRUD pages, use Refine `<List>` instead of manual headers, and ensure Refine `useTable` behaviors remain intact.

### Interview Summary
- Scope expanded to include bot-profile modal wrappers for full consistency in this epic.
- Test strategy selected: tests-after (existing E2E + static gates), with explicit quality/anti-pattern guardrails because green E2E alone is not sufficient for refactor quality.
- `AppTable` default total text unified to `Total X items`.

### Metis Review (gaps addressed)
- Added strict file allowlist to prevent scope creep beyond agreed domains.
- Added anti-pattern grep gates to detect lingering direct `antd` `Table`/`Modal` imports in migrated targets.
- Added guardrails for Refine-controlled pagination preservation (no handler override, keep `pagination={false}` semantics).
- Added regression constraints for CTA/button labels used by existing E2E.

## Work Objectives
### Core Objective
Eliminate duplicated UI shell configuration by centralizing table and modal defaults into shared wrappers, and normalize list-page layout using Refine primitives without changing CRUD business logic.

### Deliverables
- `apps/frontend/src/shared/ui/AppTable/AppTable.tsx`
- `apps/frontend/src/shared/ui/AppModal/AppModal.tsx`
- Updated exports via `apps/frontend/src/shared/ui/index.ts`
- Refactored pages:
  - `apps/frontend/src/pages/licenses/index.tsx`
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
  - `apps/frontend/src/pages/subscriptions/index.tsx`
- Refactored modals:
  - `apps/frontend/src/pages/licenses/page/LicenseModals.tsx`
  - `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx`
  - `apps/frontend/src/widgets/bot-profile/ui/license/LicenseFormModal.tsx`
  - `apps/frontend/src/widgets/bot-profile/ui/proxy/ProxyEditorModal.tsx`
  - `apps/frontend/src/widgets/bot-profile/ui/subscription/SubscriptionModal.tsx`
- Removed obsolete headers:
  - `apps/frontend/src/pages/proxies/ProxiesPageHeader.tsx`
  - `apps/frontend/src/pages/licenses/page/LicensePageHeader.tsx`

### Definition of Done (verifiable conditions with commands)
- `pnpm --filter @botmox/frontend lint` exits `0`.
- `pnpm --filter @botmox/frontend typecheck` exits `0`.
- `pnpm --filter @botmox/frontend build` exits `0`.
- `pnpm --filter @botmox/frontend test:e2e --grep "refine phase2 crud baseline|refine phase3 crud wiring baseline|licenses|proxies|subscriptions"` exits `0` for selected tests.
- `pnpm exec rg "import\\s*\\{[^}]*\\b(Table|Modal)\\b[^}]*\\}\\s*from 'antd'" apps/frontend/src/pages/licenses apps/frontend/src/pages/proxies apps/frontend/src/pages/subscriptions apps/frontend/src/widgets/bot-profile/ui --glob "*.tsx"` returns no matches in migrated surfaces.

### Must Have
- Wrapper defaults centralized and applied consistently.
- Refine `useTable` controls (sort/filter/pagination/loading) preserved.
- Refine `<List>` used for target page headers, with retained page actions.
- Bot-profile modal wrappers migrated to `AppModal` in scope.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No CRUD payload/business-logic changes.
- No new frontend testing framework introduction in this epic.
- No migration of unrelated domains (finance/workspace/datacenter/etc.).
- No hardcoded per-page pagination normalization logic after wrapper adoption.
- No silent label changes that break existing E2E semantics.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + Playwright E2E (existing infra).
- QA policy: every task includes happy + failure/edge scenario.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave; shared dependencies extracted into Wave 1.

Wave 1: foundation + wrapper contracts + scope lock (`T1`, `T2`, `T3`, `T10`, `T11`)
Wave 2: page migrations + header normalization (`T4`, `T5`, `T6`)
Wave 3: modal migrations + cleanup + regression hardening (`T7`, `T8`, `T9`, `T12`)

### Dependency Matrix (full, all tasks)
- `T1` blocks `T4-T12`.
- `T2` blocks `T4-T6` and partially `T10`.
- `T3` blocks `T7-T8` and partially `T10`.
- `T4`, `T5`, `T6` block `T9` and `T12`.
- `T7`, `T8` block `T12`.
- `T9` blocks `T12`.
- `T10` and `T11` run in parallel with implementation waves, then finalize in `T12`.

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 5 tasks -> `quick`, `general`, `unspecified-high`
- Wave 2 -> 3 tasks -> `general`, `quick`
- Wave 3 -> 4 tasks -> `general`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task has: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Lock Scope + Baseline Anti-Pattern Inventory

  **What to do**: Freeze exact in-scope file allowlist, capture pre-change direct `antd` `Table`/`Modal` import inventory for target domains, and record baseline command outputs in evidence.
  **Must NOT do**: Do not edit code in this task; do not expand scope to non-listed pages/widgets.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: deterministic discovery and evidence capture.
  - Skills: `[]` - no special skill needed.
  - Omitted: `['frontend-ui-ux']` - no design decision in this task.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: `2-12` | Blocked By: none

  **References**:
  - Pattern: `apps/frontend/src/pages/licenses/index.tsx:387` - direct `Table` usage with duplicated pagination shaping.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx:303` - direct `Table` usage with duplicated pagination shaping.
  - Pattern: `apps/frontend/src/pages/subscriptions/index.tsx:324` - direct `Table` usage with duplicated pagination shaping.
  - Pattern: `apps/frontend/src/pages/licenses/page/LicenseModals.tsx:29` - direct `Modal` shell.
  - Pattern: `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx:288` - direct `Modal` shell.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/subscription/SubscriptionModal.tsx:22` - direct `Modal` shell.

  **Acceptance Criteria**:
  - [x] `pnpm exec rg "import\\s*\\{[^}]*\\b(Table|Modal)\\b[^}]*\\}\\s*from 'antd'" apps/frontend/src/pages/licenses apps/frontend/src/pages/proxies apps/frontend/src/pages/subscriptions apps/frontend/src/widgets/bot-profile/ui --glob "*.tsx"` runs and evidence is saved.
  - [x] A plain-text allowlist is recorded in `.sisyphus/evidence/task-1-scope-baseline.txt`.

  **QA Scenarios**:
  ```text
  Scenario: Happy path baseline capture
    Tool: Bash
    Steps: Run import-inventory grep and write output to .sisyphus/evidence/task-1-scope-baseline.txt
    Expected: File contains only known target-surface matches, no unrelated directories requested for migration
    Evidence: .sisyphus/evidence/task-1-scope-baseline.txt

  Scenario: Failure guard against scope creep
    Tool: Bash
    Steps: Run grep with current allowlist; compare matches for unexpected domains (finance/workspace/datacenter)
    Expected: No out-of-scope files included in execution scope declaration
    Evidence: .sisyphus/evidence/task-1-scope-baseline-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `n/a`

- [x] 2. Build `AppTable` Wrapper With Safe Refine Pagination Merge

  **What to do**: Create `apps/frontend/src/shared/ui/AppTable/AppTable.tsx` generic wrapper (`<T extends object>`) based on `TableProps<T>`; apply defaults `size="small"`, width-safe class/style, and merged pagination defaults (`pageSize: 10`, `showSizeChanger: true`, `showTotal: (total) => \`Total ${total} items\``) while preserving incoming Refine pagination callbacks/state.
  **Must NOT do**: Do not override consumer-provided `onChange` handlers; do not force pagination if `pagination={false}`.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: typed wrapper + prop-merge behavior.
  - Skills: `[]` - existing project patterns are sufficient.
  - Omitted: `['test']` - no new framework introduction in this epic.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: `4,5,6,10` | Blocked By: `1`

  **References**:
  - Pattern: `apps/frontend/src/pages/licenses/index.tsx:395` - existing pagination merge logic to centralize.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx:309` - same duplication pattern.
  - Pattern: `apps/frontend/src/pages/subscriptions/index.tsx:330` - same duplication pattern.
  - API/Type: `https://ant.design/components/table/` - Table pagination contract.
  - External: `https://github.com/ant-design/ant-design/blob/master/components/table/hooks/usePagination.ts` - merged pagination behavior reference.

  **Acceptance Criteria**:
  - [x] `AppTable` compiles with generic `TableProps<T>` and forwards unknown props to underlying antd `Table`.
  - [x] If `pagination` is object, wrapper merges defaults without dropping existing `current/pageSize/onChange`.
  - [x] If `pagination` is `false`, wrapper keeps pagination disabled.

  **QA Scenarios**:
  ```text
  Scenario: Happy path pagination merge
    Tool: Bash
    Steps: Build frontend and run typecheck after creating AppTable; inspect generated usage by temporary local invocation in one target page
    Expected: Typecheck/build pass and page keeps server pagination behavior
    Evidence: .sisyphus/evidence/task-2-apptable-build.txt

  Scenario: Edge case pagination disabled
    Tool: Bash
    Steps: Run targeted grep/static check for pagination=false preservation branch in AppTable
    Expected: Wrapper contains explicit bypass when pagination is false
    Evidence: .sisyphus/evidence/task-2-apptable-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `apps/frontend/src/shared/ui/AppTable/AppTable.tsx`, `apps/frontend/src/shared/ui/index.ts`

- [x] 3. Build `AppModal` Wrapper With Controlled Defaults

  **What to do**: Create `apps/frontend/src/shared/ui/AppModal/AppModal.tsx` wrapping antd `Modal` with `ModalProps`, defaults `destroyOnClose={true}`, `maskClosable={false}`, and standard body spacing contract while preserving passed props.
  **Must NOT do**: Do not break existing `onCancel` and footer behavior; do not switch to `destroyOnHidden` in this epic.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: reusable wrapper with prop precedence rules.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - behavior standardization only.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: `7,8,10` | Blocked By: `1`

  **References**:
  - Pattern: `apps/frontend/src/pages/licenses/page/LicenseModals.tsx:29` - modal shell behavior.
  - Pattern: `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx:288` - modal shell with custom footer.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/subscription/SubscriptionModal.tsx:22` - simple modal wrapper.
  - API/Type: `https://ant.design/components/modal/` - Modal contract.
  - External: `https://github.com/ant-design/ant-design/blob/master/components/modal/interface.ts` - `destroyOnClose` compatibility/deprecation context.

  **Acceptance Criteria**:
  - [x] `AppModal` forwards all `ModalProps` and default props apply only when caller does not override.
  - [x] Existing modal open/close flows compile unchanged after swapping import in one pilot consumer.

  **QA Scenarios**:
  ```text
  Scenario: Happy path modal defaults
    Tool: Bash
    Steps: Typecheck/build with AppModal and one pilot replacement
    Expected: No type/runtime regressions; modal still closes via explicit actions and not by mask click
    Evidence: .sisyphus/evidence/task-3-appmodal-build.txt

  Scenario: Edge override preservation
    Tool: Bash
    Steps: Verify AppModal merge order allows explicit consumer props to override defaults
    Expected: Consumer override path exists; no hard lock of defaults
    Evidence: .sisyphus/evidence/task-3-appmodal-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `apps/frontend/src/shared/ui/AppModal/AppModal.tsx`, `apps/frontend/src/shared/ui/index.ts`

- [x] 4. Refactor Licenses Page to `AppTable` + Refine `List`

  **What to do**: In `apps/frontend/src/pages/licenses/index.tsx`, replace direct `Table` with `AppTable`, remove local pagination normalization block, wrap content in Refine `<List>` and move header actions (stats toggle + create) to `headerButtons`, remove `LicensePageHeader` usage.
  **Must NOT do**: Do not alter filter semantics, bot polling, CRUD callbacks, or label text relied on by E2E.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: medium complexity page refactor with multiple moving parts.
  - Skills: `[]` - established patterns in file itself.
  - Omitted: `['artistry']` - no unconventional approach needed.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: `9,12` | Blocked By: `1,2`

  **References**:
  - Pattern: `apps/frontend/src/pages/licenses/index.tsx:362` - current manual header insertion point.
  - Pattern: `apps/frontend/src/pages/licenses/index.tsx:387` - current table block to replace.
  - Pattern: `apps/frontend/src/pages/licenses/page/LicensePageHeader.tsx:14` - old header behavior to preserve via `List` buttons.
  - API/Type: `https://refine.dev/docs/ui-integrations/ant-design/components/basic-views/list/` - `List` and `headerButtons` usage.

  **Acceptance Criteria**:
  - [x] `LicensePageHeader` import/usage removed from licenses page.
  - [x] `AppTable` receives `licensesTable.tableProps` and page compiles.
  - [x] Refine `<List>` wraps page body and retains create/stats actions.

  **QA Scenarios**:
  ```text
  Scenario: Happy path licenses page behavior
    Tool: Playwright
    Steps: Open licenses list, toggle stats button, open create modal, paginate to next page
    Expected: Stats toggle works, create flow opens, pagination still loads server-side data
    Evidence: .sisyphus/evidence/task-4-licenses-page.png

  Scenario: Failure/edge outdated edit link
    Tool: Playwright
    Steps: Navigate with stale edit query/id route state if available
    Expected: Existing graceful warning/redirect behavior remains unchanged
    Evidence: .sisyphus/evidence/task-4-licenses-page-error.png
  ```

  **Commit**: NO | Message: `n/a` | Files: `apps/frontend/src/pages/licenses/index.tsx`

- [x] 5. Refactor Proxies Page to `AppTable` + Refine `List`

  **What to do**: In `apps/frontend/src/pages/proxies/ProxiesPage.tsx`, replace `Table` with `AppTable`, remove local pagination normalization block, replace manual `ProxiesPageHeader` with Refine `<List>` `headerButtons` while keeping stats toggle and create action behavior.
  **Must NOT do**: Do not change IPQS checks, provider handling, or edit-link stale guard behavior.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: refactor with IPQS-related UI interactions and modal triggers.
  - Skills: `[]` - no additional skill needed.
  - Omitted: `['ultrabrain']` - not algorithmically complex.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: `9,12` | Blocked By: `1,2`

  **References**:
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx:286` - manual header insertion point.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx:303` - table + pagination duplication.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPageHeader.tsx:14` - old header actions to preserve.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesFiltersCard.tsx` - filter block placement inside new `List` body.

  **Acceptance Criteria**:
  - [x] `ProxiesPageHeader` import/usage removed from page.
  - [x] `AppTable` usage compiles and keeps `scroll`/layout requirements.
  - [x] Proxies create and edit modal triggers remain accessible from list header/table actions.

  **QA Scenarios**:
  ```text
  Scenario: Happy path proxies operations
    Tool: Playwright
    Steps: Open proxies page, toggle stats, open Add Proxy modal, run pagination navigation
    Expected: Header actions function; table pagination remains operational
    Evidence: .sisyphus/evidence/task-5-proxies-page.png

  Scenario: Failure path IPQS unavailable
    Tool: Playwright
    Steps: Trigger recheck action under disabled/unavailable IPQS config
    Expected: Existing warning/error messaging remains unchanged
    Evidence: .sisyphus/evidence/task-5-proxies-page-error.png
  ```

  **Commit**: NO | Message: `n/a` | Files: `apps/frontend/src/pages/proxies/ProxiesPage.tsx`

- [x] 6. Refactor Subscriptions Page to `AppTable` + Refine `List`

  **What to do**: In `apps/frontend/src/pages/subscriptions/index.tsx`, replace inline header card with Refine `<List>` and `headerButtons`, replace direct table with `AppTable`, remove duplicated pagination block, preserve existing filters/stats/alerts and modal triggers.
  **Must NOT do**: Do not change subscription payload mapping, warning days logic, or status filtering semantics.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: page has dense UI composition and modal integration.
  - Skills: `[]` - existing patterns sufficient.
  - Omitted: `['frontend-ui-ux']` - no visual redesign requested.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: `9,12` | Blocked By: `1,2`

  **References**:
  - Pattern: `apps/frontend/src/pages/subscriptions/index.tsx:253` - inline manual header card to replace.
  - Pattern: `apps/frontend/src/pages/subscriptions/index.tsx:324` - table duplication block.
  - Pattern: `apps/frontend/src/pages/subscriptions/index.tsx:350` - current modal placement to keep functional.
  - Pattern: `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx` - stats area to preserve.

  **Acceptance Criteria**:
  - [x] Inline manual header block removed and replaced by Refine `<List>`.
  - [x] `AppTable` consumes existing table props and renders `filteredSubscriptions`.
  - [x] Subscription modals still open/close via existing actions.

  **QA Scenarios**:
  ```text
  Scenario: Happy path subscriptions list
    Tool: Playwright
    Steps: Open subscriptions page, search, filter status, open Add Subscription modal, paginate
    Expected: Filters and pagination continue to work; add modal opens correctly
    Evidence: .sisyphus/evidence/task-6-subscriptions-page.png

  Scenario: Failure path stale edit route
    Tool: Playwright
    Steps: Trigger stale edit id condition for subscription
    Expected: Existing graceful warning behavior preserved
    Evidence: .sisyphus/evidence/task-6-subscriptions-page-error.png
  ```

  **Commit**: NO | Message: `n/a` | Files: `apps/frontend/src/pages/subscriptions/index.tsx`

- [x] 7. Migrate Page-Level Modals to `AppModal`

  **What to do**: Replace direct `Modal` with `AppModal` in `LicenseModals.tsx`, `ProxyCrudModal.tsx`, and subscription page modal usage in `subscriptions/index.tsx`; preserve custom widths/footers/callbacks.
  **Must NOT do**: Do not alter form field schemas, submit handlers, or custom footer button behavior.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: medium-risk refactor touching create/edit workflows.
  - Skills: `[]` - no special skill required.
  - Omitted: `['quick']` - too many interaction points for trivial profile.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: `12` | Blocked By: `1,3,4,5,6`

  **References**:
  - Pattern: `apps/frontend/src/pages/licenses/page/LicenseModals.tsx:29` - base modal for license editor.
  - Pattern: `apps/frontend/src/pages/licenses/page/LicenseModals.tsx:82` - add-bot modal.
  - Pattern: `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx:288` - complex modal with custom footer.
  - Pattern: `apps/frontend/src/pages/subscriptions/index.tsx:350` - create/edit subscription modals.

  **Acceptance Criteria**:
  - [x] All in-scope page-level modal components import/use `AppModal`.
  - [x] Existing widths/titles/footer null/custom footer behavior remain unchanged.
  - [x] `maskClosable={false}` default applies unless explicit override exists.

  **QA Scenarios**:
  ```text
  Scenario: Happy path modal open/submit/cancel
    Tool: Playwright
    Steps: Open each migrated modal (license/proxy/subscription), cancel once, submit once with valid data
    Expected: Cancel and submit flows remain functional in all three resources
    Evidence: .sisyphus/evidence/task-7-page-modals.png

  Scenario: Edge mask close prevention
    Tool: Playwright
    Steps: Open migrated modal and click outside mask
    Expected: Modal remains open (unless file explicitly overrides mask closable)
    Evidence: .sisyphus/evidence/task-7-page-modals-error.png
  ```

  **Commit**: NO | Message: `n/a` | Files: `apps/frontend/src/pages/licenses/page/LicenseModals.tsx`, `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx`, `apps/frontend/src/pages/subscriptions/index.tsx`

- [x] 8. Migrate Bot-Profile Modal Wrappers to `AppModal`

  **What to do**: Replace direct antd `Modal` usage in bot-profile modal shells for license/proxy/subscription flows with `AppModal`, preserving prop interfaces and behavior.
  **Must NOT do**: Do not refactor bot-profile business logic or data hooks in this task.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: targeted wrapper swap across known files.
  - Skills: `[]` - straightforward import/component replacement.
  - Omitted: `['deep']` - no deep architectural change.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: `12` | Blocked By: `1,3`

  **References**:
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/license/LicenseFormModal.tsx` - license modal shell.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/ProxyEditorModal.tsx` - proxy modal shell.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/subscription/SubscriptionModal.tsx:22` - subscription modal shell.
  - Pattern: `apps/frontend/src/widgets/subscriptions/SubscriptionForm.tsx` - shared form body to keep untouched.

  **Acceptance Criteria**:
  - [x] All three bot-profile modal shells in scope use `AppModal`.
  - [x] No change to exposed props and caller contracts.

  **QA Scenarios**:
  ```text
  Scenario: Happy path bot-profile modal usage
    Tool: Playwright
    Steps: Open bot profile sections for license/proxy/subscription and trigger each modal
    Expected: All modals render and close correctly with existing controls
    Evidence: .sisyphus/evidence/task-8-botprofile-modals.png

  Scenario: Edge compatibility with existing modalProps
    Tool: Bash
    Steps: Typecheck project after replacement to validate modalProps contract compatibility
    Expected: Zero type errors related to modal prop mismatch
    Evidence: .sisyphus/evidence/task-8-botprofile-modals-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `apps/frontend/src/widgets/bot-profile/ui/license/LicenseFormModal.tsx`, `apps/frontend/src/widgets/bot-profile/ui/proxy/ProxyEditorModal.tsx`, `apps/frontend/src/widgets/bot-profile/ui/subscription/SubscriptionModal.tsx`

- [x] 9. Remove Obsolete Header Components + Clean Imports

  **What to do**: Delete obsolete manual header files and remove all stale imports/usages after Refine `<List>` migration; ensure no dead references remain.
  **Must NOT do**: Do not remove non-obsolete shared components or unrelated files.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: targeted deletion + import hygiene.
  - Skills: `[]` - simple cleanup.
  - Omitted: `['unspecified-high']` - low complexity cleanup.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: `12` | Blocked By: `4,5,6`

  **References**:
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPageHeader.tsx` - obsolete after List header migration.
  - Pattern: `apps/frontend/src/pages/licenses/page/LicensePageHeader.tsx` - obsolete after List header migration.
  - Pattern: `apps/frontend/src/pages/licenses/index.tsx` - stale header import removal.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx` - stale header import removal.

  **Acceptance Criteria**:
  - [x] Obsolete header files are deleted.
  - [x] No compile errors from removed imports/usages.

  **QA Scenarios**:
  ```text
  Scenario: Happy path cleanup
    Tool: Bash
    Steps: Remove header files, run typecheck
    Expected: Typecheck passes with no unresolved imports
    Evidence: .sisyphus/evidence/task-9-header-cleanup.txt

  Scenario: Failure guard stale references
    Tool: Bash
    Steps: Run grep for `LicensePageHeader|ProxiesPageHeader` across frontend src
    Expected: 0 matches in active code
    Evidence: .sisyphus/evidence/task-9-header-cleanup-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `apps/frontend/src/pages/proxies/ProxiesPageHeader.tsx`, `apps/frontend/src/pages/licenses/page/LicensePageHeader.tsx`, touched page files

- [x] 10. Enforce Shared UI Export + Direct-Import Guardrails

  **What to do**: Ensure wrapper exports are available through `apps/frontend/src/shared/ui/index.ts` and all in-scope migrated files import wrappers from shared UI rather than direct antd where applicable.
  **Must NOT do**: Do not blanket-replace all antd imports in repository; only in-scope targets.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: deterministic import hygiene and barrel consistency.
  - Skills: `[]` - no special skill required.
  - Omitted: `['deep']` - no architecture redesign.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: `12` | Blocked By: `2,3`

  **References**:
  - Pattern: `apps/frontend/src/shared/ui/index.ts` - current empty barrel.
  - Pattern: `apps/frontend/src/pages/licenses/index.tsx:4` - direct `Table` import currently present.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx:3` - direct `Table` import currently present.
  - Pattern: `apps/frontend/src/pages/subscriptions/index.tsx:12` - direct `Table` and `Modal` imports currently present.

  **Acceptance Criteria**:
  - [x] `shared/ui/index.ts` exports `AppTable` and `AppModal`.
  - [x] In-scope migrated files use shared wrappers.

  **QA Scenarios**:
  ```text
  Scenario: Happy path wrapper imports
    Tool: Bash
    Steps: Grep target files for `from '../../shared/ui'` (or equivalent relative path) and confirm wrapper usage
    Expected: Target pages/modals import AppTable/AppModal from shared UI
    Evidence: .sisyphus/evidence/task-10-shared-imports.txt

  Scenario: Edge case accidental direct imports
    Tool: Bash
    Steps: Run anti-pattern grep command for direct antd Table/Modal imports in scope
    Expected: No direct Table/Modal imports remain in migrated targets
    Evidence: .sisyphus/evidence/task-10-shared-imports-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `apps/frontend/src/shared/ui/index.ts`, in-scope migrated files

- [x] 11. Static Quality Wave (Lint/Type/Build + Refactor Anti-Pattern Checks)

  **What to do**: Run required static checks and dedicated anti-pattern searches focused on duplicated pagination/header residues and direct antd shell imports.
  **Must NOT do**: Do not skip failed checks; do not ignore warnings that indicate regressions.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: strict quality gate enforcement.
  - Skills: `[]` - command execution + result interpretation.
  - Omitted: `['quick']` - includes multi-command gate reasoning.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: `12` | Blocked By: `1`

  **References**:
  - Pattern: `apps/frontend/package.json:10` - typecheck/build/lint scripts.
  - Pattern: `.github/workflows/ci.yml:74` - frontend lint gate in CI.
  - Pattern: `.github/workflows/ci.yml:77` - frontend typecheck gate in CI.
  - Pattern: `.github/workflows/ci.yml:80` - frontend build gate in CI.

  **Acceptance Criteria**:
  - [x] `pnpm --filter @botmox/frontend lint` passes.
  - [x] `pnpm --filter @botmox/frontend typecheck` passes.
  - [x] `pnpm --filter @botmox/frontend build` passes.
  - [x] Anti-pattern grep checks pass and evidence recorded.

  **QA Scenarios**:
  ```text
  Scenario: Happy path static gates
    Tool: Bash
    Steps: Execute lint, typecheck, build in sequence
    Expected: All commands exit 0
    Evidence: .sisyphus/evidence/task-11-static-gates.txt

  Scenario: Failure detection for residual duplication
    Tool: Bash
    Steps: Grep for `Math.max(1, Number(` and direct `Table/Modal` imports in target pages
    Expected: No residual per-page pagination normalization or direct shell imports in migrated scope
    Evidence: .sisyphus/evidence/task-11-static-gates-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: evidence only

- [x] 12. Regression Wave (Targeted Playwright + Scope Fidelity Verification)

  **What to do**: Run targeted E2E and post-migration scope-fidelity checks ensuring behavioral parity (create/edit flows, stats toggles, pagination, stale-link guards) and no out-of-scope modifications.
  **Must NOT do**: Do not broaden test matrix to unrelated features; do not accept flaky failures without root-cause note.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-surface regression verification.
  - Skills: `[]` - existing Playwright suite is sufficient.
  - Omitted: `['test']` - no new test authoring, only execution/triage.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: Final Verification Wave | Blocked By: `4,5,6,7,8,9,10,11`

  **References**:
  - Test: `apps/frontend/e2e/refine-phase2-crud-baseline.spec.ts` - baseline CRUD behavior.
  - Test: `apps/frontend/e2e/refine-phase3-crud-wiring.spec.ts` - wiring and flow verification.
  - Pattern: `.github/workflows/ci.yml:128` - canonical E2E command.

  **Acceptance Criteria**:
  - [x] `pnpm --filter @botmox/frontend test:e2e --grep "refine phase2 crud baseline|refine phase3 crud wiring baseline|licenses|proxies|subscriptions"` passes.
  - [x] `git diff --name-only` (or equivalent) confirms changed files remain in planned scope only.

  **QA Scenarios**:
  ```text
  Scenario: Happy path targeted regression
    Tool: Bash
    Steps: Run targeted Playwright spec subset for licenses/proxies/subscriptions flows
    Expected: 0 failed tests in selected subset
    Evidence: .sisyphus/evidence/task-12-regression.txt

  Scenario: Scope-fidelity failure case
    Tool: Bash
    Steps: Compare changed file list against allowlist from Task 1
    Expected: No out-of-scope file modifications; otherwise task fails with explicit list
    Evidence: .sisyphus/evidence/task-12-regression-error.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): standardize CRUD pages with shared AppTable/AppModal and Refine List` | Files: all in-scope migrated files + shared wrappers

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit - oracle
- [x] F2. Code Quality Review - unspecified-high
- [x] F3. Real Manual QA - unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check - deep

## Commit Strategy
- Single feature commit after all verification tasks pass.
- Commit message: `refactor(frontend): unify CRUD UI shells with shared AppTable/AppModal and Refine List`
- Include only planned files; no unrelated churn.

## Success Criteria
- Duplicated table/modal shell config removed from target surfaces.
- Shared wrappers used in all in-scope pages/modals.
- Manual page header components removed and replaced by Refine `<List>` layout.
- Static gates + targeted E2E pass with no functional regressions.
- Anti-pattern grep confirms no direct `antd` `Table`/`Modal` imports in migrated targets.
