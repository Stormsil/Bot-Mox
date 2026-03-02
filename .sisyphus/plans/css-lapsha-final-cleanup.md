# CSS Lapsha Final Cleanup (Targeted)

## TL;DR
> **Summary**: Finish the missed CSS-to-AntD layout migration work in VM settingsForm, bot-profile UI hotspots, and resource pages (proxies/subscriptions/licenses) using strict class allowlists and compile-safe cleanup.
> **Deliverables**:
> - Remove/replace the user-listed layout classes and wrappers only
> - Migrate affected JSX wrappers to AntD `Flex`/`Space`/`Row`/`Col`
> - Resolve verified JSX↔CSS key mismatches in touched scope
> - Pass lint/typecheck/build and targeted Playwright suites
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: Task 1 -> Task 2/3/4/5 -> Task 6/7 -> Task 8

## Context
### Original Request
User reported the previous epic was partially complete and provided explicit files/classes still containing layout wrappers. User also provided a strict final-cleanup prompt and requested a hard check against remaining `display:flex` style patterns in listed layout classes.

### Interview Summary
- Scope is a focused continuation, not a redesign.
- Strict enforcement applies to listed problematic classes/files (not blanket removal across every class in each module).
- Migration target is AntD primitives (`Flex`, `Space`, `Row`, `Col`) with behavior/visual parity.

### Metis Review (gaps addressed)
- Added a phase-0 class allowlist and mismatch baseline to avoid scope drift.
- Added mandatory handling of compile-risk mismatches already present in touched files.
- Added route-targeted e2e gates beyond lint/typecheck.
- Added guardrails against blanket CSS deletion and unrelated feature changes.

## Work Objectives
### Core Objective
Complete the missed migration slice by replacing remaining wrapper-layout classes in explicitly reported areas, while preserving behavior, preserving visual parity, and keeping changes tightly scoped.

### Deliverables
- Updated TSX wrappers in:
  - `apps/frontend/src/widgets/vm/settingsForm/**`
  - `apps/frontend/src/widgets/bot-profile/ui/**` (targeted modules only)
  - `apps/frontend/src/pages/proxies/**`
  - `apps/frontend/src/pages/subscriptions/**`
  - `apps/frontend/src/pages/licenses/**`
- Pruned target CSS class declarations in listed modules.
- Compile-safe cleanup for missing/stale CSS keys in touched modules.
- Evidence artifacts under `.sisyphus/evidence/` for each task.

### Definition of Done (verifiable conditions with commands)
- `pnpm run lint` exits 0.
- `pnpm run check:types` exits 0.
- `pnpm --filter @botmox/frontend build` exits 0.
- Targeted e2e suites exit 0 for resource routes, bot profile route, and VM settings flow.

