# Strict Design System & UI Kit Foundation

## TL;DR
> **Summary**: Build a strict, centralized UI foundation by unifying design tokens, encapsulating Ant Design behind `shared/ui`, and enforcing anti-hardcode/import governance in CI. Migration is staged by module with frontend-first scope and deterministic verification.
> **Deliverables**:
> - Prefix cutover `--boxmox-*` -> `--botmox-*` across active frontend/admin theme surfaces
> - Foundation tokens for spacing/typography wired into runtime theme bridge
> - New `shared/ui` wrappers (`AppCard`, `AppDivider`, `AppTag`, `AppStatistic`, `AppText`, `AppTitle`, `AppButton`, `AppInput`, `AppSelect`, `AppSwitch`)
> - Business-layer migration off direct visual AntD imports and hardcoded style literals
> - Domain styling bridge for WoW-specific palettes in feature scope
> - ESLint + Stylelint governance gates and CI enforcement
> **Effort**: XL
> **Parallel**: YES - 4 waves
> **Critical Path**: T1 -> T2/T3/T4 -> T5/T6/T7/T8 -> T9/T10/T11/T12 -> T13/T14

## Context
### Original Request
Implement the epic "Strict Design System & UI Kit Foundation" with five phases: foundation token cleanup, UI-kit wrapper isolation, global refactor, domain color bridge, and governance enforcement.

### Interview Summary
- Migration strategy fixed: staged by module with strict gates.
- Scope fixed: frontend now; admin deferred to follow-up wave/epic.
- Governance fixed: enable ESLint + Stylelint in this epic.
- Execution style: tests-after using existing lint/typecheck/build + Playwright + custom guardrail scripts.

### Metis Review (gaps addressed)
- Locked single-source token authority in frontend theme runtime contracts first, then wrapper migration.
- Added explicit non-visual AntD allowlist policy and suppression governance.
- Added guardrail realignment task for current architecture paths to avoid false green CI.
- Added measurable debt burn-down acceptance criteria per wave.
- Added rollback safety with staged module batches and zero-new-violations policy.

## Work Objectives
### Core Objective
Deliver a decision-complete design-system foundation where business layers consume only curated `shared/ui` primitives and theme tokens, with runtime theme consistency guaranteed from Settings changes.

### Deliverables
- Token/prefix migration in:
  - `apps/frontend/src/theme/themePalette.definitions.ts`
  - `apps/frontend/src/theme/themeRuntime.tsx`
  - `apps/frontend/src/styles/variables.css`
  - `apps/admin/src/styles/variables.css`
- Wrapper implementation and exports in `apps/frontend/src/shared/ui/**` and `apps/frontend/src/shared/ui/index.ts`
- Business-layer migration in `apps/frontend/src/pages/**`, `apps/frontend/src/widgets/**`, `apps/frontend/src/features/**`, `apps/frontend/src/entities/**`
- Domain palette bridge in `apps/frontend/src/features/wow-data/config/colors.ts`
- Governance updates in `apps/frontend/eslint.config.js` and Stylelint config at `apps/frontend/stylelint.config.cjs`

### Definition of Done (verifiable conditions with commands)
- `pnpm --filter @botmox/frontend lint` passes.
- `pnpm --filter @botmox/frontend typecheck` passes.
- `pnpm --filter @botmox/frontend build` passes.
- `pnpm --filter @botmox/frontend test:e2e` targeted theme/settings and CRUD smoke passes.
- `pnpm exec rg "--boxmox-" apps/frontend/src apps/admin/src --glob "*.{css,ts,tsx}"` returns zero matches in migrated scope.
- `pnpm exec rg "from ['\\\"]antd['\\\"]" apps/frontend/src/pages apps/frontend/src/widgets apps/frontend/src/features apps/frontend/src/entities --glob "*.tsx"` returns only approved non-visual/type-only allowlist imports.
- `pnpm exec rg "#[0-9a-fA-F]{3,8}|rgb\(" apps/frontend/src --glob "*.module.css"` returns zero matches outside approved domain-color bridge files.

### Must Have
- Runtime theme remains settings-driven and consistent across navigation/reload.
- Shared UI wrappers become the only visual AntD access path in business layers.
- Hardcoded spacing/color literals replaced by tokens or feature-domain palettes.
- Governance blocks regressions on new code.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No backend contract/schema changes in this epic.
- No admin-wide migration in this wave beyond required prefix/token parity files.
- No uncontrolled global CSS hacks (`!important`, broad `.ant-*` selectors).
- No direct visual AntD imports in business layers post-governance enablement.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after using existing frontend lint/typecheck/build + Playwright + custom scripts.
- QA policy: every task includes happy + failure/edge scenarios with concrete commands/selectors.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave; extract shared dependencies first.

