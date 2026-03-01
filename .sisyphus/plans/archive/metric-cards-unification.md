# Unified Metric Cards via AntD Statistic

## TL;DR

> **Quick Summary**: Replace page-specific stat card markup/CSS with a single reusable `MetricCard` built on Ant Design `Card` + `Statistic`, and normalize metric grids on Dashboard, Licenses, and Subscriptions.
>
> **Deliverables**:
> - Refactored `MetricCard` component using AntD `Statistic`
> - Deleted legacy `MetricCard.module.css`
> - Migrated Licenses and Subscriptions stats blocks to `MetricCard` + AntD `Row/Col`
> - Removed obsolete stats CSS classes on Licenses/Subscriptions and `.metrics-row` on Dashboard
>
> **Estimated Effort**: Short
> **Parallel Execution**: YES - 2 waves
> **Critical Path**: Task 1 -> Task 2 -> Task 4

---

## Context

### Original Request
Unify metric widgets on Dashboard, Licenses, and Subscriptions by replacing custom stat-card markup/CSS with one reusable `MetricCard` based on Ant Design `Statistic`, and remove obsolete CSS classes.

### Interview Summary
**Key Discussions**:
- Refactor scope is UI-only and explicitly constrained to listed files/classes.
- Keep existing page behavior (including collapsed stats behavior on Licenses/Subscriptions) unchanged.
- Verification strategy selected: run existing frontend Playwright E2E and perform manual visual verification.

**Research Findings**:
- Current `MetricCard` is custom-markup + CSS-module based (`apps/frontend/src/components/ui/MetricCard.tsx:1`).
- Licenses/Subscriptions stats currently use custom classes to style card values (`apps/frontend/src/pages/licenses/page/LicensesStats.tsx:17`, `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx:23`).
- Dashboard metrics row still depends on `.metrics-row` CSS class (`apps/frontend/src/pages/dashboard/index.tsx:140`, `apps/frontend/src/pages/dashboard/Dashboard.module.css:21`).
- Frontend E2E infrastructure exists via Playwright (`apps/frontend/package.json:14`, `apps/frontend/playwright.config.ts:10`).

### Metis Review
**Identified Gaps** (addressed):
- Gap: Potential API drift in `MetricCard` could break Dashboard.
  - Resolution: Preserve existing `MetricCardProps` contract (`label`, `value`, `subtext`, `progress`, `icon`, `color`) while swapping internal rendering.
- Gap: CSS cleanup can leave dead references.
  - Resolution: Add explicit grep verification for deleted classes/file references.
- Gap: Scope creep risk into stats logic.
  - Resolution: Guardrail: no changes to stats computation/data flow, only presentation/layout.

---

## Work Objectives

### Core Objective
Implement a presentation-layer refactor so all metric cards on target pages render through a single reusable AntD-based `MetricCard`, while removing obsolete metric CSS classes and preserving existing functionality.

### Concrete Deliverables
- `apps/frontend/src/components/ui/MetricCard.tsx` migrated to AntD `Card` + `Statistic` implementation.
- `apps/frontend/src/components/ui/MetricCard.module.css` removed from repository.
- `apps/frontend/src/pages/licenses/page/LicensesStats.tsx` migrated to `MetricCard` + `Row/Col`.
- `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx` migrated to `MetricCard` + `Row/Col`.
- Legacy metric CSS classes removed from:
  - `apps/frontend/src/pages/licenses/LicensesPage.module.css`
  - `apps/frontend/src/pages/subscriptions/SubscriptionsPage.module.css`
- `.metrics-row` removed from `apps/frontend/src/pages/dashboard/Dashboard.module.css` and usage removed from `apps/frontend/src/pages/dashboard/index.tsx`.

### Definition of Done
- [x] `apps/frontend/src/components/ui/MetricCard.module.css` does not exist.
- [x] No remaining references to removed metric classes in Licenses/Subscriptions pages.
- [x] Dashboard/Licenses/Subscriptions metric UI paths all use `MetricCard`.
- [x] Metric grids use AntD `Row gutter={[16, 16]}` + `Col` (as specified for Licenses/Subscriptions).
- [x] Frontend build/typecheck and E2E commands pass.