### Must Have
- Use `Flex` for one-dimensional wrapper replacement.
- Use `Row/Col` for simple two-column/grid rows that were previously pure layout wrappers.
- Preserve existing behavior and visual semantics.
- Keep changes limited to this plan scope.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No blanket CSS purge across entire modules.
- No business-logic/data-flow changes.
- No edits in unrelated pages/widgets.
- No migration of excluded complex systems (`TimelineVisualizer`, `ResourceTree`).
- No unverified deletion of classes still used for non-layout visuals.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after using existing lint/typecheck/build + targeted Playwright e2e.
- QA policy: Every task includes happy-path + failure/edge scenario with evidence output.
- Evidence: `.sisyphus/evidence/final-cleanup-task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Extract allowlist and mismatch baseline first, then execute domain slices in parallel.

Wave 1: Baseline and VM settings cleanup foundation.
Wave 2: Bot-profile cleanup slices + resource pages cleanup slices.
Wave 3: Hygiene normalization + global gates + evidence summary.

### Dependency Matrix (full, all tasks)
- T1 blocks T2-T7.
- T2-T5 can run in parallel after T1.
- T6 and T7 depend on T1 and can run in parallel with late bot-profile slices.
- T8 depends on T2-T7.

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 2 tasks -> `general`, `unspecified-high`
- Wave 2 -> 5 tasks -> `unspecified-high`, `quick`
- Wave 3 -> 1 task -> `general`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Build Class Allowlist and Mismatch Baseline

  **What to do**: Produce an explicit per-file allowlist of classes to migrate/prune and capture currently broken JSX↔CSS key references in scope (`text-primary`, `tableCard`, `table`, `resetButton` where applicable).
  **Must NOT do**: Do not edit product source files in this task.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: cross-scope analysis and baseline capture.
  - Skills: `[]` — Reason: no specialized skill needed.
  - Omitted: `frontend-ui-ux` — Reason: no design changes.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2,3,4,5,6,7 | Blocked By: none

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/SettingsSectionLayout.module.css` — target classes `.row`, `.rowSingle`, `.actions`, `.inlineRow`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotFinance.module.css` — `.cost-item`, `.roi-item`, `.transactions-header`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotLeveling.module.css` — `.xp-info`, `.location-info`, `.location-details`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/proxy.module.css` — `.proxy-string-container`, `.ipqs-*`, `.fraud-score-display`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotSummary.module.css` — `.status-item`, `.summary-stat-item`.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.module.css` — `.headerContent`, `.pageTitle`, `.headerActions`, `.filtersRow`, `.stats`.
  - Pattern: `apps/frontend/src/pages/subscriptions/SubscriptionsPage.module.css` — `.headerContent`, `.headerTitle`.
  - Pattern: `apps/frontend/src/pages/licenses/LicensesPage.module.css` — dead classes `.headerContent`, `.headerHeading`, `.headerSubtitle`.

  **Acceptance Criteria** (agent-executable only):
  - [x] Baseline artifact exists with per-file allowlist and class->JSX usage mapping.
  - [x] Baseline artifact contains compile-risk mismatch list for touched scope.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path allowlist completeness
    Tool: Bash
    Steps: Validate artifact exists and grep all target module paths in baseline report.
    Expected: All target modules are listed.
    Evidence: .sisyphus/evidence/final-cleanup-task-1-allowlist.txt

  Scenario: Failure/edge case mismatch omission
    Tool: Bash
    Steps: Grep baseline report for known mismatches (`text-primary|tableCard|table|resetButton`).
    Expected: All expected mismatch keys are documented.
    Evidence: .sisyphus/evidence/final-cleanup-task-1-mismatch-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/evidence/final-cleanup-task-1-*`

