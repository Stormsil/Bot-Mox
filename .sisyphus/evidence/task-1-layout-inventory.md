# Task 1 - Layout Migration Inventory and Allowlist

## Scope Baseline
- Areas covered: `apps/frontend/src/pages/settings/**`, `apps/frontend/src/pages/project/**`, `apps/frontend/src/pages/datacenter/**`, `apps/frontend/src/widgets/bot-profile/ui/**`.
- This artifact is an allowlist for layout-only migration to AntD primitives (`Flex`/`Space`/`Row`/`Col`), not a source-code change.
- Bot shell contract guardrail: preserve root `.bot-*` classes unless explicitly proven redundant in later tasks.

## Migration Primitive Mapping Rules
- Use `Flex` for one-dimensional wrappers (`display:flex`, `align-items`, `justify-content`, `flex-direction`, `gap`, `wrap`).
- Use `Space` for inline horizontal/vertical action clusters where item wrappers are acceptable.
- Use `Row`/`Col` for simple 2-column form/detail rows currently implemented as CSS grid/flex row wrappers.
- Keep complex responsive auto-fit grids in CSS when parity with `Row`/`Col` is uncertain.

## Settings Area Inventory

### `apps/frontend/src/pages/settings/SettingsPage.module.css` + related TSX
- **Migrate (layout-only):**
  - `settings-header` -> `Flex` (`SettingsPageHeader.tsx`).
  - `settings-column-stack` -> `Flex vertical` (`ProxyAndAlertsCards.tsx` and similar stacks).
  - `project-settings-list`, `project-settings-item-header`, `project-settings-item-title`, `project-settings-item-meta` -> `Flex`/`Row`+`Col` (`ProjectsCard.tsx`).
  - `theme-settings-toolbar`, `theme-quick-card-content`, `theme-quick-actions`, `theme-preset-row` -> `Flex`/`Space` (`ThemeSettingsPanel.tsx`, `ThemeQuickCard.tsx`, `ThemePresetPanel.tsx`).
  - `theme-color-row`, `theme-color-labels` -> `Flex`/`Space` (`ThemeColorsGrid.tsx`).
  - `theme-visual-row` -> `Flex`/`Space` (`ThemeVisualBackgroundCard.tsx`).
  - `theme-form-grid`, `theme-form-item` -> simple `Row`/`Col` and `Flex vertical` (`ThemeTypographyShapeCard.tsx`).
- **Keep (visual/non-layout):**
  - `settings-page`, `settings-card`, `settings-title`, `settings-title-icon`.
  - `project-settings-item`, `project-settings-empty`.
  - `theme-preset-panel`, `theme-preset-title`, `theme-preset-select`, `theme-preset-name-input`.
  - `theme-colors-grid` scrolling constraints (`max-height`, `overflow-y`) can remain CSS-bound if not moved to container component.
  - `theme-assets-list`, `theme-asset-thumb`, `theme-color-input`, `theme-visual-slider`.
- **Risk notes:** media-query behavior on `theme-color-row` and `project-settings-item-meta` must be matched when converting to `Flex`/`Row`/`Col`.

## Project Area Inventory

### `apps/frontend/src/pages/project/ProjectPage.module.css` + related TSX
- **Migrate (layout-only):**
  - `headerContent`, `headerTitle` -> `Flex` (`project/index.tsx`).
  - `rowActions` -> `Flex`/`Space` (`project/columns.tsx`).
  - `cellStack` -> `Flex vertical` (`project/columns.tsx` button wrappers).
- **Keep (visual/non-layout):**
  - `root`, `header`, `headerHeading`, `headerSubtitle`.
  - `stat*` classes, `secondary`, `id`, `statusTag`, `deleteButton`, `cellButton`, `cellLink`.
  - `filters*` sizing classes (`filterSearch`, `filterStatus`, `filtersSpace`) unless later replaced by pure AntD props.
- **Primitive recommendation:** `Flex` for header/actions/cell stack; optional `Space` for row actions if wrapper injection does not affect table-cell alignment.

## Datacenter Area Inventory

### `apps/frontend/src/pages/datacenter/DatacenterPageLayout.module.css` + `content-map*.tsx`
- **Migrate (layout-only):**
  - `loading-container` -> centered `Flex` (`index.tsx`).
  - `content-map`, `content-map-header`, `content-map-section`, `content-map-section-head` -> `Flex` wrappers.
  - `map-card-head`, `map-card-title`, `map-card-footer`, `map-card-meta--stack`, `map-notes-list`, `map-note-item` -> `Flex`/`Space`.
