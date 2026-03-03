# UI Kit Final Polish - Strict Design-System Closure

## TL;DR
> **Summary**: Close the remaining design-system debt by removing legacy `--boxmox-*` usage, eliminating HEX hardcodes in frontend business layers, normalizing status/tag semantics, and enforcing AntD visual-import isolation by lint.
> **Deliverables**:
> - Zero `--boxmox-` usage in target scopes (with controlled bridge removal)
> - Zero HEX literals in `pages/widgets/features` except explicit allowlist
> - Status/tag rendering unified through semantic wrappers/tokens
> - ESLint hard gate for visual `antd` imports outside `src/shared/ui/**`
> **Effort**: Large
> **Parallel**: YES - 4 waves
> **Critical Path**: 1 -> 2 -> 6 -> 9 -> 10

## Context
### Original Request
- Complete UI Kit refactor to 100% by fixing `--boxmox -> --botmox`, removing HEX hardcodes, replacing direct `Tag color` usage with semantic wrappers, and adding ESLint isolation so visual AntD imports cannot bypass `shared/ui`.

### Interview Summary
- Scope confirmed to include `apps/frontend/src/**` and `packages/ui-kit/**` for prefix cleanup.
- ESLint exception policy confirmed: outside `src/shared/ui/**`, only `message`, `theme`, and `App` are allowed from `antd`; visual components must be blocked.
- Test philosophy confirmed: tests-after plus strict static quality and architecture gates (not tests-only confidence).

### Metis Review (gaps addressed)
- Added mandatory staged sequencing with stop/rollback gates per wave.
- Added temporary prefix compatibility bridge with explicit removal criteria.
- Added chart persisted-config sanitation requirement (prevent HEX reintroduction from saved settings).
- Added status-semantic central mapping requirement to prevent color drift across surfaces.
- Added hard acceptance commands for prefix, HEX, import isolation, lint/type/build.

## Work Objectives
### Core Objective
- Enforce a strict, future-proof design-system contract where theme tokens and semantic wrappers are the only UI styling source in business layers.

### Deliverables
- Prefix migration completed and legacy bridge removed.
- HEX hardcodes removed from target scopes with explicit exception list.
- Recharts colors derived from tokens (with SSR-safe strategy).
- Status/tag usage migrated to semantic wrappers.
- ESLint restrictions enforced for visual AntD imports outside shared UI.
- Evidence artifacts per task under `.sisyphus/evidence/`.

### Definition of Done (verifiable conditions with commands)
- `grep -R --line-number --fixed-strings "--boxmox-" apps/frontend/src packages/ui-kit/src` returns 0 matches.
- `grep -R --line-number -E "#[0-9a-fA-F]{3,6}\\b" apps/frontend/src/pages apps/frontend/src/widgets apps/frontend/src/features` returns 0 matches except explicit allowlist file `apps/frontend/src/features/wow-data/config/colors.ts`.
- `pnpm --filter @botmox/frontend lint` fails when visual `antd` imports are added outside `src/shared/ui/**` and passes for repository-compliant code.
- `pnpm --filter @botmox/frontend typecheck` passes.
- `pnpm --filter @botmox/frontend build` passes.

### Must Have
- No business-layer direct visual imports from `antd` outside `src/shared/ui/**`.
- No direct `Tag color="..."` semantics in pages/widgets/features where semantic wrappers are available.
- Recharts token usage must be SSR-safe (no hydration mismatch).
- All migration checks reproducible via commands.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No scope expansion into backend/agent modules.
- No broad stylistic rewrites unrelated to design-system closure.
- No fabricated selectors or unverifiable acceptance checks.
- No permanent compatibility alias left after completion.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + static quality gates.
- QA policy: every task includes happy/failure QA scenarios and evidence artifact.
- Evidence naming: `.sisyphus/evidence/task-{N}-{slug}.txt` and `.sisyphus/evidence/task-{N}-{slug}-error.txt`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. Shared dependencies are extracted to Wave 1.

- Wave 1 (Foundation): Tasks 1-5
- Wave 2 (Color + charts): Tasks 6-8
- Wave 3 (Semantics + lint): Tasks 9-11
- Wave 4 (Ratchet + final cleanup): Tasks 12-13

