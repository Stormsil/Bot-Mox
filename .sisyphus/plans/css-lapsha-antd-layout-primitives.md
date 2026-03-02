# CSS Layout Cleanup via AntD Primitives

## TL;DR
> **Summary**: Replace routine CSS-module layout wrappers with Ant Design `Flex`/`Space`/`Row`/`Col` in targeted frontend areas, while preserving behavior and visual output.
> **Deliverables**:
> - Layout-wrapper migration across settings, datacenter, project, and bot-profile UI scope
> - CSS module cleanup with layout-only rules removed
> - Empty CSS module deletion + removed imports where applicable
> - Verification evidence for lint/typecheck and route-level QA scenarios
> **Effort**: XL
> **Parallel**: YES - 4 waves
> **Critical Path**: Task 1 -> Task 2/3/4 -> Task 8/9/10/11/12 -> Task 13/14/15

## Context
### Original Request
Aggressive refactor of UI layout layer: replace custom CSS flex/grid wrappers with AntD layout primitives; remove layout-only classes from `*.module.css`; do not touch complex absolute-positioned visual systems.

### Interview Summary
- Scope confirmed for `apps/frontend/src/pages/settings/**`, `apps/frontend/src/pages/datacenter/**`, `apps/frontend/src/pages/project/**`, and all eligible files under `apps/frontend/src/widgets/bot-profile/ui/**`.
- Grid policy fixed: simple grid rows must migrate to `Row`/`Col`.
- Verification baseline fixed: mandatory `pnpm run lint` and `pnpm run check:types`.
- Exclusions fixed: `apps/frontend/src/widgets/schedule/TimelineVisualizer.tsx` and `apps/frontend/src/widgets/layout/ResourceTree.tsx` (and related complex positioning internals).

### Metis Review (gaps addressed)
- Added guardrail to preserve bot-shell root class contracts (`.bot-*`) unless explicitly proven safe.
- Added guardrail to avoid forced conversion of complex `auto-fit/minmax` grids where parity is uncertain.
- Added executable QA expectations per task and evidence artifacts.
- Added progressive wave gates (`lint` + `typecheck`) after each implementation wave.

## Work Objectives
### Core Objective
Eliminate layout-only CSS wrappers in the target scope by migrating positioning/spacing semantics into AntD JSX primitives, with no functional regressions and no visual drift in key routes.

### Deliverables
- Migrated JSX wrappers using `Flex`, `Space`, `Row`, `Col`.
- Reduced layout-rule density in:
  - `apps/frontend/src/pages/settings/SettingsPage.module.css`
  - `apps/frontend/src/pages/project/ProjectPage.module.css`
  - `apps/frontend/src/pages/datacenter/DatacenterPageLayout.module.css`
  - `apps/frontend/src/pages/datacenter/DatacenterPageMetrics.module.css`
  - `apps/frontend/src/widgets/bot-profile/ui/**/*.module.css`
- Deleted empty CSS modules and removed dangling imports.
- Evidence files under `.sisyphus/evidence/` for each task.

### Definition of Done (verifiable conditions with commands)
- `pnpm run lint` exits with code 0.
- `pnpm run check:types` exits with code 0.
- `grep`-based checks in touched CSS modules show strong reduction of layout properties (`display:flex|grid`, `justify-content`, `align-items`, `gap`, `flex-direction`, `grid-template-columns`).
- No broken imports from removed CSS modules (validated by typecheck).

### Must Have
- Use AntD layout primitives for routine wrappers.
- Maintain existing interaction semantics (click/focus/keyboard behavior).
- Keep visual token styles in CSS (colors, borders, typography, specific dimensions).
- Keep scope tightly within requested directories.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No layout inline styles (`style={{ display: 'flex', ... }}`) as migration output.
- No commented-out dead CSS blocks.
- No refactor of excluded complex layout systems (`TimelineVisualizer`, `ResourceTree`).
- No accidental removal of root classes used by global spacing contracts in bot pages unless verified safe.
- No conversion of complex adaptive grid algorithms when `Row`/`Col` cannot preserve behavior without extra logic.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after using existing monorepo checks (`Biome` + `tsc`).
- QA policy: Every task includes executable happy-path + failure/edge scenario.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave where possible. Shared dependency setup extracted to Wave 1.