Wave 1: Foundations and governance scaffolding (`T1`, `T2`, `T3`, `T4`)
Wave 2: Shared UI wrapper surface (`T5`, `T6`, `T7`, `T8`)
Wave 3: Business-layer refactor + domain bridge (`T9`, `T10`, `T11`, `T12`)
Wave 4: Governance ratchet + CI hard fail (`T13`, `T14`)

### Dependency Matrix (full, all tasks)
- `T1` blocks all other tasks.
- `T2`, `T3`, `T4` block `T5-T14`.
- `T5-T8` block `T9-T11`.
- `T12` depends on `T6` and `T10`.
- `T13` depends on `T2`, `T5-T11`.
- `T14` depends on `T3`, `T9-T12`, and `T13`.

### Agent Dispatch Summary (wave → task count → categories)
- Wave 1 -> 4 tasks -> `deep`, `general`, `unspecified-high`
- Wave 2 -> 4 tasks -> `general`, `quick`, `visual-engineering`
- Wave 3 -> 4 tasks -> `deep`, `general`, `unspecified-high`
- Wave 4 -> 2 tasks -> `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.


- [x] 1. Baseline Lock, Metrics Snapshot, and Allowed-Import Contract

  **What to do**: Capture immutable baseline counts for `--boxmox-`, direct `antd` imports, hardcoded CSS/inline literals; define approved non-visual AntD allowlist (`message`, `theme`, `App`, `Form.useForm`, type-only imports) and suppression policy.
  **Must NOT do**: Do not start migration edits before baseline evidence and policy file are committed.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: architecture guardrail setup and measurable baseline contract.
  - Skills: `[]` — no special skill required.
  - Omitted: `['quick']` — policy decisions + metrics need high precision.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: `2-14` | Blocked By: none

  **References**:
  - Pattern: `apps/frontend/src/theme/themePalette.definitions.ts:4` — current `--boxmox-*` token keys.
  - Pattern: `apps/frontend/src/theme/themeRuntime.tsx:77` — runtime token reads still on `--boxmox-*`.
  - Pattern: `apps/frontend/src/shared/ui/index.ts:1` — wrapper export surface baseline.
  - Pattern: `apps/frontend/eslint.config.js:64` — existing `no-restricted-imports` usage pattern.
  - Script: `scripts/check-style-token-usage.js:1` — current style debt gate behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "--boxmox-" apps/frontend/src apps/admin/src --glob "*.{css,ts,tsx}" > .sisyphus/evidence/task-1-prefix-baseline.txt` runs.
  - [ ] `pnpm exec rg "from ['\\\"]antd['\\\"]" apps/frontend/src --glob "*.tsx" > .sisyphus/evidence/task-1-antd-baseline.txt` runs.
  - [ ] `pnpm exec rg "#[0-9a-fA-F]{3,8}|rgb\\(" apps/frontend/src --glob "*.{css,tsx,ts}" > .sisyphus/evidence/task-1-color-baseline.txt` runs.
  - [ ] Allowlist + suppression rules are documented in `.sisyphus/evidence/task-1-policy-contract.md`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path baseline capture
    Tool: Bash
    Steps: Execute all baseline rg commands and save outputs to evidence files.
    Expected: All evidence files exist and contain non-empty metrics snapshot.
    Evidence: .sisyphus/evidence/task-1-prefix-baseline.txt

  Scenario: Failure/edge contract ambiguity
    Tool: Bash
    Steps: Run rg for direct visual imports in business layers after writing allowlist contract.
    Expected: Any import outside allowlist is explicitly called out in policy contract file.
    Evidence: .sisyphus/evidence/task-1-policy-contract.md
  ```

  **Commit**: YES | Message: `chore(ui-governance): lock baseline metrics and import contract` | Files: evidence + policy artifacts only

- [x] 2. Global Prefix Cutover `--boxmox-*` to `--botmox-*`

  **What to do**: Perform global rename in active scope (`apps/frontend/src`, `apps/admin/src`) for `.css/.ts/.tsx`; update theme mappings and runtime references to new prefix.
  **Must NOT do**: Do not keep mixed prefix usage; no temporary dual-prefix reads in runtime code.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: broad codemod-style refactor with cross-file consistency.
  - Skills: `[]` — direct search/replace strategy.
  - Omitted: `['artistry']` — deterministic migration.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: `5-14` | Blocked By: `1`

  **References**:
  - Pattern: `apps/frontend/src/theme/themePalette.definitions.ts:4` — key map to rename.
  - Pattern: `apps/frontend/src/theme/themeRuntime.tsx:77` — token access keys to rename.
  - Pattern: `apps/frontend/src/styles/variables.css:4` — frontend CSS vars.
  - Pattern: `apps/admin/src/styles/variables.css` — admin CSS vars parity.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "--boxmox-" apps/frontend/src apps/admin/src --glob "*.{css,ts,tsx}"` returns 0 matches.
  - [ ] `pnpm exec rg "--botmox-" apps/frontend/src apps/admin/src --glob "*.{css,ts,tsx}"` returns expected non-zero matches.
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path full prefix migration
    Tool: Bash
    Steps: Run replacement, run rg residual check for old prefix, then run typecheck.
    Expected: No old prefix remains; typecheck succeeds.
    Evidence: .sisyphus/evidence/task-2-prefix-cutover.txt

  Scenario: Failure/edge mixed-prefix regression
    Tool: Bash
    Steps: Search for both old and new prefixes in same file set.
    Expected: No file in migrated scope contains old prefix after cutover.
    Evidence: .sisyphus/evidence/task-2-prefix-cutover-error.txt
  ```

  **Commit**: YES | Message: `refactor(theme): rename boxmox css var prefix to botmox` | Files: theme/runtime/styles files in frontend/admin scope

- [x] 3. Foundation Spacing/Sizing Tokenization and AntD Bridge

  **What to do**: Add spacing tokens `--botmox-space-xs/sm/md/lg/xl` in variables; wire token usage into AntD runtime config for margin/padding-related component defaults and style helpers.
  **Must NOT do**: Do not leave numeric `px` constants for standard spacing in wrapper components.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: token contract and runtime bridge alignment.
  - Skills: `[]` — existing theme runtime patterns are sufficient.
  - Omitted: `['quick']` — multiple files and config touchpoints.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: `5-14` | Blocked By: `1,2`

  **References**:
  - Pattern: `apps/frontend/src/styles/variables.css:63` — current spacing variables (`--spacing-*`) to normalize.
  - Pattern: `apps/frontend/src/theme/themeRuntime.tsx:70` — AntD token bridge location.
  - Pattern: `apps/frontend/src/shared/ui/AppTable/AppTable.tsx` — wrapper-level spacing consumer pattern.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "--botmox-space-(xs|sm|md|lg|xl)" apps/frontend/src/styles/variables.css` returns 5 matches.
  - [ ] `pnpm exec rg "botmox-space" apps/frontend/src/theme/themeRuntime.tsx apps/frontend/src/shared/ui --glob "*.{ts,tsx}"` returns expected bridge usage.
  - [ ] `pnpm --filter @botmox/frontend build` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path spacing token bridge
    Tool: Bash
    Steps: Add spacing tokens, wire runtime/wrappers, run build.
    Expected: Build passes and spacing tokens are referenced from runtime/wrapper layer.
    Evidence: .sisyphus/evidence/task-3-spacing-bridge.txt

  Scenario: Failure/edge legacy spacing variable fallback
    Tool: Bash
    Steps: Search for deprecated generic spacing vars in touched wrapper/runtime files.
    Expected: No new usage of legacy spacing vars in newly migrated code.
    Evidence: .sisyphus/evidence/task-3-spacing-bridge-error.txt
  ```

  **Commit**: YES | Message: `feat(tokens): add botmox spacing scale and runtime bridge` | Files: variables + themeRuntime + touched wrapper files

- [x] 4. Typography Standardization and Font Runtime Integrity

  **What to do**: Expand text tokens in `variables.css` (`--botmox-text-h1..h6`, `--botmox-text-body`, `--botmox-text-caption`, `--botmox-text-code`), and ensure runtime font settings (`fontPrimary`, `fontCondensed`, `fontMono`) flow correctly into `ConfigProvider` and CSS vars.
  **Must NOT do**: Do not hardcode font families in business components after tokenization.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: typography contract and runtime pipeline hardening.
  - Skills: `[]` — existing theme settings model supports this.
  - Omitted: `['visual-engineering']` — no redesign, only systemization.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: `7,8,9,10,11,14` | Blocked By: `1,2`

  **References**:
  - Pattern: `apps/frontend/src/theme/themePalette.definitions.ts:55` — typography settings shape.
  - Pattern: `apps/frontend/src/theme/themeRuntime.tsx:74` — `fontFamily` and `fontFamilyCode` bridge.
  - Pattern: `apps/frontend/src/theme/themePalette.ts:262` — document font CSS var writes.
  - Pattern: `apps/frontend/src/styles/variables.css:49` — existing text size variables.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "--botmox-text-(h1|h2|h3|h4|h5|h6|body|caption|code)" apps/frontend/src/styles/variables.css` returns expected token set.
  - [ ] `pnpm exec rg "fontPrimary|fontCondensed|fontMono|fontFamilyCode" apps/frontend/src/theme --glob "*.{ts,tsx}"` confirms runtime wiring.
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path typography runtime propagation
    Tool: Bash
    Steps: Apply typography token/runtime updates, then run typecheck.
    Expected: Typecheck passes; token names and font bridges compile cleanly.
    Evidence: .sisyphus/evidence/task-4-typography-runtime.txt

  Scenario: Failure/edge missing font fallback mapping
    Tool: Bash
    Steps: Search for direct font literals in migrated business-layer files.
    Expected: No new direct font literals added outside token/runtime contracts.
    Evidence: .sisyphus/evidence/task-4-typography-runtime-error.txt
  ```

  **Commit**: YES | Message: `feat(tokens): standardize typography scale and font runtime wiring` | Files: variables + theme runtime/palette files

- [x] 5. Create Layout Wrappers: `AppCard` and `AppDivider`

  **What to do**: Implement `AppCard` and `AppDivider` in `shared/ui` with default spacing/border/header background from `--botmox-*` tokens; export via `shared/ui/index.ts`.
  **Must NOT do**: Do not expose unbounded style props that bypass token defaults.

  **Recommended Agent Profile**:
  - Category: `visual-engineering` — Reason: UI primitive defaults with theme-safe styling.
  - Skills: `['frontend-ui-ux']` — consistent component API and visual system decisions.
  - Omitted: `['deep']` — implementation scope is local to wrappers.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: `9,11` | Blocked By: `2,3`

  **References**:
  - Pattern: `apps/frontend/src/shared/ui/AppModal/AppModal.tsx` — wrapper structure pattern.
  - Pattern: `apps/frontend/src/shared/ui/AppTable/AppTable.tsx` — wrapper export/typing pattern.
  - Token: `apps/frontend/src/styles/variables.css` — `--botmox-color-surface-muted`, `--botmox-color-border-default`, spacing tokens.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "export \{ AppCard \}|export \{ AppDivider \}" apps/frontend/src/shared/ui/index.ts` matches.
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes.
  - [ ] `pnpm exec rg "botmox-color-surface-muted|botmox-color-border-default|botmox-space" apps/frontend/src/shared/ui --glob "*.{ts,tsx,css}"` confirms tokenized defaults.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path wrapper defaults
    Tool: Bash
    Steps: Implement wrappers, export them, run typecheck.
    Expected: Wrappers compile and reference only tokenized defaults.
    Evidence: .sisyphus/evidence/task-5-layout-wrappers.txt

  Scenario: Failure/edge style bypass
    Tool: Bash
    Steps: Search wrapper code for hardcoded hex/rgb/px literals.
    Expected: No hardcoded literal usage in wrapper defaults.
    Evidence: .sisyphus/evidence/task-5-layout-wrappers-error.txt
  ```

  **Commit**: YES | Message: `feat(ui-kit): add AppCard and AppDivider wrappers` | Files: new wrapper files + shared/ui barrel

- [x] 6. Create Data/Status Wrappers: `AppTag` and `AppStatistic`

  **What to do**: Add `AppTag` with strict semantic `intent` (`success|warning|error|info|default`) and controlled `customColor` escape hatch; add `AppStatistic` with dashboard/finance typography defaults.
  **Must NOT do**: Do not expose raw AntD `color` prop directly in business-layer API.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: strict prop modeling + theme token mapping.
  - Skills: `[]` — existing type patterns are enough.
  - Omitted: `['quick']` — requires careful API constraints.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: `9,10,11,12` | Blocked By: `2,3,4`

  **References**:
  - Pattern: `apps/frontend/src/shared/ui/StatusBadge.tsx` — status-style component baseline.
  - Pattern: `apps/frontend/src/shared/ui/MetricCard.tsx` — statistic-like presentation baseline.
  - Hotspot: `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx:205` — inline status color usage to replace.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "intent\s*:\s*'success'\s*\|\s*'warning'\s*\|\s*'error'\s*\|\s*'info'\s*\|\s*'default'" apps/frontend/src/shared/ui --glob "*.tsx"` matches.
  - [ ] `pnpm exec rg "customColor" apps/frontend/src/shared/ui --glob "*.tsx"` confirms controlled escape hatch.
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path semantic intent mapping
    Tool: Bash
    Steps: Build wrappers and verify intent unions/types compile.
    Expected: Only semantic intents are accepted; mapping resolves to theme tokens.
    Evidence: .sisyphus/evidence/task-6-data-status-wrappers.txt

  Scenario: Failure/edge invalid intent input
    Tool: Bash
    Steps: Run typecheck with temporary invalid intent usage in a test compile path.
    Expected: TypeScript rejects invalid intent values.
    Evidence: .sisyphus/evidence/task-6-data-status-wrappers-error.txt
  ```

  **Commit**: YES | Message: `feat(ui-kit): add AppTag and AppStatistic wrappers` | Files: new wrapper files + shared/ui barrel

- [x] 7. Create Typography Wrappers: `AppText` and `AppTitle`

  **What to do**: Implement wrappers with strict `type` set (`primary|secondary|muted|danger|success`) and token-backed typography variants.
  **Must NOT do**: Do not allow raw AntD `Typography.Text type` passthrough in public wrapper API.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: strict text API and semantic token mapping.
  - Skills: `[]` — no external skill required.
  - Omitted: `['artistry']` — no novel design patterns required.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: `10,11` | Blocked By: `2,4`

  **References**:
  - Pattern: `apps/frontend/src/pages/subscriptions/subscription-columns.tsx:27` — inline text style use-cases.
  - Pattern: `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx:99` — repeated text variants.
  - Token contract: `apps/frontend/src/styles/variables.css` typography/token definitions.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "primary\|secondary\|muted\|danger\|success" apps/frontend/src/shared/ui --glob "*AppText*.tsx"` confirms strict type union.
  - [ ] `pnpm exec rg "AppTitle|AppText" apps/frontend/src/shared/ui/index.ts` confirms exports.
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path semantic typography usage
    Tool: Bash
    Steps: Implement wrappers, export, run typecheck.
    Expected: Wrapper types compile and support only defined semantic variants.
    Evidence: .sisyphus/evidence/task-7-typography-wrappers.txt

  Scenario: Failure/edge unsupported text type
    Tool: Bash
    Steps: Attempt unsupported type usage in temporary compile path.
    Expected: TypeScript error is produced.
    Evidence: .sisyphus/evidence/task-7-typography-wrappers-error.txt
  ```

  **Commit**: YES | Message: `feat(ui-kit): add AppText and AppTitle wrappers` | Files: new wrapper files + shared/ui barrel

- [x] 8. Create Interactive Wrappers: `AppButton`, `AppInput`, `AppSelect`, `AppSwitch`

  **What to do**: Build interactive wrappers with default `size="small"` and tokenized style defaults aligned with dense Proxmox-like UI goal.
  **Must NOT do**: Do not keep duplicated per-screen size overrides where wrapper default is sufficient.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: component API standardization at scale.
  - Skills: `[]` — existing wrapper approach is reusable.
  - Omitted: `['deep']` — no architecture redesign.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: `9,10,11` | Blocked By: `2,3,4`

  **References**:
  - Pattern: `apps/frontend/src/shared/ui/TableActionButton.tsx` — button typing and pass-through strategy.
  - Hotspot: `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx` — input/select-heavy usage.
  - Hotspot: `apps/frontend/src/pages/settings/sections/ProxyAndAlertsCards.tsx` — switch/input-number style density.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "size\s*=\s*['\"]small['\"]|defaultSize" apps/frontend/src/shared/ui --glob "*App(Button|Input|Select|Switch)*.tsx"` confirms default sizing.
  - [ ] `pnpm exec rg "AppButton|AppInput|AppSelect|AppSwitch" apps/frontend/src/shared/ui/index.ts` confirms exports.
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path interactive default density
    Tool: Bash
    Steps: Implement wrappers and compile frontend.
    Expected: Wrappers compile; default size is small without per-screen hacks.
    Evidence: .sisyphus/evidence/task-8-interactive-wrappers.txt

  Scenario: Failure/edge uncontrolled prop passthrough
    Tool: Bash
    Steps: Verify wrapper APIs still allow required controlled props (value/onChange/disabled).
    Expected: No breakage of controlled input patterns.
    Evidence: .sisyphus/evidence/task-8-interactive-wrappers-error.txt
  ```

  **Commit**: YES | Message: `feat(ui-kit): add interactive wrappers with small density defaults` | Files: new wrapper files + shared/ui barrel

- [x] 9. CSS Module Hardcode Cleanup (Wave-by-Wave)

  **What to do**: Replace hardcoded `px` spacing and HEX/RGB color literals in high-density CSS modules with `var(--botmox-space-*)` and `var(--botmox-color-*)`; execute by hotspot batches.
  **Must NOT do**: Do not alter layout semantics while replacing literals; no visual redesign.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: broad, risk-prone style refactor.
  - Skills: `[]` — deterministic replacement workflow.
  - Omitted: `['quick']` — too much surface area.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: `13,14` | Blocked By: `2,3,5,6,7,8`

  **References**:
  - Hotspot: `apps/frontend/src/widgets/bot-profile/ui/lifeStages/lifeStages.module.css`
  - Hotspot: `apps/frontend/src/widgets/vm/VMQueuePanelCore.module.css`
  - Hotspot: `apps/frontend/src/pages/proxies/ProxiesPage.module.css`
  - Hotspot: `apps/frontend/src/widgets/layout/ResourceTree.module.css`
  - Guard: `scripts/check-style-token-usage.js:10` — raw color literal detection baseline.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "#[0-9a-fA-F]{3,8}|rgb\\(" apps/frontend/src --glob "*.module.css"` returns zero matches outside domain allowlist.
  - [ ] `pnpm exec rg "\b(margin|padding|gap|width|height|border-radius)\s*:\s*\d+px\b" apps/frontend/src --glob "*.module.css"` count decreases versus Task 1 baseline with no new violations in touched files.
  - [ ] `node scripts/check-style-token-usage.js` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path CSS tokenization
    Tool: Bash
    Steps: Refactor hotspot modules, run token-usage check and grep scans.
    Expected: Raw literals are removed in touched files and checks pass.
    Evidence: .sisyphus/evidence/task-9-css-hardcode-cleanup.txt

  Scenario: Failure/edge regression from missed literals
    Tool: Bash
    Steps: Run color/px grep on touched module set.
    Expected: Any residual literal in touched files fails the task and is listed.
    Evidence: .sisyphus/evidence/task-9-css-hardcode-cleanup-error.txt
  ```

  **Commit**: YES | Message: `refactor(styles): replace css-module hardcodes with design tokens` | Files: touched hotspot `.module.css` files

- [x] 10. Inline Style Cleanup in TSX and Semantic Wrapper Adoption

  **What to do**: Replace inline hardcoded style values in hotspot TSX files using `AppText` semantic types and CSS variables/classes; prioritize `LicenseColumns`, `proxyColumns`, `tree-utils`, finance/bot-profile hotspots.
  **Must NOT do**: Do not convert dynamic geometry styles that are genuinely runtime-driven (e.g., percentage/position calculations).

  **Recommended Agent Profile**:
  - Category: `general` — Reason: mixed UI refactor with semantic component substitution.
  - Skills: `[]` — existing wrapper patterns are enough.
  - Omitted: `['artistry']` — no creative redesign.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: `11,13,14` | Blocked By: `6,7,8,9`

  **References**:
  - Hotspot: `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx:205`
  - Hotspot: `apps/frontend/src/pages/proxies/proxyColumns.tsx:233`
  - Hotspot: `apps/frontend/src/widgets/layout/resourceTree/tree-utils.tsx:56`
  - Hotspot: `apps/frontend/src/widgets/finance/CostAnalysis.tsx:84`
  - Hotspot: `apps/frontend/src/widgets/bot-profile/ui/subscription/SubscriptionListItem.tsx:78`

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "style=\\{\\{[^}]*#[0-9A-Fa-f]{3,8}" apps/frontend/src` returns zero matches in migrated hotspot files.
  - [ ] `pnpm exec rg "style=\\{\\{[^}]*\\d+px" apps/frontend/src` count decreases versus baseline with zero new touched-file violations.
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path semantic replacement
    Tool: Bash
    Steps: Replace hotspot inline literals with wrapper semantic types/tokens, run typecheck.
    Expected: Typecheck passes; migrated files contain no inline hardcoded color literals.
    Evidence: .sisyphus/evidence/task-10-inline-cleanup.txt

  Scenario: Failure/edge dynamic-style false positives
    Tool: Bash
    Steps: Validate remaining inline styles are only dynamic geometry/runtime values.
    Expected: Remaining inline styles are justified and documented; hardcoded literals absent.
    Evidence: .sisyphus/evidence/task-10-inline-cleanup-error.txt
  ```

  **Commit**: YES | Message: `refactor(ui): remove inline style hardcodes in hotspot tsx files` | Files: touched hotspot tsx files + related css modules

- [ ] 11. Business-Layer AntD Import Migration to `shared/ui`

  **What to do**: Iteratively replace direct visual AntD imports in `pages/widgets/features/entities` with `shared/ui` wrappers; keep allowlisted non-visual imports only.
  **Must NOT do**: Do not migrate all modules in one giant commit; keep one module batch per PR/commit wave.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: broad refactor with boundary enforcement and sequencing.
  - Skills: `[]` — codemod + manual verification.
  - Omitted: `['quick']` — too high blast radius.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: `13,14` | Blocked By: `5,6,7,8,10`

  **References**:
  - Pattern: `apps/frontend/src/pages/dashboard/index.tsx:8` — direct `Card/Table/Typography` import.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx:4` — direct AntD visual imports.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotFinanceWidget.tsx:7` — visual-heavy imports.
  - Contract: `apps/frontend/src/shared/ui/index.ts` — central import surface.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm exec rg "from ['\\\"]antd['\\\"]" apps/frontend/src/pages apps/frontend/src/widgets apps/frontend/src/features apps/frontend/src/entities --glob "*.tsx"` returns only allowlisted non-visual/type-only imports.
  - [ ] `pnpm --filter @botmox/frontend lint && pnpm --filter @botmox/frontend typecheck` passes.
  - [ ] Migration evidence lists each converted module batch in `.sisyphus/evidence/task-11-import-migration.md`.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path import boundary migration
    Tool: Bash
    Steps: Convert one module batch imports to shared/ui, run lint/typecheck, repeat.
    Expected: No direct visual antd imports remain in migrated batches.
    Evidence: .sisyphus/evidence/task-11-import-migration.txt

  Scenario: Failure/edge hidden re-introductions
    Tool: Bash
    Steps: Run import grep after each batch.
    Expected: Any new direct visual antd import fails the batch.
    Evidence: .sisyphus/evidence/task-11-import-migration-error.txt
  ```

  **Commit**: YES | Message: `refactor(ui-boundary): migrate business layers to shared ui wrappers` | Files: migrated business-layer modules

- [x] 12. Domain Styling Bridge for WoW-Specific Colors

  **What to do**: Create `apps/frontend/src/features/wow-data/config/colors.ts` for rarity/class colors; migrate WoW-specific widget usage to local domain config while keeping core UI kit clean.
  **Must NOT do**: Do not leak domain color constants into `shared/ui` or global token files.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: bounded feature-layer color isolation.
  - Skills: `[]` — straightforward feature config extraction.
  - Omitted: `['visual-engineering']` — no design overhaul.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: `14` | Blocked By: `6,10`

  **References**:
  - Hotspot: `apps/frontend/src/widgets/bot-profile/ui/lifeStages/config.tsx:82` — rarity/class color literals.
  - Hotspot: `apps/frontend/src/widgets/bot-profile/ui/BotFarm.tsx:38` — quality color mapping.
  - Hotspot: `apps/frontend/src/widgets/bot-profile/ui/BotProfessionWidget.tsx:37` — profession color mapping.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `apps/frontend/src/features/wow-data/config/colors.ts` exists and exports domain palettes.
  - [ ] `pnpm exec rg "#[0-9a-fA-F]{3,8}" apps/frontend/src/widgets/bot-profile apps/frontend/src/features/wow-data --glob "*.{ts,tsx}"` leaves literals only in domain config (or zero outside it).
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path domain color isolation
    Tool: Bash
    Steps: Extract wow colors into feature config and update widget imports.
    Expected: Widgets compile and read colors from feature config only.
    Evidence: .sisyphus/evidence/task-12-domain-bridge.txt

  Scenario: Failure/edge shared-ui contamination
    Tool: Bash
    Steps: Search shared/ui and theme core for WOW color constants.
    Expected: No domain-specific constants appear in shared/ui or global theme files.
    Evidence: .sisyphus/evidence/task-12-domain-bridge-error.txt
  ```

  **Commit**: YES | Message: `refactor(features): isolate wow domain color palettes` | Files: new features/wow-data config + updated bot-profile widgets