### Dependency Matrix (full, all tasks)
- 1 blocks 2, 3, 4, 6.
- 2 blocks 6 and 9.
- 3 blocks 6.
- 4 blocks 10.
- 5 blocks 10 and 11.
- 6 blocks 7 and 8.
- 7 blocks 12.
- 8 blocks 12.
- 9 blocks 11 and 12.
- 10 blocks 11.
- 11 blocks 12.
- 12 blocks 13.
- 13 blocks Final Verification Wave.

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 5 tasks -> `deep` + `quick` (mechanical + boundary checks)
- Wave 2 -> 3 tasks -> `deep` (color/chart migration)
- Wave 3 -> 3 tasks -> `deep` + `unspecified-high` (semantics + lint policy)
- Wave 4 -> 2 tasks -> `unspecified-high` (ratchet + closure)

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Freeze Baseline Scans and Exception Registry

  **What to do**: Run and snapshot baseline scans for `--boxmox-`, HEX literals, direct `antd` imports, and `Tag/Badge color` usage in target scopes; create explicit exception registry (only `apps/frontend/src/features/wow-data/config/colors.ts` for HEX and temporary bridge file for prefix during wave execution).
  **Must NOT do**: Do not modify non-target directories; do not silently add extra exception files.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: requires precise baseline/exception contract to prevent scope creep.
  - Skills: `[]` - baseline grep + evidence workflow is sufficient.
  - Omitted: `frontend-ui-ux` - not a design task.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 2,3,4,6 | Blocked By: none

  **References**:
  - Pattern: `apps/frontend/src/**` - migration scope.
  - Pattern: `packages/ui-kit/src/tokens.ts` - legacy prefix source.
  - Pattern: `.sisyphus/evidence/task-*.txt` - evidence convention.

  **Acceptance Criteria**:
  - [x] `grep -R --line-number --fixed-strings "--boxmox-" apps/frontend/src packages/ui-kit/src` baseline saved to `.sisyphus/evidence/task-1-prefix-baseline.txt`.
  - [x] `grep -R --line-number -E "#[0-9a-fA-F]{3,6}\\b" apps/frontend/src/pages apps/frontend/src/widgets apps/frontend/src/features` baseline saved to `.sisyphus/evidence/task-1-hex-baseline.txt`.
  - [x] exception registry saved to `.sisyphus/evidence/task-1-exceptions.md`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Baseline creation succeeds
    Tool: Bash
    Steps: Run all baseline grep commands and write outputs to evidence files
    Expected: All evidence files exist and contain non-empty scan output
    Evidence: .sisyphus/evidence/task-1-baseline.txt

  Scenario: Unexpected exception introduced
    Tool: Bash
    Steps: Compare exception registry against grep outputs
    Expected: Any unregistered exception path fails task with explicit list
    Evidence: .sisyphus/evidence/task-1-baseline-error.txt
  ```

  **Commit**: YES | Message: `chore(ui-kit): freeze migration baseline and exceptions` | Files: `.sisyphus/evidence/task-1-*`

- [x] 2. Introduce Temporary Prefix Compatibility Bridge

  **What to do**: Add a temporary bridge that maps legacy `--boxmox-*` references to `--botmox-*` equivalents at root token layer so partial migration does not break rendering mid-wave.
  **Must NOT do**: Do not keep bridge as final state; bridge must be explicitly removable in Task 13.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: token contract safety.
  - Skills: `[]` - direct CSS/token edits.
  - Omitted: `test` - no new test harness required.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: 3,6 | Blocked By: 1

  **References**:
  - Pattern: `apps/frontend/src/styles/variables.css` - root CSS token declarations.
  - Pattern: `apps/frontend/src/theme/themePalette.ts` - runtime token application.
  - Pattern: `packages/ui-kit/src/tokens.ts` - token export alignment.

  **Acceptance Criteria**:
  - [x] bridge file/section exists and maps legacy prefix to canonical tokens.
  - [x] `pnpm --filter @botmox/frontend build` passes with bridge enabled.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Bridge protects intermediate migration
    Tool: Bash
    Steps: Build frontend immediately after adding bridge
    Expected: Build succeeds without CSS variable resolution errors
    Evidence: .sisyphus/evidence/task-2-bridge.txt

  Scenario: Bridge mapping typo
    Tool: Bash
    Steps: Run grep for legacy vars without mapped canonical target
    Expected: Task fails and reports unmapped variables
    Evidence: .sisyphus/evidence/task-2-bridge-error.txt
  ```

  **Commit**: YES | Message: `refactor(theme): add temporary boxmox compatibility bridge` | Files: `apps/frontend/src/styles/variables.css`, `packages/ui-kit/src/tokens.ts`