### Must Have
- UI-only refactor; no business/data logic changes.
- Keep collapse behavior unchanged (`collapsed => null`) in Licenses/Subscriptions stats components.
- Apply requested semantic colors for Licenses cards.

### Must NOT Have (Guardrails)
- No changes to `computeStats`/data derivation logic (`apps/frontend/src/pages/licenses/index.tsx:150`, `apps/frontend/src/pages/subscriptions/index.tsx:272`).
- No metric label/order changes unless required by explicit request.
- No unrelated CSS redesign outside the listed classes and `.metrics-row` cleanup.
- No introduction of new dependencies/frameworks.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: Tests-after / existing suite + manual visual QA
- **Framework**: Playwright E2E (`@playwright/test`)

### Manual + Existing E2E Verification

Each implementation task includes:
- Type/build safety check: `pnpm --filter @botmox/frontend typecheck` and `pnpm --filter @botmox/frontend build`
- E2E regression: `pnpm --filter @botmox/frontend test:e2e`
- Visual/manual checks in browser (desktop + mobile widths) for Dashboard, Licenses, Subscriptions stat areas.

Evidence required:
- Terminal outputs for typecheck/build/E2E
- Manual verification notes for card layout/color/render consistency

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (Start Immediately)
├── Task 1: Refactor shared MetricCard
└── Task 5: Dashboard cleanup (.metrics-row removal)

Wave 2 (After Wave 1)
├── Task 2: Refactor Licenses stats to MetricCard + Row/Col
├── Task 3: Refactor Subscriptions stats to MetricCard + Row/Col
└── Task 4: CSS cleanup and dead-reference validation

Critical Path: Task 1 -> Task 2 -> Task 4
Parallel Speedup: ~30-40% vs sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 2, 3 | 5 |
| 2 | 1 | 4 | 3 |
| 3 | 1 | 4 | 2 |
| 4 | 2, 3, 5 | Final verify | None |
| 5 | None | 4 | 1 |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|--------------------|
| 1 | 1, 5 | `delegate_task(category="quick", load_skills=["frontend-ui-ux"], run_in_background=true)` |
| 2 | 2, 3, 4 | parallel dispatch after Wave 1, then converge for verification |

---

## TODOs

