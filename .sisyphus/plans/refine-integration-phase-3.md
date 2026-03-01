# Refine Integration Phase 3 - Eliminate Manual CRUD Form State

## TL;DR

> **Quick Summary**: Refactor Licenses, Subscriptions, and Proxies CRUD modal wiring to canonical `@refinedev/antd` (`useModalForm` -> `modalProps`/`formProps`) and remove duplicate route declarations in `App.tsx`, while preserving current UI/UX and path contracts.
>
> **Deliverables**:
> - Manual CRUD submit/loading states and manual CRUD try/catch handlers removed from target pages/modals
> - Target modal components consume refine-provided `modalProps` + `formProps` directly
> - Route duplication for `/licenses`, `/proxies`, `/subscriptions` removed via single source mapping
> - Regression coverage (TDD with frontend E2E) proving parity
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Baseline tests -> Proxies modal refactor -> Route dedupe -> final regression

---

## Context

### Original Request
Epic: complete removal of manual state-management for standard CRUD forms and cleanup of duplicated routing for Licenses/Proxies/Subscriptions.

### Interview Summary
**Key Discussions**:
- Keep visual UX unchanged; only refactor wiring/architecture.
- Enforce strict prohibition on manual CRUD loading state, manual CRUD `message.success`, and manual close-on-success in standard CRUD modals.
- Test strategy confirmed: **TDD**.

**Research Findings**:
- `licenses/index.tsx` still has manual submission state and manual mutation handlers in bot-assignment flow; create/edit already partially wired with `useModalForm` wrappers.
- `subscriptions/index.tsx` CRUD path is mostly refine-based, but `SubscriptionModal` in bot module is custom and non-canonical.
- `proxies/ProxyCrudModal.tsx` still carries complex manual submit branching + payload assembly + local loading orchestration.
- `App.tsx` contains both resource declarations and explicit route lines for `/licenses`, `/proxies`, `/subscriptions`.
- Path contracts are consumed by tree navigation, breadcrumbs, and datacenter links; path values must remain stable.

### Metis Review
**Identified Gaps (addressed in this plan)**:
- Clarified guardrail: "standard CRUD" scope is create/edit/delete form operations; non-CRUD domain actions remain untouched unless they block canonical form wiring.
- Added explicit no-scope-creep constraints (no redesign, no unrelated abstractions, no path changes).
- Added edge-case acceptance checks for failure flow, double-submit prevention, reopen/edit hydration, and back/forward navigation.

---

## Work Objectives

### Core Objective
Move target CRUD forms to canonical Refine modal-form orchestration and remove duplicated route wiring, without changing user-facing visuals or navigation paths.

### Concrete Deliverables
- `apps/frontend/src/pages/licenses/index.tsx` + `apps/frontend/src/pages/licenses/page/LicenseModals.tsx` refactored to canonical CRUD modal wiring.
- `apps/frontend/src/pages/subscriptions/index.tsx` + `apps/frontend/src/components/bot/subscription/SubscriptionModal.tsx` + `apps/frontend/src/components/subscriptions/SubscriptionForm.tsx` aligned with canonical refine props flow.
- `apps/frontend/src/pages/proxies/ProxiesPage.tsx` + `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx` simplified to canonical refine modal contracts.
- `apps/frontend/src/App.tsx` deduplicated routing for target resources with single source route/resource mapping.
- New/updated E2E regression specs covering create/edit/delete modal lifecycles and direct route navigation.

### Definition of Done
- [x] No manual CRUD submit/loading `useState` remains in target CRUD code paths.
- [x] No manual CRUD `try/catch await create/update` blocks remain in target CRUD page flows.
- [x] Target modals consume `modalProps` and `formProps` directly.
- [x] Duplicate hardcoded route entries for the three resources are removed while navigation remains functional.
- [x] E2E tests pass for create/edit/delete and route access parity.

### Must Have
- Preserve existing visual layout, fields, button placement, and table behavior.
- Keep route path strings unchanged: `/licenses`, `/proxies`, `/subscriptions`.