Wave 1: inventory + mapping + settings foundation + project foundation
Wave 2: datacenter + bot-profile resource modules (license/proxy/subscription)
Wave 3: bot-profile remaining wrappers + css cleanup/deletions
Wave 4: global verification + regression guards + final audits

### Dependency Matrix (full, all tasks)
- T1 blocks T2-T12 (defines migration inventory + allowlist).
- T2 blocks T3 (settings TSX migration precedes settings CSS pruning).
- T4 blocks T5 (project TSX migration precedes project CSS pruning).
- T6 blocks T7 (datacenter TSX migration precedes datacenter CSS pruning).
- T8 blocks T9 (resource TSX migration precedes resource CSS pruning).
- T10 blocks T11 (bot-profile TSX migration precedes broad CSS pruning).
- T8 and T10 block T12 (import/dead-class cleanup after both migration streams).
- T3/T5/T7/T9/T11/T12 block T13 (empty css deletion and import cleanup).
- T13 blocks T14-T15 (final property-density audit + quality gates).

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 4 tasks -> `general`, `unspecified-high`, `quick`
- Wave 2 -> 4 tasks -> `unspecified-high`, `quick`
- Wave 3 -> 4 tasks -> `unspecified-high`, `quick`
- Wave 4 -> 3 tasks -> `general`, `deep`, `quick`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task has Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Build Layout Migration Inventory and Allowlist

  **What to do**: Scan all target TSX/CSS files and produce a concrete per-file list of layout-only classes to migrate vs visual-only classes to keep. Include explicit exclusions (`TimelineVisualizer`, `ResourceTree`) and bot root-class preservation notes.
  **Must NOT do**: Do not modify source files in this task; do not include files outside target directories.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: broad analysis across multiple areas.
  - Skills: `[]` - Reason: no special skill required.
  - Omitted: `frontend-ui-ux` - Reason: no visual redesign work.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 2,3,4,5,6,8,11 | Blocked By: none

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/settings/SettingsPage.module.css` - high layout density baseline.
  - Pattern: `apps/frontend/src/pages/project/ProjectPage.module.css` - header/action wrappers.
  - Pattern: `apps/frontend/src/pages/datacenter/DatacenterPageLayout.module.css` - content-map wrapper layout.
  - Pattern: `apps/frontend/src/pages/datacenter/DatacenterPageMetrics.module.css` - metrics row wrappers.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/proxy.module.css` - `proxy-row` pattern.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/license/license.module.css` - `license-content`/`license-row` pattern.
  - API/Type: `apps/frontend/src/pages/datacenter/datacenterUi.ts` - merged css binder contract.
  - External: `https://ant.design/components/flex/` - flex primitive API.

  **Acceptance Criteria** (agent-executable only):
- [x] Inventory artifact exists at `.sisyphus/evidence/task-1-layout-inventory.md` with per-file class decisions and exclusion list.
- [x] Inventory includes all four top-level target areas and marks migration candidates.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path inventory coverage
    Tool: Bash
    Steps: Validate artifact presence and grep target area headings in `.sisyphus/evidence/task-1-layout-inventory.md`.
    Expected: All target areas listed with candidate classes.
    Evidence: .sisyphus/evidence/task-1-layout-inventory.txt

  Scenario: Failure/edge case exclusion guard
    Tool: Bash
    Steps: Grep inventory for `TimelineVisualizer` and `ResourceTree` exclusion entries.
    Expected: Both exclusions explicitly present.
    Evidence: .sisyphus/evidence/task-1-layout-inventory-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/evidence/task-1-layout-inventory.md`

- [x] 2. Migrate Settings Header and Card-Level Wrappers to AntD Primitives

  **What to do**: In settings page TSX files, replace layout wrappers (`settings-header`, `settings-column-stack`, `project-settings-item-header`, `theme-*-row`, `theme-color-row`, `theme-form-grid`, `theme-form-item`) with `Flex`/`Space`/`Row`/`Col` props; keep visual classes only.
  **Must NOT do**: Do not change business logic, data hooks, or card content semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: multiple files with careful parity requirements.
  - Skills: `[]` - Reason: existing patterns are local.
  - Omitted: `test` - Reason: no new unit tests required for this styling refactor.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 5 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/settings/ThemeQuickCard.tsx` - toolbar/action row wrappers.
  - Pattern: `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx` - toolbar + hint grouping.
  - Pattern: `apps/frontend/src/pages/settings/themeSections/ThemePresetPanel.tsx` - repeated preset rows.
  - Pattern: `apps/frontend/src/pages/settings/themeSections/ThemeVisualBackgroundCard.tsx` - repeated visual rows and slider wrappers.
  - Pattern: `apps/frontend/src/pages/settings/themeSections/ThemeColorsGrid.tsx` - color row and labels layout.
  - Pattern: `apps/frontend/src/pages/settings/sections/ProjectsCard.tsx` - project item header/meta wrappers.
  - API/Type: `apps/frontend/src/pages/settings/sections/classNames.ts` - css class binding helper.
  - Test: `apps/frontend/src/pages/settings/SettingsPage.tsx` - integration entrypoint for smoke render.
  - External: `https://ant.design/components/space/` - spacing primitive caveats.

  **Acceptance Criteria** (agent-executable only):