- [x] 2. Migrate VM settingsForm wrappers and prune listed layout classes

  **What to do**: Replace usage of listed wrappers in `ProxmoxSection.tsx`, `SshSection.tsx`, `ServiceUrlsSection.tsx`, `SecretField.tsx`, `SettingsActions.tsx` with AntD primitives (`Row/Col` for two-column rows, `Flex` for action/inline rows) and remove `.row`, `.rowSingle`, `.actions`, `.inlineRow` from `SettingsSectionLayout.module.css`.
  **Must NOT do**: Do not change field semantics, API calls, validation logic, or text content.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: multi-file wrapper migration with parity constraints.
  - Skills: `[]` — Reason: existing local patterns suffice.
  - Omitted: `artistry` — Reason: conventional refactor.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/SettingsSectionLayout.module.css` — source class definitions.
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/ProxmoxSection.tsx` — row wrappers and field groupings.
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/SshSection.tsx` — row/rowSingle wrappers.
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/ServiceUrlsSection.tsx` — row/rowSingle wrappers.
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/SecretField.tsx` — inline action wrappers.
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/SettingsActions.tsx` — action cluster wrappers.
  - External: `https://ant.design/components/grid/` — `Row`/`Col` responsive row mapping.
  - External: `https://ant.design/components/flex/` — `Flex` alignment and gap mapping.

  **Acceptance Criteria** (agent-executable only):
  - [x] Listed settingsForm classes are removed from CSS module and replaced with AntD wrapper usage.
  - [x] No layout inline style introduced for replaced wrappers.
  - [x] `pnpm run check:types` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path compile safety
    Tool: Bash
    Steps: Run `pnpm run check:types`.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/final-cleanup-task-2-typecheck.txt

  Scenario: Failure/edge case lingering wrappers
    Tool: Grep
    Steps: Search `SettingsSectionLayout.module.css` for `.(row|rowSingle|actions|inlineRow)\s*{`.
    Expected: No matches.
    Evidence: .sisyphus/evidence/final-cleanup-task-2-wrapper-error.txt
  ```

  **Commit**: YES | Message: `refactor(settings-form): replace remaining layout wrappers with antd primitives` | Files: `apps/frontend/src/widgets/vm/settingsForm/**`

- [x] 3. Finalize BotFinance and BotLeveling layout wrapper cleanup

  **What to do**: Replace targeted wrapper usage in `BotFinanceWidget.tsx` and `BotLevelingWidget.tsx` with AntD `Flex`/`Space`; prune listed layout classes in `BotFinance.module.css` and `BotLeveling.module.css` (and `lifeStages/lifeStages.module.css` if same keys are used there); fix `text-primary` key mismatch in touched scope.
  **Must NOT do**: Do not change financial calculations, leveling data logic, or labels.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: mixed TSX/CSS cleanup with mismatch fix.
  - Skills: `[]` — Reason: local pattern migration.
  - Omitted: `deep` — Reason: no architecture changes.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotFinanceWidget.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotFinance.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotLevelingWidget.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotLeveling.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/lifeStages/lifeStages.module.css`
  - External: `https://ant.design/components/flex/`

  **Acceptance Criteria** (agent-executable only):
  - [x] Target classes (`cost-item`, `roi-item`, `transactions-header`, `xp-info`, `location-info`, `location-details`) are removed or no longer layout-bearing for listed scope.
  - [x] No unresolved CSS key usage remains (`text-primary` fixed).
  - [x] `pnpm run check:types` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path bot-profile compile
    Tool: Bash
    Steps: Run `pnpm run check:types`.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/final-cleanup-task-3-typecheck.txt

  Scenario: Failure/edge case target class residue
    Tool: Grep
    Steps: Search target CSS files for `.(cost-item|roi-item|transactions-header|xp-info|location-info|location-details)\s*{`.
    Expected: No matches for migrated class allowlist.
    Evidence: .sisyphus/evidence/final-cleanup-task-3-class-error.txt
  ```

  **Commit**: YES | Message: `refactor(bot-profile): finalize finance and leveling layout cleanup` | Files: `apps/frontend/src/widgets/bot-profile/ui/{BotFinance*,BotLeveling*,lifeStages/*}`

- [x] 4. Finalize Bot Proxy layout wrapper cleanup

  **What to do**: Replace listed proxy wrappers with `Flex`/`Space` in `ProxyDetailsCard.tsx`, `ProxyEditorModal.tsx`, `ProxyIpqsResults.tsx`; prune listed layout classes in `proxy/proxy.module.css`.
  **Must NOT do**: Do not alter IPQS fetch behavior, edit/save logic, or status semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: several related components with shared CSS module.
  - Skills: `[]` — Reason: no external integration changes.
  - Omitted: `quick` — Reason: multi-file careful migration.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/ProxyDetailsCard.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/ProxyEditorModal.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/ProxyIpqsResults.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/proxy.module.css`
  - External: `https://ant.design/components/flex/`
  - External: `https://ant.design/components/space/`

  **Acceptance Criteria** (agent-executable only):
  - [x] Target proxy classes (`proxy-string-container`, `ipqs-loading`, `ipqs-results`, `ipqs-row`, `fraud-score-display`, `ipqs-flags`) are removed or no longer layout-bearing.
  - [x] Typecheck passes with no proxy CSS key regressions.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path proxy compile
    Tool: Bash
    Steps: Run `pnpm run check:types`.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/final-cleanup-task-4-typecheck.txt

  Scenario: Failure/edge case class residue
    Tool: Grep
    Steps: Search `proxy.module.css` for target class selectors in allowlist.
    Expected: No target selector matches.
    Evidence: .sisyphus/evidence/final-cleanup-task-4-class-error.txt
  ```

  **Commit**: YES | Message: `refactor(bot-profile): finalize proxy layout wrapper cleanup` | Files: `apps/frontend/src/widgets/bot-profile/ui/proxy/**`

- [x] 5. Finalize BotSummary targeted layout wrapper cleanup

  **What to do**: Migrate targeted summary wrappers for `.status-item` and `.summary-stat-item` flows to AntD layout primitives while preserving visual/state classes; prune layout declarations for those targets in `BotSummary.module.css`.
  **Must NOT do**: Do not alter summary navigation logic, clickable behavior, or status semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: shared CSS module used across several summary subcomponents.
  - Skills: `[]` — Reason: local pattern work.
  - Omitted: `artistry` — Reason: no visual redesign.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/summary/ResourceStatusCard.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/summary/stat-item.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotSummary.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/summary/SummaryConfigureLinkCard.tsx`
  - External: `https://ant.design/components/flex/`

  **Acceptance Criteria** (agent-executable only):
  - [x] Target summary classes are no longer carrying wrapper-layout responsibility in listed scope.
  - [x] No regressions in class usage for summary subcomponents.
  - [x] `pnpm run check:types` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path summary compile
    Tool: Bash
    Steps: Run `pnpm run check:types`.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/final-cleanup-task-5-typecheck.txt

  Scenario: Failure/edge case target selectors remain
    Tool: Grep
    Steps: Search `BotSummary.module.css` for `.(status-item|summary-stat-item)\s*{` and migrated layout declarations.
    Expected: No leftover target layout selectors per allowlist.
    Evidence: .sisyphus/evidence/final-cleanup-task-5-class-error.txt
  ```

  **Commit**: YES | Message: `refactor(bot-profile): finalize summary layout wrapper cleanup` | Files: `apps/frontend/src/widgets/bot-profile/ui/{BotSummary.module.css,summary/**}`

- [x] 6. Finalize Proxies page layout wrappers and stats grid migration

  **What to do**: Replace `headerTitle/pageTitle/headerActions/filtersRow` wrappers with `Flex`/`Space` in `ProxiesPage.tsx` and `ProxiesFiltersCard.tsx`; replace `.stats` CSS-grid wrapper with `Row/Col` in `ProxiesStatsCards.tsx`; prune targeted classes in `ProxiesPage.module.css`.
  **Must NOT do**: Do not change table columns/business actions or filter semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: coordinated TSX/CSS changes across page subcomponents.
  - Skills: `[]` — Reason: migration patterns already present in repo.
  - Omitted: `deep` — Reason: no architectural rewrite.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesFiltersCard.tsx`
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesStatsCards.tsx`
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.module.css`
  - External: `https://ant.design/components/flex/`
  - External: `https://ant.design/components/grid/`

  **Acceptance Criteria** (agent-executable only):
  - [x] Target proxies classes (`headerContent`, `pageTitle`, `headerActions`, `filtersRow`, `stats`) are migrated/pruned per allowlist.
  - [x] `ProxiesStatsCards.tsx` uses `Row/Col` for stats card layout.
  - [x] `pnpm run check:types` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path resource-route e2e
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend test:e2e -- e2e/refine-phase3-crud-wiring.spec.ts`.
    Expected: 0 failed tests.
    Evidence: .sisyphus/evidence/final-cleanup-task-6-e2e.txt

  Scenario: Failure/edge case lingering wrapper selectors
    Tool: Grep
    Steps: Search `ProxiesPage.module.css` for target selector definitions in allowlist.
    Expected: No target selector matches.
    Evidence: .sisyphus/evidence/final-cleanup-task-6-class-error.txt
  ```

  **Commit**: YES | Message: `refactor(resources): finalize proxies layout wrapper cleanup` | Files: `apps/frontend/src/pages/proxies/**`

- [x] 7. Finalize Subscriptions + Licenses header cleanup and dead-class removal

  **What to do**: Migrate Subscriptions header wrappers to `Flex/Space` and prune `headerContent/headerTitle` classes in `SubscriptionsPage.module.css`; remove dead `LicensesPage.module.css` header classes (`headerContent`, `headerHeading`, `headerSubtitle`) and resolve compile-risk key mismatches (`tableCard`, `table`, `resetButton`) in touched licenses scope.
  **Must NOT do**: Do not alter subscription/license CRUD behavior.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: mixed dead-code removal + wrapper migration + mismatch remediation.
  - Skills: `[]` — Reason: local deterministic cleanup.
  - Omitted: `quick` — Reason: regression-sensitive across two pages.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 8 | Blocked By: 1

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `apps/frontend/src/pages/subscriptions/index.tsx`
  - Pattern: `apps/frontend/src/pages/subscriptions/SubscriptionsPage.module.css`
  - Pattern: `apps/frontend/src/pages/licenses/index.tsx`
  - Pattern: `apps/frontend/src/pages/licenses/page/LicensesFiltersCard.tsx`
  - Pattern: `apps/frontend/src/pages/licenses/LicensesPage.module.css`
  - External: `https://ant.design/components/flex/`

  **Acceptance Criteria** (agent-executable only):
  - [x] Target subscriptions header classes are migrated/pruned.
  - [x] Dead licenses header classes are removed.
  - [x] Mismatch keys in touched licenses/subscriptions scope are resolved compile-safe.
  - [x] `pnpm run check:types` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path resource routes e2e
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend test:e2e -- e2e/refine-phase2-crud-baseline.spec.ts e2e/refine-phase3-crud-wiring.spec.ts`.
    Expected: 0 failed tests.
    Evidence: .sisyphus/evidence/final-cleanup-task-7-e2e.txt

  Scenario: Failure/edge case unresolved css keys
    Tool: Bash
    Steps: Run `pnpm run check:types` after cleanup.
    Expected: Exit code 0 and no CSS module key errors for subscriptions/licenses.
    Evidence: .sisyphus/evidence/final-cleanup-task-7-key-error.txt
  ```

  **Commit**: YES | Message: `refactor(resources): finalize subscriptions licenses header and dead-class cleanup` | Files: `apps/frontend/src/pages/{subscriptions,licenses}/**`

- [x] 8. Run final hygiene gates, targeted e2e matrix, and evidence index

  **What to do**: Run full gates and targeted route matrix; generate final evidence index tying tasks 1-8 outputs and confirming scope fidelity for this cleanup plan.
  **Must NOT do**: Do not mark complete on any non-zero gate.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: integration verification and reporting.
  - Skills: `[]` — Reason: command execution and evidence collation only.
  - Omitted: `test` — Reason: no new tests authored.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: none | Blocked By: 2,3,4,5,6,7

  **References** (executor has NO interview context — be exhaustive):
  - Pattern: `package.json` — root gates.
  - Pattern: `apps/frontend/package.json` — frontend gates.
  - Test: `apps/frontend/e2e/refine-phase2-crud-baseline.spec.ts`
  - Test: `apps/frontend/e2e/refine-phase3-crud-wiring.spec.ts`
  - Test: `apps/frontend/e2e/fsd-boundaries-migration.spec.ts`
  - Test: `apps/frontend/e2e/authenticated-shell.spec.ts`

  **Acceptance Criteria** (agent-executable only):
  - [x] `pnpm run lint` exits 0.
  - [x] `pnpm run check:types` exits 0.
  - [x] `pnpm --filter @botmox/frontend build` exits 0.
  - [x] Targeted Playwright suites exit 0.
  - [x] Final evidence index links all task evidence files and scope statement.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path final gates
    Tool: Bash
    Steps: Run `pnpm run lint && pnpm run check:types && pnpm --filter @botmox/frontend build`.
    Expected: All commands exit 0.
    Evidence: .sisyphus/evidence/final-cleanup-task-8-gates.txt

  Scenario: Failure/edge case route regressions
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend test:e2e -- e2e/refine-phase2-crud-baseline.spec.ts e2e/refine-phase3-crud-wiring.spec.ts e2e/fsd-boundaries-migration.spec.ts e2e/authenticated-shell.spec.ts`.
    Expected: 0 failed tests.
    Evidence: .sisyphus/evidence/final-cleanup-task-8-e2e-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/evidence/final-cleanup-task-8-*`

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- `refactor(settings-form): replace remaining layout wrappers with antd primitives`
- `refactor(bot-profile): finalize targeted layout wrapper cleanup`
- `refactor(resources): finalize proxies/subscriptions/licenses layout cleanup`
- `chore(frontend): finalize cleanup gates and evidence`

## Success Criteria
- All targeted user-reported classes are migrated/pruned per allowlist.
- No unresolved CSS module key usage in touched files.
- Lint/typecheck/build and targeted e2e all pass.
- No out-of-scope product files changed.