- **Keep (visual/non-layout):**
  - `content-map-title`, `content-map-subtitle`, `content-map-section-title`.
  - `map-card`, `map-card--clickable` visual states, `map-card-tag`, `map-note-title`, toggle focus/hover styling.
  - `content-map-grid` and modifiers if still needed for macro card placement.
- **Do-not-auto-convert from this file:**
  - `content-map-grid--projects`, `content-map-grid--primary`, `content-map-grid--resources` (`repeat(auto-fit, minmax(...))`) - keep CSS grid unless explicit parity plan is accepted.
- **Primitive recommendation:** `Flex` for wrappers, selective `Space` for compact metadata rows.

### `apps/frontend/src/pages/datacenter/DatacenterPageMetrics.module.css` + `content-map-sections*.tsx`
- **Migrate (layout-only):**
  - `map-stats-row`, `expiring-row`, `expiring-main`, `expiring-meta`, `map-kpi-lines` -> `Flex`.
  - `map-kpi-grid` -> `Row`/`Col` (simple 2-column KPI tiles).
  - `map-kpi`, `map-kpi-line` -> `Flex vertical` / `Row`+`Col` as needed.
- **Keep (visual/non-layout):**
  - `map-stat-chip*`, `map-stat-value`, `map-stat-label` color/state styling.
  - `expiring-tag*`, `expiring-name`, `expiring-bot`, `expiring-days*`, `expiring-date`, `expiring-empty`.
  - KPI typography/color classes (`map-kpi-label`, `map-kpi-value`, `map-kpi-line-*`).
- **Primitive recommendation:** `Flex` for rows/stacks; `Row`/`Col` for 2-column KPI structures.

## Bot-Profile Area Inventory

### Resource cluster (priority allowlist)

#### `apps/frontend/src/widgets/bot-profile/ui/proxy/proxy.module.css` + `proxy/ProxyDetailsCard.tsx`
- **Migrate (layout-only):** `proxy-content`, `proxy-row`, `proxy-field`, `proxy-string-container`, `fraud-score-container`, `expiration-info`, `ipqs-results`, `ipqs-row`, `ipqs-flags`, `ipqs-loading`.
- **Keep (visual/non-layout):** `bot-proxy`, `proxy-card`, `card-title*`, `proxy-string-field`, `proxy-string`, `field-label`, `empty-description`.
- **Primitive recommendation:** `Row`/`Col` for `proxy-row`; `Flex`/`Space` for remaining wrappers.

#### `apps/frontend/src/widgets/bot-profile/ui/license/license.module.css` + `license/LicenseViews.tsx`
- **Migrate (layout-only):** `license-content`, `license-row`, `license-field`, `license-key-container`, `expiration-info`.
- **Keep (visual/non-layout):** `bot-license`, `license-card`, `license-key`, `field-label`, `license-alert`, `license-actions`, `empty-description`.
- **Primitive recommendation:** `Row`/`Col` for each `license-row`; `Flex vertical` for `license-content`/`license-field`.

#### `apps/frontend/src/widgets/bot-profile/ui/subscription/subscription.module.css` + `subscription/SubscriptionListItem.tsx`
- **Migrate (layout-only):** `subscription-item-content`, `subscription-header`, `subscription-type`, `subscription-details`, `detail-row`.
- **Keep (visual/non-layout):** `bot-subscription`, `subscription-card`, `subscription-item`, `subscription-alert`, `item-alert`, `item-alert-message`, title/icon classes.
- **Primitive recommendation:** `Flex` for headers/details; use `Row`/`Col` only if standardizing `detail-row` into strict 2-column labels/values.

### Core bot-profile widgets (wave-3 allowlist)
- `apps/frontend/src/widgets/bot-profile/ui/BotSummary.module.css` + `BotSummaryWidget.tsx` and `summary/*.tsx`
  - **Migrate:** `bot-subtabs-layout`, `bot-subtabs-nav`, `summary-stats-grid`, `summary-stats-list`, `summary-stat-item`, `summary-stat-content`, `link-card-title`, `link-card-header`.
  - **Keep:** root `.bot-summary`, `.bot-section` contracts, interactive/focus visual classes (`active`, `clickable`, `link-card*` visuals, `detail-card-title`, `project-tag`).
  - **Primitive:** `Row`/`Col` for subtabs layout; `Flex`/`Space` elsewhere.