### Must NOT Have (Guardrails)
- No scope expansion into unrelated modules.
- No route/path renaming.
- No redesign/copy changes.
- No custom manual CRUD success toasts/close logic where Refine already provides behavior.
- Explicit non-CRUD exemptions in this epic:
  - License bot attach/detach operational actions in `apps/frontend/src/pages/licenses/index.tsx` are out of standard CRUD scope unless they block create/edit canonicalization.
  - Proxy IPQS recheck operational action in `apps/frontend/src/pages/proxies/ProxiesPage.tsx` is out of standard CRUD scope unless it blocks create/edit canonicalization.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: TDD
- **Framework**: Playwright E2E (frontend existing infra)

### TDD Execution Model
For each resource slice, run RED -> GREEN -> REFACTOR:
1. **RED**: Add/adjust E2E spec that fails against current/manual behavior target (or missing canonical outcome).
2. **GREEN**: Implement wiring refactor to satisfy the scenario.
3. **REFACTOR**: Remove leftover dead/manual wiring while keeping tests green.

### Manual Execution Verification (in addition to tests)
- Frontend verification via browser automation/manual run:
  - Open each page via sidebar + direct URL.
  - Open create modal, submit valid data, ensure auto-close + data refresh.
  - Open edit modal, submit changes, ensure persisted update.
  - Force validation/server error path, ensure modal stays open and displays failure feedback.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (Start immediately):
- Task 1: Baseline TDD scaffolding (route + CRUD parity specs)

Wave 2 (After Wave 1):
- Task 2: Licenses CRUD modal wiring refactor
- Task 3: Subscriptions CRUD modal wiring refactor
- Task 4: Proxies CRUD modal wiring refactor

Wave 3 (After Wave 2):
- Task 5: App routing dedupe via single source mapping
- Task 6: Full regression + cleanup pass

Critical Path: Task 1 -> Task 4 -> Task 5 -> Task 6

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2,3,4,5,6 | None |
| 2 | 1 | 5,6 | 3,4 |
| 3 | 1 | 5,6 | 2,4 |
| 4 | 1 | 5,6 | 2,3 |
| 5 | 2,3,4 | 6 | None |
| 6 | 5 | None | None |

---

## TODOs