- [x] 3. Execute Global Prefix Migration (`--boxmox-` -> `--botmox-`)

  **What to do**: Mechanically replace all `var(--boxmox-` and string token usages with `var(--botmox-` in `apps/frontend/src/**` and `packages/ui-kit/**`; include `.tsx/.ts/.module.css` occurrences.
  **Must NOT do**: Do not alter unrelated naming conventions or business logic.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: broad, high-volume mechanical migration.
  - Skills: `[]` - search/replace and verification only.
  - Omitted: `artistry` - no unconventional approach needed.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 6,9 | Blocked By: 1,2

  **References**:
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotSummary.module.css` - hotspot file.
  - Pattern: `apps/frontend/src/pages/project/ProjectPage.module.css` - hotspot file.
  - Pattern: `apps/frontend/src/features/vm-management/ui/DeleteVmModalLayout.module.css` - hotspot file.
  - Pattern: `apps/frontend/src/widgets/vm/VMQueuePanelCore.module.css` - hotspot file.

  **Acceptance Criteria**:
  - [x] `grep -R --line-number --fixed-strings "--boxmox-" apps/frontend/src packages/ui-kit/src` returns only temporary bridge file(s).
  - [x] migration evidence diff saved to `.sisyphus/evidence/task-3-prefix-migration.txt`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Prefix migration complete
    Tool: Bash
    Steps: Run global grep and verify only allowlisted bridge hits remain
    Expected: Zero non-allowlisted matches
    Evidence: .sisyphus/evidence/task-3-prefix-migration.txt

  Scenario: Missed hotspot file
    Tool: Bash
    Steps: Grep explicit hotspot files for --boxmox-
    Expected: No matches; otherwise task fails
    Evidence: .sisyphus/evidence/task-3-prefix-migration-error.txt
  ```

  **Commit**: YES | Message: `refactor(theme): migrate legacy boxmox prefix to botmox` | Files: `apps/frontend/src/**`, `packages/ui-kit/**`