- [x] Target settings TSX files use AntD primitives for migrated wrappers.
- [x] No layout inline styles are introduced.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path settings render
    Tool: Bash
    Steps: Run `pnpm run check:types` after settings TSX updates.
    Expected: Exit code 0; no TS errors from settings pages.
    Evidence: .sisyphus/evidence/task-2-settings-typecheck.txt

  Scenario: Failure/edge case inline-style guard
    Tool: Grep
    Steps: Search updated settings files for `style={{` combined with layout keys (`display|alignItems|justifyContent|gap|flexDirection`).
    Expected: No new layout inline-style matches.
    Evidence: .sisyphus/evidence/task-2-settings-inline-style-error.txt
  ```

  **Commit**: YES | Message: `refactor(settings): migrate layout wrappers to antd primitives` | Files: `apps/frontend/src/pages/settings/**`

- [x] 3. Reduce Settings CSS Module to Visual-Only Rules

  **What to do**: Remove migrated layout-only declarations from `SettingsPage.module.css`; keep colors, borders, typography, dimensions, and responsive visual tokens that still apply.
  **Must NOT do**: Do not remove classes still referenced by TSX for non-layout styling.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: concentrated CSS cleanup in one module.
  - Skills: `[]` - Reason: straightforward property pruning.
  - Omitted: `frontend-ui-ux` - Reason: visual design unchanged.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 13 | Blocked By: 2

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/settings/SettingsPage.module.css` - source CSS cleanup target.
  - Pattern: `apps/frontend/src/pages/settings/SettingsPage.tsx` - root class usage.
  - Pattern: `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx` - classes that must remain bound.

  **Acceptance Criteria** (agent-executable only):
- [x] `SettingsPage.module.css` retains no unnecessary `display:flex|grid`, `justify-content`, `align-items`, `gap`, `flex-direction` for migrated wrappers.
- [x] `pnpm run check:types` passes after cleanup.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path CSS density reduction
    Tool: Grep
    Steps: Count layout properties in `apps/frontend/src/pages/settings/SettingsPage.module.css` post-change.
    Expected: Significant reduction versus pre-migration baseline documented in evidence.
    Evidence: .sisyphus/evidence/task-3-settings-css-density.txt

  Scenario: Failure/edge case missing class detection
    Tool: Bash
    Steps: Run `pnpm run check:types` to detect stale class import references.
    Expected: Exit code 0; no missing class/property binding errors.
    Evidence: .sisyphus/evidence/task-3-settings-css-error.txt
  ```

  **Commit**: YES | Message: `refactor(settings): prune layout-only css module rules` | Files: `apps/frontend/src/pages/settings/SettingsPage.module.css`

- [x] 4. Refactor Project Page Header and Row Actions Wrappers

  **What to do**: Replace `headerContent`, `headerTitle`, and `rowActions` wrapper layout from CSS-module classes to `Flex`/`Space` primitives in `project/index.tsx` and `project/columns.tsx`.
  **Must NOT do**: Do not change table data logic, filters behavior, or deletion flow.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: TSX layout refactor across page and columns renderer.
  - Skills: `[]` - Reason: local and deterministic updates.
  - Omitted: `deep` - Reason: no architecture redesign.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 7 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/project/index.tsx` - header wrappers and filter strip.
  - Pattern: `apps/frontend/src/pages/project/columns.tsx` - `rowActions` action cell wrapper.
  - Pattern: `apps/frontend/src/pages/project/ProjectPage.module.css` - class source for removal decisions.
  - External: `https://ant.design/components/flex/` - `align`/`justify`/`gap`/`wrap` mapping.

  **Acceptance Criteria** (agent-executable only):
- [x] Project TSX no longer depends on CSS layout classes for migrated wrappers.
- [x] `pnpm run check:types` passes.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path project page compile
    Tool: Bash
    Steps: Run `pnpm run check:types` with project page changes.
    Expected: Exit code 0 and no type regressions in project module.
    Evidence: .sisyphus/evidence/task-4-project-typecheck.txt

  Scenario: Failure/edge case keyboard/click semantics
    Tool: Bash
    Steps: Run existing lint checks to catch invalid interactive structure regressions in table action renderers.
    Expected: `pnpm run lint` exits 0.
    Evidence: .sisyphus/evidence/task-4-project-interaction-error.txt
  ```

  **Commit**: YES | Message: `refactor(project): move header and action wrappers to antd flex` | Files: `apps/frontend/src/pages/project/index.tsx`, `apps/frontend/src/pages/project/columns.tsx`

- [x] 5. Prune Project CSS Layout Rules

  **What to do**: Remove layout-only CSS declarations from `ProjectPage.module.css` that are now handled by AntD primitives (`headerContent`, `headerTitle`, `rowActions`, `cellStack` where migrated).
  **Must NOT do**: Do not remove status color classes or typography classes (`stat*`, `secondary`, `id`, etc.) that remain visual.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: single-module cleanup.
  - Skills: `[]` - Reason: deterministic declaration removal.
  - Omitted: `review` - Reason: full review handled in final verification wave.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 13 | Blocked By: 4

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/project/ProjectPage.module.css` - cleanup source.
  - Pattern: `apps/frontend/src/pages/project/index.tsx` - resulting class usage.
  - Pattern: `apps/frontend/src/pages/project/columns.tsx` - resulting class usage.

  **Acceptance Criteria** (agent-executable only):
- [x] Layout-only property count in `ProjectPage.module.css` is reduced versus baseline.
- [x] No className references break typecheck.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path CSS cleanup
    Tool: Grep
    Steps: Count layout properties in `apps/frontend/src/pages/project/ProjectPage.module.css` post-change.
    Expected: Lower count than baseline and no reintroduced wrapper rules.
    Evidence: .sisyphus/evidence/task-5-project-css-density.txt

  Scenario: Failure/edge case stale classes
    Tool: Bash
    Steps: Run `pnpm run check:types`.
    Expected: Exit code 0; no unresolved class bindings.
    Evidence: .sisyphus/evidence/task-5-project-css-error.txt
  ```

  **Commit**: YES | Message: `refactor(project): remove layout-only css module rules` | Files: `apps/frontend/src/pages/project/ProjectPage.module.css`

- [x] 6. Migrate Datacenter Header/Section/Card Wrapper Layouts

  **What to do**: In `content-map.tsx`, `content-map-sections.tsx`, and `content-map-sections-secondary.tsx`, replace routine wrapper layout classes (`content-map-header`, `content-map-section-head`, `map-card-head`, `map-card-footer`, `map-stats-row`, `expiring-row`) with `Flex`/`Space`/`Row`/`Col` where behavior is simple and predictable.
  **Must NOT do**: Do not alter data calculations, navigation callbacks, or card interaction semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: many repeated wrappers across multiple files.
  - Skills: `[]` - Reason: no external integration changes.
  - Omitted: `artistry` - Reason: conventional migration required.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 9 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/datacenter/content-map.tsx` - top-level header wrapper.
  - Pattern: `apps/frontend/src/pages/datacenter/content-map-sections.tsx` - repeated stats and card wrappers.
  - Pattern: `apps/frontend/src/pages/datacenter/content-map-sections-secondary.tsx` - expiring and KPI wrappers.
  - API/Type: `apps/frontend/src/pages/datacenter/datacenterUi.ts` - combined css binding must remain valid.
  - External: `https://ant.design/components/grid/` - Row/Col responsive behavior.

  **Acceptance Criteria** (agent-executable only):
- [x] Datacenter TSX wrappers use AntD layout primitives for migrated sections.
- [x] Existing click/keyboard navigation behavior is preserved.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path datacenter build safety
    Tool: Bash
    Steps: Run `pnpm run check:types` after datacenter TSX migration.
    Expected: Exit code 0 and no datacenter type regressions.
    Evidence: .sisyphus/evidence/task-6-datacenter-typecheck.txt

  Scenario: Failure/edge case interactive card behavior
    Tool: Bash
    Steps: Run `pnpm run lint` to catch semantic/interaction regressions from wrapper changes.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/task-6-datacenter-interaction-error.txt
  ```

  **Commit**: YES | Message: `refactor(datacenter): migrate content map wrappers to antd layout` | Files: `apps/frontend/src/pages/datacenter/content-map*.tsx`

- [x] 7. Prune Datacenter CSS Layout Rules

  **What to do**: Remove layout-only declarations now migrated from `DatacenterPageLayout.module.css` and `DatacenterPageMetrics.module.css`; preserve non-layout visual/brand/state styles.
  **Must NOT do**: Do not remove classes needed for color/status states and non-layout visual tokens.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused css cleanup after migration.
  - Skills: `[]` - Reason: property pruning is straightforward.
  - Omitted: `frontend-ui-ux` - Reason: no redesign.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 13 | Blocked By: 6

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/datacenter/DatacenterPageLayout.module.css` - main layout wrappers.
  - Pattern: `apps/frontend/src/pages/datacenter/DatacenterPageMetrics.module.css` - metric row wrappers.
  - API/Type: `apps/frontend/src/pages/datacenter/datacenterUi.ts` - class merge contract for remaining names.

  **Acceptance Criteria** (agent-executable only):
- [x] Layout property density reduced in both datacenter css modules.
- [x] `pnpm run check:types` passes with no missing class keys.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path datacenter css reduction
    Tool: Grep
    Steps: Count layout properties in both datacenter css modules.
    Expected: Significant reduction compared to baseline evidence.
    Evidence: .sisyphus/evidence/task-7-datacenter-css-density.txt

  Scenario: Failure/edge case class merge breakage
    Tool: Bash
    Steps: Run `pnpm run check:types`.
    Expected: Exit code 0 and no `cx(...)` class-key errors.
    Evidence: .sisyphus/evidence/task-7-datacenter-css-error.txt
  ```

  **Commit**: YES | Message: `refactor(datacenter): remove migrated layout css rules` | Files: `apps/frontend/src/pages/datacenter/DatacenterPageLayout.module.css`, `apps/frontend/src/pages/datacenter/DatacenterPageMetrics.module.css`

- [x] 8. Migrate Bot-Profile Resource Detail Wrappers (Proxy/License/Subscription)

  **What to do**: Refactor routine layout wrappers in bot-profile resource components (priority: `proxy/ProxyDetailsCard.tsx`, `license/LicenseViews.tsx`, `subscription/SubscriptionListItem.tsx`) to AntD primitives; enforce grid->Row/Col for simple 2-column rows.
  **Must NOT do**: Do not change resource data rendering logic, actions, or status semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: high-density wrappers with many fields and rows.
  - Skills: `[]` - Reason: local UI migration.
  - Omitted: `deep` - Reason: no architecture redesign.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 10,12 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/ProxyDetailsCard.tsx` - `proxy-row`, `proxy-content`, `proxy-field` wrappers.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/license/LicenseViews.tsx` - `license-content`, `license-row`, `license-actions` wrappers.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/subscription/SubscriptionListItem.tsx` - detail rows and content wrappers.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/proxy.module.css` - corresponding css class definitions.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/license/license.module.css` - corresponding css class definitions.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/subscription/subscription.module.css` - corresponding css class definitions.

  **Acceptance Criteria** (agent-executable only):
- [x] Simple 2-column row wrappers in resource details use `Row`/`Col` with explicit gutter.
- [x] No layout inline styles introduced.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path resource module compile
    Tool: Bash
    Steps: Run `pnpm run check:types` after resource wrapper migration.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/task-8-resource-typecheck.txt

  Scenario: Failure/edge case no-inline-layout regression
    Tool: Grep
    Steps: Search touched resource files for `style={{` with layout keys.
    Expected: No layout inline-style matches.
    Evidence: .sisyphus/evidence/task-8-resource-inline-style-error.txt
  ```

  **Commit**: YES | Message: `refactor(bot-profile): migrate proxy license subscription layout wrappers` | Files: `apps/frontend/src/widgets/bot-profile/ui/proxy/**`, `apps/frontend/src/widgets/bot-profile/ui/license/**`, `apps/frontend/src/widgets/bot-profile/ui/subscription/**`

- [x] 9. Prune Bot-Profile Resource CSS Modules

  **What to do**: Remove migrated layout-only declarations from `proxy.module.css`, `license.module.css`, and `subscription.module.css`; preserve visual/status classes.
  **Must NOT do**: Do not delete classes still used for non-layout visuals or state indicators.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused CSS cleanup in three modules.
  - Skills: `[]` - Reason: deterministic property deletion.
  - Omitted: `frontend-ui-ux` - Reason: no redesign required.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 13 | Blocked By: 8

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/proxy.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/license/license.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/subscription/subscription.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/ProxyDetailsCard.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/license/LicenseViews.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/subscription/SubscriptionListItem.tsx`

  **Acceptance Criteria** (agent-executable only):
- [x] Layout-property count drops in all three resource CSS modules.
- [x] Typecheck confirms no missing class bindings.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path css property reduction
    Tool: Grep
    Steps: Count layout properties in resource css modules after cleanup.
    Expected: Reduced counts with class coverage retained.
    Evidence: .sisyphus/evidence/task-9-resource-css-density.txt

  Scenario: Failure/edge case stale css class references
    Tool: Bash
    Steps: Run `pnpm run check:types`.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/task-9-resource-css-error.txt
  ```

  **Commit**: YES | Message: `refactor(bot-profile): prune resource css layout rules` | Files: `apps/frontend/src/widgets/bot-profile/ui/{proxy,license,subscription}/*.module.css`

- [x] 10. Migrate Bot-Profile Core Widget Wrappers (Summary/Character/Person/VM/Schedule/LifeStages/etc.)

  **What to do**: Across `apps/frontend/src/widgets/bot-profile/ui/**`, migrate routine wrapper layout classes in core widgets to AntD primitives, prioritizing files with highest layout density and preserving root `.bot-*` class hooks where required.
  **Must NOT do**: Do not rewrite complex visualization flow in timeline content and do not remove root classes if global spacing depends on them.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: wide scope and many files.
  - Skills: `[]` - Reason: codebase-local patterns are sufficient.
  - Omitted: `artistry` - Reason: conventional migration with parity constraints.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 11,12 | Blocked By: 1

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotSummaryWidget.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotCharacterWidget.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotPerson.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotVMInfo.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotSchedule.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotLifeStagesWidget.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/character/CharacterViewMode.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/person/PersonFormFields.tsx`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/lifeStages/Stage*.tsx`
  - Exclusion: `apps/frontend/src/widgets/schedule/TimelineVisualizer.tsx`

  **Acceptance Criteria** (agent-executable only):
- [x] Routine layout wrappers in eligible bot-profile files are migrated to AntD primitives.
- [x] Root `.bot-*` class hooks remain where needed for shell spacing compatibility.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path bot-profile compilation
    Tool: Bash
    Steps: Run `pnpm run check:types` after core bot-profile migration.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/task-10-bot-profile-typecheck.txt

  Scenario: Failure/edge case excluded complex widget touched
    Tool: Grep
    Steps: Check git diff/evidence list to ensure `TimelineVisualizer.tsx` and `ResourceTree.tsx` unchanged.
    Expected: No changes in excluded files.
    Evidence: .sisyphus/evidence/task-10-bot-profile-exclusion-error.txt
  ```

  **Commit**: YES | Message: `refactor(bot-profile): migrate core widget layout wrappers to antd` | Files: `apps/frontend/src/widgets/bot-profile/ui/**`

- [x] 11. Prune Bot-Profile Remaining CSS Modules (Non-Resource)

  **What to do**: Remove layout-only rules from remaining bot-profile CSS modules (`BotSummary.module.css`, `character.module.css`, `lifeStages.module.css`, `person.module.css`, `BotSchedule.module.css`, `BotVMInfo.module.css`, etc.) where TSX migration replaced wrappers.
  **Must NOT do**: Do not remove visual/state/animation rules or classes still required by unaffected components.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: many CSS modules with mixed concerns.
  - Skills: `[]` - Reason: scope-specific cleanup.
  - Omitted: `deep` - Reason: no system-level design required.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 13 | Blocked By: 10

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotSummary.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/character/character.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/lifeStages/lifeStages.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/person/person.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotSchedule.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotVMInfo.module.css`

  **Acceptance Criteria** (agent-executable only):
- [x] Layout properties in touched non-resource bot-profile CSS modules are reduced materially.
- [x] `pnpm run check:types` passes with no missing style references.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path broad css cleanup
    Tool: Grep
    Steps: Count layout property density in touched bot-profile css modules.
    Expected: Reduced counts relative to baseline evidence.
    Evidence: .sisyphus/evidence/task-11-bot-profile-css-density.txt

  Scenario: Failure/edge case over-deletion
    Tool: Bash
    Steps: Run `pnpm run check:types`.
    Expected: Exit code 0; no missing CSS module key errors.
    Evidence: .sisyphus/evidence/task-11-bot-profile-css-error.txt
  ```

  **Commit**: YES | Message: `refactor(bot-profile): remove remaining layout-only css rules` | Files: `apps/frontend/src/widgets/bot-profile/ui/**/*.module.css`

- [x] 12. Normalize AntD Layout Primitive Imports and Class Binding Cleanup

  **What to do**: Ensure all touched files import only needed AntD primitives (`Flex`, `Space`, `Row`, `Col`) and remove obsolete className usage/imports resulting from migrated wrappers.
  **Must NOT do**: Do not remove CSS imports from files that still require visual classes.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: mostly import and dead-reference cleanup.
  - Skills: `[]` - Reason: mechanical consistency pass.
  - Omitted: `review` - Reason: audit happens in final wave.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 13 | Blocked By: 8,10

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/project/index.tsx` - current AntD import style.
  - Pattern: `apps/frontend/src/pages/datacenter/content-map-sections.tsx` - card + layout import patterns.
  - Pattern: `apps/frontend/src/pages/settings/**` - class binding via `bindCssModuleCx`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/**` - CSS module import usage across nested folders.

  **Acceptance Criteria** (agent-executable only):
- [x] No unused imports or stale class references remain in touched files.
- [x] `pnpm run lint` and `pnpm run check:types` both pass.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path hygiene gate
    Tool: Bash
    Steps: Run `pnpm run lint && pnpm run check:types`.
    Expected: Both commands exit 0.
    Evidence: .sisyphus/evidence/task-12-hygiene-gate.txt

  Scenario: Failure/edge case stale module imports
    Tool: Bash
    Steps: Run typecheck after temporarily reviewing changed import diff.
    Expected: No unresolved style import errors.
    Evidence: .sisyphus/evidence/task-12-import-error.txt
  ```

  **Commit**: YES | Message: `chore(frontend): normalize antd layout imports and remove dead class refs` | Files: `apps/frontend/src/pages/**`, `apps/frontend/src/widgets/bot-profile/ui/**`

- [x] 13. Delete Empty CSS Modules and Remove Dead Imports

  **What to do**: Identify `*.module.css` files in scope that became empty/useless after migration; delete them and remove corresponding imports/usages in TSX.
  **Must NOT do**: Do not delete CSS files that still contain visual or state-related rules.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: targeted delete and import cleanup.
  - Skills: `[]` - Reason: straightforward hygiene operation.
  - Omitted: `deep` - Reason: no complex reasoning needed.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: 14,15 | Blocked By: 3,5,7,9,11,12

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/settings/**/*.module.css`
  - Pattern: `apps/frontend/src/pages/project/**/*.module.css`
  - Pattern: `apps/frontend/src/pages/datacenter/**/*.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/**/*.module.css`

  **Acceptance Criteria** (agent-executable only):
- [x] No empty CSS modules remain in target scope.
- [x] Typecheck confirms no broken/dead CSS imports.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path empty-file cleanup
    Tool: Bash
    Steps: Detect zero-rule css modules in target scope and verify none remain after cleanup.
    Expected: No empty/whitespace-only `*.module.css` files in scope.
    Evidence: .sisyphus/evidence/task-13-empty-css-cleanup.txt

  Scenario: Failure/edge case import breakage
    Tool: Bash
    Steps: Run `pnpm run check:types`.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/task-13-empty-css-error.txt
  ```

  **Commit**: YES | Message: `chore(frontend): remove empty css modules after layout migration` | Files: `apps/frontend/src/pages/**`, `apps/frontend/src/widgets/bot-profile/ui/**`