- [x] 1. Establish RED baseline for CRUD modal lifecycle + route parity

  **What to do**:
  - Add deterministic architecture-guard tests (Node test runner) that fail while forbidden manual CRUD patterns exist.
    - File: `scripts/refine-phase3-guards.test.cjs`.
    - Per-resource RED assertions:
      - Licenses: fail if `LicenseEditorModal` still requires custom props `mode` or `editingLicense` or `licenses` in `apps/frontend/src/pages/licenses/page/LicenseModals.tsx`.
      - Subscriptions: fail if bot `SubscriptionModal` still exposes custom CRUD control props `open` or `loading` or `onSave` in `apps/frontend/src/components/bot/subscription/SubscriptionModal.tsx`.
      - Proxies: fail if `createSubmitting` or `editSubmitting` or `onCreateFinish` or `onEditFinish` exists in `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx`.
      - Routing: fail if explicit duplicated route declarations remain for `/licenses`, `/proxies`, `/subscriptions` in `apps/frontend/src/App.tsx`.
  - Add/extend Playwright behavior specs for `/licenses`, `/subscriptions`, `/proxies` in `apps/frontend/e2e/refine-phase3-crud-wiring.spec.ts`.
  - Route parity assertions (explicit):
    - Direct URL visit to each target path renders the expected page container and does not redirect to fallback.
    - Sidebar navigation click to each resource changes URL to the same target path.
    - Use selectors already proven in `apps/frontend/e2e/refine-phase2-crud-baseline.spec.ts` to avoid brittle locator drift.

  **Must NOT do**:
  - Do not alter production component behavior in this task.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: multi-file frontend regression harness design with high impact.
  - **Skills**: `dev-browser`, `frontend-ui-ux`
    - `dev-browser`: reliable browser automation and deterministic flow checks.
    - `frontend-ui-ux`: preserve user interaction parity while writing checks.
  - **Skills Evaluated but Omitted**:
    - `git-master`: not needed for implementation logic.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 1
  - **Blocks**: 2, 3, 4, 5, 6
  - **Blocked By**: None

  **References**:
  - `apps/frontend/playwright.config.ts` - existing E2E harness, baseURL, reporters.
  - `apps/frontend/e2e/smoke.spec.ts` - current style/pattern for frontend smoke tests.
  - `apps/frontend/e2e/refine-phase2-crud-baseline.spec.ts` - authoritative selectors and flow pattern to mirror.
  - `apps/frontend/src/pages/licenses/index.tsx` - license modal trigger points and lifecycle.
  - `apps/frontend/src/pages/subscriptions/index.tsx` - subscriptions create/edit modal flow.
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx` - proxies modal entry points.
  - `apps/frontend/src/components/layout/resourceTree/navigation.ts` - canonical path contracts used by nav.

  **Acceptance Criteria**:
  - [x] RED: `node --test scripts/refine-phase3-guards.test.cjs` fails before refactor with at least one explicit forbidden-pattern failure per targeted area.
  - [x] GREEN (guards): `node --test scripts/refine-phase3-guards.test.cjs` passes after refactor tasks.
  - [x] GREEN (behavior): `pnpm --filter @botmox/frontend test:e2e -- e2e/refine-phase3-crud-wiring.spec.ts` passes.
  - [x] Evidence: test output logs saved in CI/local run report.

- [x] 2. Refactor Licenses CRUD modal wiring to canonical refine props

  **What to do**:
  - Remove manual CRUD submit/loading states (`createSubmitting`, `editSubmitting`) and related handlers for standard create/edit flow.
  - Move payload transformation to mutation pipeline (`onMutation`/hook-level transform), keeping `buildLicensePayload` usage there.
  - Update `LicenseEditorModal` contract to strict refine modal/form props for CRUD submission wiring.
  - Ensure `Modal` and `Form` consume spread props directly from refine (`<Modal {...modalProps}>`, `<Form {...formProps}>`).

  **Must NOT do**:
  - Do not alter form fields/layout copy.
  - Do not change route path strings.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: medium-risk internal wiring refactor with behavior parity constraints.
  - **Skills**: `frontend-ui-ux`, `dev-browser`
    - `frontend-ui-ux`: preserve modal/table UX exactly.
    - `dev-browser`: verify modal lifecycle parity after submit/error.
  - **Skills Evaluated but Omitted**:
    - `openspec`: not required for scoped code refactor execution.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 3, 4)
  - **Blocks**: 5, 6
  - **Blocked By**: 1

  **References**:
  - `apps/frontend/src/pages/licenses/index.tsx` - current useModalForm wrappers + manual states/handlers to remove.
  - `apps/frontend/src/pages/licenses/page/LicenseModals.tsx` - target modal contract normalization.
  - `apps/frontend/src/pages/licenses/page/helpers.ts` - `buildLicensePayload` transform function.
  - `apps/frontend/src/pages/subscriptions/index.tsx` - nearby canonical modalProps/formProps usage pattern.

  **Acceptance Criteria**:
  - [x] RED: Licenses modal CRUD spec fails before rewiring.
  - [x] GREEN: create/edit flows pass with no manual submit `useState` in standard CRUD path.
  - [x] No manual CRUD `message.success` and no manual close-on-success for standard create/edit.
  - [x] `pnpm --filter @botmox/frontend test:e2e` includes passing licenses CRUD assertions.

- [x] 3. Refactor Subscriptions modal stack to direct refine `modalProps/formProps`

  **What to do**:
  - Remove manual create/edit handlers in page-level CRUD flow.
  - Ensure date mapping is done in canonical refine mutation/form normalization path without ad-hoc manual mutation wrappers.
  - Rewrite `SubscriptionModal` and nested `SubscriptionForm` contract to use refine `modalProps` + `formProps` directly for standard CRUD.
  - Remove custom loading/onSave plumbing for standard CRUD.
  - Update active caller contract(s) to match the modal API change, especially `BotSubscription` integration path.

  **Must NOT do**:
  - Do not change visible form structure or field semantics.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: nested component contract migration with data-transform edge cases.
  - **Skills**: `frontend-ui-ux`, `dev-browser`
    - `frontend-ui-ux`: preserve exact form UX and validation feel.
    - `dev-browser`: verify create/edit + validation/error interactions.
  - **Skills Evaluated but Omitted**:
    - `git-master`: not relevant for coding decisions.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 2, 4)
  - **Blocks**: 5, 6
  - **Blocked By**: 1

  **References**:
  - `apps/frontend/src/pages/subscriptions/index.tsx` - page-level create/edit modal orchestration.
  - `apps/frontend/src/components/bot/subscription/SubscriptionModal.tsx` - non-canonical custom modal API to normalize.
  - `apps/frontend/src/components/bot/BotSubscription.tsx` - required caller update path when `SubscriptionModal` props contract changes.
  - `apps/frontend/src/components/subscriptions/SubscriptionForm.tsx` - date transform and submit contract.
  - `apps/frontend/src/pages/subscriptions/subscription-page.helpers.ts` - existing payload transform helpers.

  **Acceptance Criteria**:
  - [x] RED: subscriptions spec fails before refactor for canonical submit lifecycle assertions.
  - [x] GREEN: standard CRUD submit path uses refine props directly, with no custom loading/onSave wiring.
  - [x] Date mapping remains correct (same backend payload semantics) and is verified by one concrete check:
    - Playwright network assertion validates request payload field format for create/edit submission, OR
    - Helper-level test validates `toCreateSubscriptionPayload` / `toUpdateSubscriptionPayload` transformation output.
  - [x] Bot integration parity: flow that renders `BotSubscription` and opens `SubscriptionModal` still works with new modal contract (open, submit, close/error behavior preserved).
  - [x] `pnpm --filter @botmox/frontend test:e2e` passes subscriptions scenarios.

- [x] 4. Simplify Proxies CRUD modal to canonical refine form flow

  **What to do**:
  - Refactor `ProxyCrudModal` to canonical contract(s) centered on refine `modalProps` + `formProps`.
  - Remove manual create/edit orchestration currently centered in `ProxyCrudModal` custom submit branch logic for standard CRUD operations.
  - Integrate payload preparation (proxy status/IPQS-derived fields for CRUD payload) into canonical submit path (`onMutation` or form-level preprocess before `formProps.onFinish`).

  **Must NOT do**:
  - Do not alter non-CRUD operational actions unless required to keep CRUD path canonical.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
    - Reason: highest complexity and branching in this epic.
  - **Skills**: `frontend-ui-ux`, `dev-browser`
    - `frontend-ui-ux`: maintain parity in complex modal states.
    - `dev-browser`: verify branch-heavy create/edit/error flows.
  - **Skills Evaluated but Omitted**:
    - `openspec`: unnecessary for direct implementation refactor.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 2, 3)
  - **Blocks**: 5, 6
  - **Blocked By**: 1

  **References**:
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx` - current modal wiring and create/edit callback plumbing.
  - `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx` - custom branch-heavy submit logic to simplify.
  - `apps/frontend/src/pages/proxies/proxyColumns.tsx` - edit/delete button behavior and resource coupling.

  **Acceptance Criteria**:
  - [x] RED: proxies CRUD E2E assertions fail before canonical rewiring.
  - [x] GREEN: standard create/edit proxy flow no longer depends on manual page-level try/catch mutation wiring.
  - [x] CRUD submit lifecycle (loading, success close, error stay-open) handled through refine form/modal plumbing.
  - [x] `pnpm --filter @botmox/frontend test:e2e` passes proxies scenarios.