- [ ] 13. ESLint Governance: Enforce AntD Isolation and Layer Boundaries

  **What to do**: Update `apps/frontend/eslint.config.js` with strict `no-restricted-imports` rules blocking visual AntD imports outside `shared/ui`; allowlist non-visual APIs and type-only imports; align path scopes with actual architecture (`app/pages/widgets/features/entities/shared`).
  **Must NOT do**: Do not blanket-ban type-only imports required for contracts; do not leave warning-level severity.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: enforcement correctness directly affects migration safety.
  - Skills: `[]` — lint rule authoring.
  - Omitted: `['quick']` — high-impact governance change.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: `14` | Blocked By: `11`

  **References**:
  - Pattern: `apps/frontend/eslint.config.js:64` — existing `no-restricted-imports` pattern blocks.
  - Pattern: `scripts/check-ui-boundaries.js:5` — outdated path assumptions to align.
  - Doc: `https://eslint.org/docs/latest/rules/no-restricted-imports` — authoritative rule behavior.

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @botmox/frontend lint` passes with new restrictions enabled.
  - [ ] Intentional violation smoke check (temporary direct visual AntD import in business layer) fails lint.
  - [ ] `pnpm exec rg "no-restricted-imports" apps/frontend/eslint.config.js` confirms enforced rule blocks for architecture layers.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path lint enforcement
    Tool: Bash
    Steps: Apply ESLint restrictions and run frontend lint.
    Expected: Lint passes on codebase and policy is active.
    Evidence: .sisyphus/evidence/task-13-eslint-governance.txt

  Scenario: Failure/edge bypass detection
    Tool: Bash
    Steps: Introduce temporary direct visual antd import in business layer and run lint.
    Expected: Lint fails with restriction message, then temporary violation is removed.
    Evidence: .sisyphus/evidence/task-13-eslint-governance-error.txt
  ```

  **Commit**: YES | Message: `chore(lint): enforce antd isolation in business layers` | Files: eslint config + boundary check script updates