- [x] 1. Refactor shared `MetricCard` to AntD `Statistic`

  **What to do**:
  - Replace custom class-based layout in `apps/frontend/src/components/ui/MetricCard.tsx` with AntD `Card`, `Statistic`, `Progress`, `Typography.Text` composition.
  - Keep the existing prop contract unchanged.
  - Remove CSS-module import usage from component and inline required styles/tokens.
  - Delete `apps/frontend/src/components/ui/MetricCard.module.css`.

  **Must NOT do**:
  - Do not rename/remove existing props from public interface.
  - Do not change metric value semantics or call-sites here.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: single shared component UI refactor with bounded scope.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: needed for AntD visual composition/token-consistent styling.
  - **Skills Evaluated but Omitted**:
    - `git-master`: not needed for implementation itself.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 5)
  - **Blocks**: Tasks 2, 3
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/components/ui/MetricCard.tsx:7` - current prop contract to preserve.
  - `apps/frontend/src/components/ui/MetricCard.tsx:25` - current card styling/token baseline.
  - `apps/frontend/src/pages/dashboard/index.tsx:142` - existing consumer expectations (`label`, `value`, `icon`).

  **Acceptance Criteria**:
  - [ ] `MetricCard` uses AntD `Statistic` internally.
  - [ ] `apps/frontend/src/components/ui/MetricCard.module.css` is deleted.
  - [ ] No import/reference remains to `./MetricCard.module.css`.
  - [ ] Existing Dashboard call-sites compile without prop changes.

  **Manual Execution Verification**:
  - [x] Command: `pnpm --filter @botmox/frontend typecheck` -> exit code 0.
  - [x] Command: `pnpm --filter @botmox/frontend build` -> exit code 0.

  **Commit**: NO (batch with Tasks 2-5)

- [x] 2. Migrate Licenses stats block to reusable `MetricCard` + AntD grid

  **What to do**:
  - In `apps/frontend/src/pages/licenses/page/LicensesStats.tsx`, replace custom `<div className={styles.stats}>` + `Card` blocks with `Row gutter={[16, 16]}` and `Col xs={12} sm={8} md={4}`.
  - Render each metric via `MetricCard` import from `src/components/ui/MetricCard` (relative path in repo).
  - Apply explicit color props:
    - Active -> `var(--boxmox-color-status-success)`
    - Expiring Soon -> `var(--boxmox-color-status-warning)`
    - Expired -> `var(--boxmox-color-status-danger)`
  - Keep Total and Unassigned in default color.
  - Preserve `if (collapsed) return null;` behavior.

  **Must NOT do**:
  - Do not alter stats computation source or ordering semantics.
  - Do not remove collapse handling.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: straightforward component replacement in one file.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: ensures grid and status-color mapping follow design tokens.
  - **Skills Evaluated but Omitted**:
    - `dev-browser`: not required during code changes phase.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `apps/frontend/src/pages/licenses/page/LicensesStats.tsx:11` - collapse guard to preserve.
  - `apps/frontend/src/pages/licenses/page/LicensesStats.tsx:17` - current custom stats container to replace.
  - `apps/frontend/src/pages/licenses/index.tsx:348` - integration point that must continue rendering same component.
  - `apps/frontend/src/pages/licenses/index.tsx:150` - stats calculation source (must remain untouched).

  **Acceptance Criteria**:
  - [ ] `LicensesStatsPanel` renders all metrics via `MetricCard`.
  - [ ] Grid uses `Row gutter={[16, 16]}` and `Col xs={12} sm={8} md={4}`.
  - [ ] Requested color mapping is applied exactly.
  - [ ] `collapsed` behavior remains unchanged.

  **Manual Execution Verification**:
  - [ ] Navigate to Licenses page.
  - [ ] Toggle Stats collapse/expand; collapsed still hides block.
  - [ ] Verify 5 cards render with expected labels and color coding.
  - [ ] Verify layout remains consistent at desktop and narrow width.

  **Commit**: NO

- [x] 3. Migrate Subscriptions stats block to reusable `MetricCard` + AntD grid

  **What to do**:
  - In `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx`, replace custom stat cards with `Row gutter={[16, 16]}` and `Col` wrappers.
  - Render metrics through `MetricCard`.
  - Keep status colors aligned to token semantics for active/expiring/expired.
  - Preserve `if (collapsed) return null;` behavior.

  **Must NOT do**:
  - Do not alter `stats` object derivation in `SubscriptionsPage`.
  - Do not modify Expiring alert behavior.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: similar bounded refactor mirroring Licenses.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: layout/visual consistency across pages.
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: unnecessary for low-complexity UI migration.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 2)
  - **Blocks**: Task 4
  - **Blocked By**: Task 1

  **References**:
  - `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx:17` - collapse guard to preserve.
  - `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx:23` - current custom stats container to replace.
  - `apps/frontend/src/pages/subscriptions/index.tsx:384` - component integration point.
  - `apps/frontend/src/pages/subscriptions/index.tsx:272` - stats derivation source (must remain untouched).

  **Acceptance Criteria**:
  - [ ] `SubscriptionsStats` renders via `MetricCard` only.
  - [ ] Uses AntD `Row`/`Col` grid.
  - [ ] Collapse behavior preserved.

  **Manual Execution Verification**:
  - [ ] Navigate to Subscriptions page.
  - [ ] Toggle Stats collapse/expand and verify unchanged behavior.
  - [ ] Verify total/active/expiring/expired cards render correctly with expected visual hierarchy.

  **Commit**: NO

- [x] 4. Remove obsolete metric CSS classes and dead references

  **What to do**:
  - Delete these class blocks from `apps/frontend/src/pages/licenses/LicensesPage.module.css`:
    - `.stats`, `.statCard`, `.statValue`, `.statLabel`, `.statCardActive`, `.statCardExpired`, `.statCardWarning`
  - Delete same class blocks from `apps/frontend/src/pages/subscriptions/SubscriptionsPage.module.css`.
  - Ensure no TSX files still rely on removed classes.

  **Must NOT do**:
  - Do not remove unrelated classes (`filters`, `header`, table classes, alert classes).

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: constrained cleanup and verification task.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: avoids accidental removal of still-used visual classes.
  - **Skills Evaluated but Omitted**:
    - `writing`: no docs content work involved.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential finalize
  - **Blocks**: Final verification
  - **Blocked By**: Tasks 2, 3, 5

  **References**:
  - `apps/frontend/src/pages/licenses/LicensesPage.module.css:26` - first obsolete metric class block.
  - `apps/frontend/src/pages/subscriptions/SubscriptionsPage.module.css:32` - obsolete metric class block.
  - `apps/frontend/src/pages/licenses/page/LicensesStats.tsx:17` - current class usage to remove.
  - `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx:23` - current class usage to remove.

  **Acceptance Criteria**:
  - [ ] All listed classes removed from both CSS modules.
  - [ ] No references to removed class names remain in `src/pages/licenses/**` and `src/pages/subscriptions/**`.

  **Manual Execution Verification**:
  - [ ] Run grep checks for each deleted class name; expected 0 matches in target page trees.
  - [ ] Open both pages and confirm no missing-style regressions in non-stats sections.

  **Commit**: NO

- [x] 5. Dashboard metrics-row cleanup

  **What to do**:
  - In `apps/frontend/src/pages/dashboard/Dashboard.module.css`, remove `.metrics-row` class definition.
  - In `apps/frontend/src/pages/dashboard/index.tsx`, remove `className={cx('metrics-row')}` from metrics `Row` and keep spacing via inline style (`style={{ marginBottom: 24 }}`) if needed.
  - Do not change dashboard metrics data mapping.

  **Must NOT do**:
  - Do not alter metric list content/count unless broken by layout refactor.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: single-callsite class removal.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: preserve visual spacing after class removal.
  - **Skills Evaluated but Omitted**:
    - `git-master`: not required for code change.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: Task 4
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/pages/dashboard/index.tsx:140` - `Row` currently using className.
  - `apps/frontend/src/pages/dashboard/Dashboard.module.css:21` - `.metrics-row` definition to remove.
  - `apps/frontend/src/pages/dashboard/index.tsx:99` - metrics derivation must stay unchanged.

  **Acceptance Criteria**:
  - [ ] `.metrics-row` class removed from stylesheet.
  - [ ] Dashboard metrics `Row` no longer references `cx('metrics-row')`.
  - [ ] Equivalent spacing preserved visually.

  **Manual Execution Verification**:
  - [ ] Open Dashboard and confirm metrics row spacing vs bot list card remains correct.
  - [ ] Ensure metric cards still render without layout break.

  **Commit**: NO

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1-5 | `refactor(frontend): unify metric stats cards with shared AntD component` | `apps/frontend/src/components/ui/MetricCard.tsx`, `apps/frontend/src/pages/licenses/page/LicensesStats.tsx`, `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx`, `apps/frontend/src/pages/dashboard/index.tsx`, CSS module updates | `pnpm --filter @botmox/frontend typecheck && pnpm --filter @botmox/frontend build && pnpm --filter @botmox/frontend test:e2e` |

---

## Success Criteria

### Verification Commands

```bash
pnpm --filter @botmox/frontend typecheck
pnpm --filter @botmox/frontend build
pnpm --filter @botmox/frontend test:e2e
```

Expected:
- All commands exit successfully.
- No unresolved import/class errors after CSS/file deletions.

### Final Checklist
- [x] All requested files changed exactly in scope.
- [x] Deleted files/classes are physically absent and unreferenced.
- [x] Metric UI across Dashboard/Licenses/Subscriptions is consolidated on `MetricCard`.
- [x] AntD grid usage standardized as requested.
- [x] Visual checks passed on desktop and mobile widths.