- [x] 5. Deduplicate target resource routing in `App.tsx` with single source mapping

  **What to do**:
  - Replace repeated inline `<Route path="/licenses|/proxies|/subscriptions" ...>` definitions with generated routes from one shared local config.
  - Generate corresponding `resources` entries for these pages from the same mapping to avoid drift.
  - Preserve exact existing path strings and page components.

  **Must NOT do**:
  - Do not change auth/layout wrappers.
  - Do not rename/move paths.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: scoped consolidation refactor in one file with high safety checks.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: preserve layout/routing UX consistency.
  - **Skills Evaluated but Omitted**:
    - `dev-browser`: not necessary during code edit, used in verification task.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3
  - **Blocks**: 6
  - **Blocked By**: 2, 3, 4

  **References**:
  - `apps/frontend/src/App.tsx` - duplicate route/resource declarations to unify.
  - `apps/frontend/src/components/layout/resourceTree/navigation.ts` - path contracts to keep unchanged.
  - `apps/frontend/src/components/layout/resourceTree/tree-utils.tsx` - selected-key mapping tied to existing paths.
  - `apps/frontend/src/components/layout/header/breadcrumbs.ts` - breadcrumb resolution dependent on current prefixes.
  - `apps/frontend/src/pages/datacenter/content-map-sections.tsx` - direct links that must remain valid.

  **Acceptance Criteria**:
  - [x] No duplicate hardcoded route declarations for the three target pages remain in `App.tsx`.
  - [x] Resources and routes are produced from one mapping source for these targets.
  - [x] Direct navigation to `/licenses`, `/proxies`, `/subscriptions` still renders expected pages.
  - [x] Sidebar navigation to each target keeps URL/path parity with direct URL entry.