- [x] 14. Run Global Layout-Reduction Audit and Scope Guard Validation

  **What to do**: Produce final quantitative audit comparing layout-property density before/after in all target CSS modules; validate excluded files were untouched and out-of-scope directories unchanged.
  **Must NOT do**: Do not expand implementation scope during audit.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: cross-scope validation and guardrail enforcement.
  - Skills: `[]` - Reason: no special repository framework required.
  - Omitted: `frontend-ui-ux` - Reason: this is compliance/audit work.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: 15 | Blocked By: 13

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/settings/SettingsPage.module.css`
  - Pattern: `apps/frontend/src/pages/project/ProjectPage.module.css`
  - Pattern: `apps/frontend/src/pages/datacenter/DatacenterPageLayout.module.css`
  - Pattern: `apps/frontend/src/pages/datacenter/DatacenterPageMetrics.module.css`
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/**/*.module.css`
  - Exclusion: `apps/frontend/src/widgets/schedule/TimelineVisualizer.tsx`
  - Exclusion: `apps/frontend/src/widgets/layout/ResourceTree.tsx`

  **Acceptance Criteria** (agent-executable only):
- [x] Audit artifact exists with before/after counts and % reduction per target group.
- [x] Exclusion compliance section confirms excluded files unchanged.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path reduction evidence
    Tool: Bash
    Steps: Generate and save property-count comparison report across target CSS modules.
    Expected: Report saved with computed reductions and totals.
    Evidence: .sisyphus/evidence/task-14-layout-reduction-audit.md

  Scenario: Failure/edge case scope violation
    Tool: Bash
    Steps: Verify changed-file list does not include excluded complex widgets.
    Expected: No excluded file paths in change set.
    Evidence: .sisyphus/evidence/task-14-scope-violation-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/evidence/task-14-layout-reduction-audit.md`

- [x] 15. Execute Final Quality Gates and Produce Execution Summary

  **What to do**: Run mandatory gates (`pnpm run lint`, `pnpm run check:types`), capture outputs, and publish final execution summary linking all evidence artifacts.
  **Must NOT do**: Do not mark done if either mandatory gate fails.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: final integration verification and reporting.
  - Skills: `[]` - Reason: standard command execution and reporting.
  - Omitted: `test` - Reason: no test authoring required.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: none | Blocked By: 13,14

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `package.json` - root scripts.
  - Pattern: `apps/frontend/package.json` - frontend script context.
  - External: `https://ant.design/components/flex/` - final API conformance check reference.

  **Acceptance Criteria** (agent-executable only):