- [ ] 14. Stylelint Governance + CI Ratchet and Final Debt Gate

  **What to do**: Add Stylelint config in frontend to ban HEX/RGB in CSS (allow `var(--botmox-*)` and `color-mix`), integrate into frontend scripts/CI flow, and set hard fail for violations.
  **Must NOT do**: Do not block domain bridge files if policy defines explicit scoped exceptions; no silent broad ignores.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: final hard gate and regression protection.
  - Skills: `[]` — lint integration + CI ratchet.
  - Omitted: `['visual-engineering']` — governance task.

  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: Final Verification Wave | Blocked By: `9,10,11,12,13`

  **References**:
  - Script: `scripts/check-style-guardrails.js:12` — existing style guard baseline.
  - Script: `scripts/check-style-token-usage.js:10` — literal detection baseline.
  - CI: `.github/workflows/ci.yml` — lint/type/build gate orchestration.
  - Doc: `https://stylelint.io/user-guide/rules/color-no-hex/`
  - Doc: `https://stylelint.io/user-guide/rules/function-disallowed-list`

  **Acceptance Criteria** (agent-executable only):
  - [ ] `pnpm --filter @botmox/frontend exec stylelint "src/**/*.css"` passes.
  - [ ] `pnpm --filter @botmox/frontend lint && pnpm --filter @botmox/frontend typecheck && pnpm --filter @botmox/frontend build` passes.
  - [ ] `node scripts/check-style-token-usage.js && node scripts/check-style-guardrails.js` passes.
  - [ ] Intentional CSS hex/rgb violation smoke check fails Stylelint, then is reverted.

  **QA Scenarios** (MANDATORY — task incomplete without these):
  ```text
  Scenario: Happy path governance hard fail ready
    Tool: Bash
    Steps: Add stylelint config + script wiring, run stylelint and existing style checks.
    Expected: All checks pass and CI-ready hard-fail gate is in place.
    Evidence: .sisyphus/evidence/task-14-stylelint-ratchet.txt

  Scenario: Failure/edge false-negative regression
    Tool: Bash
    Steps: Inject temporary hex/rgb literal in css, run stylelint.
    Expected: Stylelint fails; violation removed; check passes again.
    Evidence: .sisyphus/evidence/task-14-stylelint-ratchet-error.txt
  ```

  **Commit**: YES | Message: `chore(stylelint): enforce token-only css colors and ci gate` | Files: stylelint config + package scripts + CI/lint wiring

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [ ] F1. Plan Compliance Audit — oracle
- [ ] F2. Code Quality Review — unspecified-high
- [ ] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [ ] F4. Scope Fidelity Check — deep

## Commit Strategy
- Use staged commits by wave (one commit per task batch where practical), never mixing governance-only and feature-refactor changes in one commit.
- Conventional commit pattern: `refactor(ui): ...`, `feat(ui-kit): ...`, `chore(lint): ...`, `style(tokens): ...`.
- Enforce clean working tree + evidence artifacts before each commit.

## Success Criteria
- Visual AntD components are fully encapsulated behind `shared/ui` for business layers in frontend scope.
- Prefix/token migration is complete in active frontend/admin style foundations for this wave.
- Hardcoded HEX/RGB/px usage is removed from migrated business scope with domain-only exceptions.
- Theme changes from Settings propagate consistently across app surfaces without artifacts.
- ESLint + Stylelint fail fast on design-system violations and block regressions in CI.