- [x] 6. Final regression, edge-case validation, and cleanup

  **What to do**:
  - Execute full frontend E2E pass for modified flows.
  - Validate edge cases: failed submit keeps modal open, no double-submit side effects, reopening edit modal hydrates values, table refresh behavior preserved.
  - Remove dead/unused props/types/imports left from old manual wiring in standard CRUD scope only.

  **Must NOT do**:
  - Do not introduce unrelated cleanup in untouched modules.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: cross-module verification + safe final cleanup.
  - **Skills**: `dev-browser`, `frontend-ui-ux`
    - `dev-browser`: deterministic flow validation with evidence.
    - `frontend-ui-ux`: ensure UX parity after cleanup.
  - **Skills Evaluated but Omitted**:
    - `git-master`: commit management is separate from technical verification.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Wave 3 (final)
  - **Blocks**: None
  - **Blocked By**: 5

  **References**:
  - `apps/frontend/e2e/*.spec.ts` - final test execution scope.
  - `apps/frontend/src/pages/licenses/index.tsx` - final scan for removed manual CRUD submit state.
  - `apps/frontend/src/pages/subscriptions/index.tsx` - final scan for removed manual CRUD handlers.
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx` - final scan for removed manual CRUD wiring.
  - `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx` - final scan for canonical form/modal wiring.
  - `apps/frontend/src/App.tsx` - final route dedupe validation.

  **Acceptance Criteria**:
  - [x] `pnpm --filter @botmox/frontend test:e2e` passes.
  - [x] Manual smoke: sidebar nav + direct URL + CRUD create/edit on all three pages works.
  - [x] No dead custom CRUD modal prop plumbing remains in target files (excluding explicitly exempt non-CRUD operational flows).

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `test(frontend): add phase3 refine crud baseline e2e` | `apps/frontend/e2e/*` | `pnpm --filter @botmox/frontend test:e2e` |
| 2 | `refactor(licenses): align modal crud with refine form props` | licenses page/modal files | licenses E2E subset |
| 3 | `refactor(subscriptions): remove manual modal crud wiring` | subscriptions modal/form/page files | subscriptions E2E subset |
| 4 | `refactor(proxies): simplify proxy crud to refine modal flow` | proxies page/modal files | proxies E2E subset |
| 5 | `refactor(routing): dedupe resource routes for refine pages` | `apps/frontend/src/App.tsx` | route smoke E2E |
| 6 | `chore(frontend): cleanup leftovers and validate phase3 parity` | touched frontend files | full E2E |

---

## Success Criteria

### Verification Commands
```bash
pnpm --filter @botmox/frontend test:e2e
```

### Final Checklist
- [x] All must-have conditions met.
- [x] All guardrails preserved.
- [x] No duplicate target route declarations.
- [x] No manual CRUD submit/loading state in target standard CRUD paths.
- [x] E2E regression is green.