- [x] `pnpm run lint` exits 0.
- [x] `pnpm run check:types` exits 0.
- [x] Final summary artifact links all task evidence files.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Happy path mandatory gates
    Tool: Bash
    Steps: Run `pnpm run lint && pnpm run check:types`.
    Expected: Both commands succeed with exit code 0.
    Evidence: .sisyphus/evidence/task-15-final-gates.txt

  Scenario: Failure/edge case gate regression
    Tool: Bash
    Steps: Capture and store failing output if either command fails.
    Expected: Non-zero output stored and task remains incomplete until fixed.
    Evidence: .sisyphus/evidence/task-15-final-gates-error.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/evidence/task-15-final-gates.txt`

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit - oracle
- [x] F2. Code Quality Review - unspecified-high
- [x] F3. Real Manual QA - unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check - deep

## Commit Strategy
- Commit in domain slices to reduce rollback blast radius:
  - `refactor(settings): migrate layout wrappers to antd primitives`
  - `refactor(project-datacenter): replace css layout wrappers with antd layout`
  - `refactor(bot-profile): migrate ui layout wrappers and prune css modules`
  - `chore(frontend): remove empty css modules after layout migration`

## Success Criteria
- Layout-property usage in targeted CSS modules reduced by at least ~40% overall.
- Key target classes from epic (`proxy-row`, `license-content`, header/toolbar/action wrappers) are removed or reduced to non-layout styling only.
- No TypeScript or lint regressions.
- Scope exclusions preserved and verified.