- `apps/frontend/src/widgets/bot-profile/ui/character/character.module.css` + `BotCharacterWidget.tsx` + `character/*.tsx`
  - **Migrate:** `character-card-header`, `loading-container`, `character-view-mode`, `character-header-section`, `character-avatar-section`, `character-title`, `character-stats-grid`, `stat-item`, `stat-content`, `level-display`, `character-name-actions`, `form-actions-row`, `form-actions-buttons`, `field-label`.
  - **Keep:** root `.bot-character`, color/icon/text/state classes, cards/alerts, responsive visual tokens.
  - **Primitive:** `Row`/`Col` for stats grid; `Flex` for all header/action wrappers.
- `apps/frontend/src/widgets/bot-profile/ui/person/person.module.css` + `BotPerson.tsx` + `person/*.tsx`
  - **Migrate:** `person-card-header`, `person-workflow-message`, `field-label`, `person-form-actions`, `generate-section`.
  - **Keep:** root `.bot-person`, warning/alert/save/unlock visual classes.
  - **Primitive:** `Flex` for wrappers; optional `Space` for compact control groups.
- `apps/frontend/src/widgets/bot-profile/ui/BotVMInfo.module.css` + `BotVMInfo.tsx`
  - **Migrate:** `vm-content`, `vm-field`.
  - **Keep:** root `.bot-vm-info`, `vm-card`, `vm-card-title`, `field-label`, `vm-ip`.
  - **Primitive:** `Flex vertical`.
- `apps/frontend/src/widgets/bot-profile/ui/BotSchedule.module.css` + `BotSchedule.tsx` + `BotScheduleContent.tsx` + `BotScheduleActions.tsx`
  - **Migrate:** `bot-schedule-loading`, `schedule-actions`, `schedule-content-wrapper`, `schedule-main-content`.
  - **Keep:** root `.bot-schedule`, `schedule-card*`, action button visual classes, `panel-block`, unsaved alert visuals.
  - **Primitive:** `Flex`/`Space` only.
- `apps/frontend/src/widgets/bot-profile/ui/lifeStages/lifeStages.module.css` + `BotLifeStagesWidget.tsx` + `lifeStages/Stage*.tsx`
  - **Migrate:** `loading`, `chart-bars`, `stage-selector-header`, `stage-selector-left`, `stage-option`, `xp-info`, `location-info`, `location-details`, `profession-header`, `skill-info`, `inventory-item`, `inventory-item-info`, `inventory-item-details`.
  - **Keep:** root `.bot-life-stages`, stage card visuals (`stage-selector-card`, `timeline-card`, `stage-stat-card`, `stage-detail-card`), animation/state classes (`stage-content`, `.active`, `.inactive`), typography/tag styling.
  - **Primitive:** `Flex` for wrappers; retain CSS grid/animations where behavioral.

## Exclusions / Do-Not-Auto-Convert
- `apps/frontend/src/widgets/schedule/TimelineVisualizer.tsx` cluster (including timeline internals/styles): interactive drag geometry, absolute positioning markers, pointer-event synchronization; no wrapper-level auto conversion.
- `apps/frontend/src/widgets/layout/ResourceTree.tsx` cluster (including `resourceTree/*` parts and sizing hooks): width-resizer behavior, tree node rendering, collapsed/expanded branch mechanics; no wrapper-level auto conversion.
- `apps/frontend/src/pages/datacenter/DatacenterPageLayout.module.css` auto-fit grid modifiers (`content-map-grid--projects`, `content-map-grid--primary`, `content-map-grid--resources`) remain CSS until a dedicated parity task.

## Potential CSS Module Deletion Candidates
- **Current status:** no full deletion candidates confirmed in this baseline.
- **Rationale:** every in-scope module still contains non-layout visual/state contracts (colors, borders, typography, hover/focus, tokenized status styling, root shell hooks).
- **Near-candidates after later waves (conditional):**
  - `apps/frontend/src/widgets/bot-profile/ui/BotVMInfo.module.css` if only global/shared visual tokens remain and root wrapper styling is absorbed elsewhere.
  - `apps/frontend/src/widgets/bot-profile/ui/BotSchedule.module.css` if schedule wrapper classes are fully replaced and remaining classes are merged into shared schedule components.
  - `apps/frontend/src/pages/project/ProjectPage.module.css` only if layout wrappers and size helpers move fully to component props without losing visual semantics.

## Allowlist Summary for Next Waves
- Start with deterministic wrappers: settings toolbar/rows, project header/actions, datacenter section/card heads, proxy/license/subscription rows.
- Preserve visual classes and root `.bot-*` shell classes in all bot-profile migrations.
- Treat excluded clusters and complex grids as out-of-scope for auto conversion.