- [x] 4. Remove Stale Prefix Aliases and Dead Token Paths

  **What to do**: Remove stale alias code and dead token references left after migration, keeping only canonical `--botmox-*` paths; verify no unresolved CSS variable references remain.
  **Must NOT do**: Do not remove bridge yet if non-zero legacy usage remains.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cleanup requires judgment with token/runtime paths.
  - Skills: `[]` - static analysis focus.
  - Omitted: `quick` - not trivial due to runtime coupling.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 10,13 | Blocked By: 1,3

  **References**:
  - Pattern: `apps/frontend/src/theme/themeRuntime.tsx` - runtime token entrypoint.
  - Pattern: `apps/frontend/src/theme/themePalette.definitions.ts` - token definitions.
  - Pattern: `apps/frontend/src/styles/variables.css` - canonical CSS variable set.

  **Acceptance Criteria**:
  - [x] no unresolved token references in frontend build output.
  - [x] `pnpm --filter @botmox/frontend typecheck` passes after cleanup.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Dead alias cleanup safe
    Tool: Bash
    Steps: Run typecheck and frontend build after cleanup
    Expected: Both commands exit 0
    Evidence: .sisyphus/evidence/task-4-alias-cleanup.txt

  Scenario: Alias removed too early
    Tool: Bash
    Steps: Search for unresolved var(--boxmox-) or missing --botmox references in changed files
    Expected: Any unresolved reference fails task
    Evidence: .sisyphus/evidence/task-4-alias-cleanup-error.txt
  ```

  **Commit**: YES | Message: `chore(theme): remove stale prefix aliases and dead tokens` | Files: `apps/frontend/src/theme/**`, `apps/frontend/src/styles/variables.css`

- [x] 5. Baseline and Partition Direct `antd` Imports by Category

  **What to do**: Build categorized inventory: visual components vs allowed utility imports (`message`, `theme`, `App`) vs type-only imports; produce target migration list for visual-only enforcement.
  **Must NOT do**: Do not enable eslint hard-fail yet.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: boundary-sensitive categorization drives lint policy.
  - Skills: `[]` - grep/AST inventory.
  - Omitted: `git-master` - no git operation required.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: 11 | Blocked By: 1

  **References**:
  - Pattern: `apps/frontend/eslint.config.js` - existing no-restricted-imports baseline.
  - Pattern: `apps/frontend/src/shared/ui/index.ts` - wrapper layer boundary.
  - Pattern: `apps/frontend/src/App.tsx` - known visual import tail.

  **Acceptance Criteria**:
  - [x] categorized report saved to `.sisyphus/evidence/task-5-antd-import-catalog.md`.
  - [x] every visual import outside `src/shared/ui/**` has mapped migration target.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Import catalog generated
    Tool: Bash
    Steps: Run grep/AST scans and classify entries into visual/utility/type-only
    Expected: Report includes path, import symbol, and target action for each entry
    Evidence: .sisyphus/evidence/task-5-antd-import-catalog.txt

  Scenario: Unclassified import remains
    Tool: Bash
    Steps: Re-scan and diff against catalog
    Expected: Any uncategorized entry fails task
    Evidence: .sisyphus/evidence/task-5-antd-import-catalog-error.txt
  ```

  **Commit**: YES | Message: `chore(lint): catalog direct antd imports for isolation migration` | Files: `.sisyphus/evidence/task-5-*`

- [x] 6. Remove HEX Hardcodes from `pages/widgets/features` (Allowed Exception Only)

  **What to do**: Replace hardcoded HEX literals in CSS/TS/TSX under `apps/frontend/src/pages`, `apps/frontend/src/widgets`, `apps/frontend/src/features` with semantic tokens; keep only approved exception `apps/frontend/src/features/wow-data/config/colors.ts`.
  **Must NOT do**: Do not introduce new HEX literals; do not change WoW domain palette semantics in the exception file.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: broad replacements across style + component code.
  - Skills: `[]` - scan-driven migration.
  - Omitted: `artistry` - deterministic migration.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 7,8,12 | Blocked By: 1,3

  **References**:
  - Pattern: `apps/frontend/src/pages/project/ProjectPage.module.css` - status HEX hotspot.
  - Pattern: `apps/frontend/src/pages/proxies/proxyColumns.tsx` - inline HEX hotspot.
  - Pattern: `apps/frontend/src/widgets/schedule/DayTabs.module.css` - CSS HEX hotspot.

  **Acceptance Criteria**:
  - [x] `grep -R --line-number -E "#[0-9a-fA-F]{3,6}\\b" apps/frontend/src/pages apps/frontend/src/widgets apps/frontend/src/features | grep -v "apps/frontend/src/features/wow-data/config/colors.ts"` returns 0.
  - [x] evidence saved to `.sisyphus/evidence/task-6-hex-cleanup.txt`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: HEX cleanup complete
    Tool: Bash
    Steps: Run scoped grep and exception filter
    Expected: No remaining HEX outside approved file
    Evidence: .sisyphus/evidence/task-6-hex-cleanup.txt

  Scenario: Accidental HEX reintroduction
    Tool: Bash
    Steps: Re-run grep after migration edits
    Expected: Non-zero match count fails task with offending paths
    Evidence: .sisyphus/evidence/task-6-hex-cleanup-error.txt
  ```

  **Commit**: YES | Message: `refactor(ui): replace hardcoded hex literals with semantic tokens` | Files: `apps/frontend/src/pages/**`, `apps/frontend/src/widgets/**`, `apps/frontend/src/features/**`

- [x] 7. Refactor `GoldPriceChart` to Token-Driven Recharts Colors

  **What to do**: Replace all hardcoded chart colors in `GoldPriceChart.tsx` with theme token values using `var(--botmox-..., fallback)`; keep SSR-safe initial render and avoid hydration mismatches.
  **Must NOT do**: Do not introduce browser-only token reads during render path.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: chart rendering + theme token compatibility.
  - Skills: `[]` - implementation references are straightforward.
  - Omitted: `visual-engineering` - task is token wiring, not design creation.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: 12 | Blocked By: 6

  **References**:
  - Pattern: `apps/frontend/src/widgets/finance/GoldPriceChart.tsx` - target file.
  - Pattern: `apps/frontend/src/theme/themeRuntime.tsx` - token runtime source.
  - External: `https://github.com/recharts/recharts/blob/841fc2e4e7ff0fb94f2d564ac93f10466115a3d9/www/src/docs/exampleComponents/LineChart/TinyLineChart.tsx` - CSS var usage in Recharts.

  **Acceptance Criteria**:
  - [x] no `stroke="#..."` or `fill="#..."` remains in `GoldPriceChart.tsx`.
  - [x] chart compiles and renders with tokenized colors in build.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Tokenized chart lines render
    Tool: Bash
    Steps: Build frontend and grep GoldPriceChart for hardcoded stroke/fill hex attributes
    Expected: Build passes and grep returns zero hardcoded chart color attrs
    Evidence: .sisyphus/evidence/task-7-gold-chart.txt

  Scenario: Hydration-risk pattern introduced
    Tool: Bash
    Steps: Search for getComputedStyle usage in render body of GoldPriceChart
    Expected: No browser-only API usage outside effect/hook guard
    Evidence: .sisyphus/evidence/task-7-gold-chart-error.txt
  ```

  **Commit**: YES | Message: `refactor(charts): migrate gold price chart colors to design tokens` | Files: `apps/frontend/src/widgets/finance/GoldPriceChart.tsx`

- [x] 8. Refactor `UniversalChart` with Semantic Palette + Persisted Config Sanitation

  **What to do**: Replace default HEX palette in `UniversalChart.tsx` with semantic token palette; ensure persisted config values are sanitized so legacy HEX does not bypass design-system policy.
  **Must NOT do**: Do not break user config loading; do not persist invalid/non-semantic color values after migration.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: includes persistence compatibility and sanitization logic.
  - Skills: `[]` - focused refactor.
  - Omitted: `quick` - not trivial.

  **Parallelization**: Can Parallel: NO | Wave 2 | Blocks: 12 | Blocked By: 6

  **References**:
  - Pattern: `apps/frontend/src/widgets/finance/UniversalChart.tsx` - default config + save path.
  - Pattern: `apps/frontend/src/entities/finance/api/chartConfig.ts` - persisted chart config IO.
  - External: `https://developer.mozilla.org/en-US/docs/Web/CSS/var` - fallback var syntax.

  **Acceptance Criteria**:
  - [x] `DEFAULT_CONFIG` contains no hardcoded HEX values.
  - [x] sanitation path converts/rejects legacy HEX persisted values.
  - [x] build/typecheck pass.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Legacy config sanitized
    Tool: Bash
    Steps: Simulate/read persisted config path and verify output palette values are semantic/token-based
    Expected: No raw HEX emitted to chart render config
    Evidence: .sisyphus/evidence/task-8-universal-chart.txt

  Scenario: Invalid config slips through
    Tool: Bash
    Steps: Inject malformed/HEX entries in test fixture path and run sanitizer
    Expected: Sanitizer normalizes or rejects invalid values deterministically
    Evidence: .sisyphus/evidence/task-8-universal-chart-error.txt
  ```

  **Commit**: YES | Message: `refactor(charts): enforce semantic palette and config sanitation` | Files: `apps/frontend/src/widgets/finance/UniversalChart.tsx`, `apps/frontend/src/entities/finance/api/chartConfig.ts`

- [x] 9. Migrate Direct `Tag/Badge` Color Strings to Semantic Wrapper Usage

  **What to do**: Replace direct color literals/semantic strings on tag/badge outputs in pages/widgets/features with wrapper-based semantics (`AppTag`/`StatusBadge` + token-backed classes).
  **Must NOT do**: Do not keep raw `Tag color="green|red|..."` in business components.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: touches many business views and status outputs.
  - Skills: `[]` - wrapper migration pattern is established.
  - Omitted: `frontend-ui-ux` - not redesign work.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: 11,12 | Blocked By: 3,6

  **References**:
  - Pattern: `apps/frontend/src/pages/proxies/proxyColumns.tsx` - explicit target.
  - Pattern: `apps/frontend/src/widgets/vm/vmListColumns.tsx` - explicit target.
  - Pattern: `apps/frontend/src/widgets/finance/FinanceTransactions.tsx` - table/status target.
  - Pattern: `apps/frontend/src/shared/ui/AppTag/AppTag.tsx` - wrapper behavior.
  - Pattern: `apps/frontend/src/shared/ui/StatusBadge.tsx` - semantic badge baseline.

  **Acceptance Criteria**:
  - [x] `grep -R --line-number -E "<Tag[^>]*\\bcolor=|<Badge[^>]*\\bcolor=" apps/frontend/src/pages apps/frontend/src/widgets apps/frontend/src/features` returns 0 non-allowlisted business matches.
  - [x] key files listed in references use wrapper semantics.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Tag migration complete in business layers
    Tool: Bash
    Steps: Run scoped grep for direct Tag/Badge color usage
    Expected: No direct color usage in pages/widgets/features
    Evidence: .sisyphus/evidence/task-9-tag-semantics.txt

  Scenario: Residual direct color usage
    Tool: Bash
    Steps: Validate target files (proxyColumns/vmListColumns/finance tables)
    Expected: Any direct color attr fails task and lists line
    Evidence: .sisyphus/evidence/task-9-tag-semantics-error.txt
  ```

  **Commit**: YES | Message: `refactor(ui): migrate status tags and badges to semantic wrappers` | Files: `apps/frontend/src/pages/**`, `apps/frontend/src/widgets/**`, `apps/frontend/src/features/**`

- [x] 10. Introduce Canonical Status-to-Semantic Mapping Contract

  **What to do**: Centralize status semantics mapping (success/warning/error/info/default) and ensure consumers (tables, summary cards, resource tree status) derive display color intent via this contract.
  **Must NOT do**: Do not change API/domain status values; map presentation only.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-module semantic alignment.
  - Skills: `[]` - architecture-level consolidation.
  - Omitted: `quick` - multi-surface refactor.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 11,12 | Blocked By: 4,5,9

  **References**:
  - Pattern: `apps/frontend/src/shared/ui/StatusBadge.tsx` - target semantic API.
  - Pattern: `apps/frontend/src/widgets/layout/resourceTree/types.ts` - current status color map.
  - Pattern: `apps/frontend/src/pages/subscriptions/subscription-columns.tsx` - status mapping consumer.
  - Pattern: `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx` - status mapping consumer.

  **Acceptance Criteria**:
  - [x] shared mapping module exists and is imported by key consumers.
  - [x] no duplicated ad-hoc status color maps remain in key target files.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Shared status mapping adopted
    Tool: Bash
    Steps: Grep for known local colorMap patterns in target files and verify shared import usage
    Expected: Local duplicate maps removed/replaced
    Evidence: .sisyphus/evidence/task-10-status-contract.txt

  Scenario: Domain status behavior altered
    Tool: Bash
    Steps: Compare status enum/string values before and after migration in API-facing files
    Expected: No domain value changes; only presentation mapping changed
    Evidence: .sisyphus/evidence/task-10-status-contract-error.txt
  ```

  **Commit**: YES | Message: `refactor(ui): centralize status semantic mapping contract` | Files: `apps/frontend/src/shared/**`, consumer files

- [x] 11. Enforce ESLint Isolation for Visual AntD Imports Outside `shared/ui`

  **What to do**: Extend `apps/frontend/eslint.config.js` with `no-restricted-imports` rules that block visual imports from `antd` and deep visual paths (`antd/es/*`, `antd/lib/*`) outside `src/shared/ui/**`; allow only `message`, `theme`, `App` outside shared/ui; fix resulting violations.
  **Must NOT do**: Do not block allowed utility imports (`message`, `theme`, `App`) or shared/ui internal visual imports.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: lint policy + migration coupling.
  - Skills: `[]` - config and refactor.
  - Omitted: `test` - gate is lint/static.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: 12 | Blocked By: 5,9,10

  **References**:
  - Pattern: `apps/frontend/eslint.config.js` - rule target.
  - Pattern: `apps/frontend/src/shared/ui/**` - allowed visual import zone.
  - External: `https://eslint.org/docs/latest/rules/no-restricted-imports` - rule semantics.

  **Acceptance Criteria**:
  - [x] adding `import { Card } from 'antd'` in non-shared-ui file triggers lint error message `Use AppCard from shared/ui instead`.
  - [x] `pnpm --filter @botmox/frontend lint` passes on repository state after migration.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Isolation gate works
    Tool: Bash
    Steps: Run frontend lint after enabling rule
    Expected: Existing code passes; synthetic forbidden import fails with custom message
    Evidence: .sisyphus/evidence/task-11-eslint-isolation.txt

  Scenario: Allowed imports are over-blocked
    Tool: Bash
    Steps: Verify files using message/theme/App still lint-clean
    Expected: No false positives for allowlisted utilities
    Evidence: .sisyphus/evidence/task-11-eslint-isolation-error.txt
  ```

  **Commit**: YES | Message: `chore(lint): enforce visual antd import isolation outside shared-ui` | Files: `apps/frontend/eslint.config.js`, migrated frontend files

- [x] 12. Add CI Ratchet Checks for Prefix/HEX/Tag Regression

  **What to do**: Add/extend repository guard scripts and CI command wiring so regressions are blocked: no `--boxmox-`, no unauthorized HEX in target scopes, no direct business-layer `Tag/Badge color` usage.
  **Must NOT do**: Do not make checks flaky or environment-dependent.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: guardrail design + CI integration.
  - Skills: `[]` - script policy work.
  - Omitted: `quick` - quality gate design is non-trivial.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: 13 | Blocked By: 7,8,9,10,11

  **References**:
  - Pattern: `scripts/check-style-token-usage.js` - existing token guard baseline.
  - Pattern: `scripts/check-style-guardrails.js` - style guard baseline.
  - Pattern: `package.json` - check command wiring.

  **Acceptance Criteria**:
  - [x] policy checks run via a single deterministic command.
  - [x] policy check fails on synthetic regression input and passes on compliant state.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Ratchet passes on compliant code
    Tool: Bash
    Steps: Run configured policy command(s) from package scripts
    Expected: Exit code 0, clear pass output
    Evidence: .sisyphus/evidence/task-12-ratchet.txt

  Scenario: Ratchet catches regression
    Tool: Bash
    Steps: Validate command against known violation pattern scan
    Expected: Non-zero with explicit violation details
    Evidence: .sisyphus/evidence/task-12-ratchet-error.txt
  ```

  **Commit**: YES | Message: `chore(ci): add strict design-system regression ratchet checks` | Files: `scripts/**`, `package.json`

- [x] 13. Remove Temporary Bridge and Run Final Strict Verification Sweep

  **What to do**: Remove temporary `--boxmox` compatibility bridge, run full strict verification (`lint`, `typecheck`, `build`, grep policy checks), collect final evidence, and update plan checkboxes.
  **Must NOT do**: Do not leave legacy bridge/allowlist debt except explicitly approved WoW file exception.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: final closure and quality gate synthesis.
  - Skills: `[]` - verification orchestration.
  - Omitted: `deep` - execution-heavy closure phase.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: Final Verification Wave | Blocked By: 4,12

  **References**:
  - Pattern: `apps/frontend/src/styles/variables.css` - bridge removal.
  - Pattern: `.sisyphus/plans/ui-kit-final-polish.md` - checkbox completion.
  - Pattern: `.sisyphus/evidence/task-13-final-verification.txt` - final proof.

  **Acceptance Criteria**:
  - [x] `grep -R --line-number --fixed-strings "--boxmox-" apps/frontend/src packages/ui-kit/src` returns 0.
  - [x] `grep -R --line-number -E "#[0-9a-fA-F]{3,6}\\b" apps/frontend/src/pages apps/frontend/src/widgets apps/frontend/src/features | grep -v "apps/frontend/src/features/wow-data/config/colors.ts"` returns 0.
  - [x] `pnpm --filter @botmox/frontend lint && pnpm --filter @botmox/frontend typecheck && pnpm --filter @botmox/frontend build` all pass.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```
  Scenario: Final strict sweep passes
    Tool: Bash
    Steps: Run full command set and save outputs
    Expected: All commands pass and plan tasks 1-13 can be marked complete
    Evidence: .sisyphus/evidence/task-13-final-verification.txt

  Scenario: Legacy debt remains after bridge removal
    Tool: Bash
    Steps: Run prefix/hex/tag scans post-removal
    Expected: Any residual debt fails task with file-level diagnostics
    Evidence: .sisyphus/evidence/task-13-final-verification-error.txt
  ```

  **Commit**: YES | Message: `chore(ui-kit): finalize strict design-system polish and remove bridge` | Files: `apps/frontend/src/**`, `packages/ui-kit/**`, `scripts/**`, `.sisyphus/evidence/**`

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit - oracle
- [x] F2. Code Quality Review - unspecified-high
- [x] F3. Real Manual QA - unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check - deep

## Commit Strategy
- Use atomic commits by wave:
  - `refactor(theme): migrate boxmox token references to botmox`
  - `refactor(ui): replace hardcoded hex/status colors with semantic tokens`
  - `chore(lint): enforce visual antd import isolation outside shared-ui`
  - `chore(qa): add strict design-system verification evidence`
- No amend, no force push, no bypass hooks.

## Success Criteria
- All 13 tasks checked with evidence files present.
- Final verification wave F1-F4 all approved.
- Quality gates green (`lint`, `typecheck`, `build`, grep-based policy checks).
- Draft removed and execution ready through `/start-work`.
