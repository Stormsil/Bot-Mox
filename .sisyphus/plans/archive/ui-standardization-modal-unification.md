# UI Standardization - Modal Unification (Ant Design Native)

## TL;DR

> **Quick Summary**: Migrate all current `ThemeModal` consumers to native Ant Design `Modal`, move modal styling control to global theme tokens, and remove modal-local visual CSS/inline color styles tied to the wrapper.
>
> **Deliverables**:
> - Global `Modal` token configuration finalized in `themeRuntime.tsx`
> - `ThemeModal` removed (file + barrel export)
> - 7 consumer modals migrated to `antd` `Modal`
> - Post-migration verification by typecheck + lint + Playwright E2E
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Theme tokens -> consumer migrations -> wrapper removal verification

---

## Context

### Original Request
Unify modal/form UI by removing custom `ThemeModal` and relying on Ant Design native components + tokens (`ConfigProvider`), as first isolated task inside broader UI standardization epic.

### Interview Summary
**Key Discussions**:
- In-scope now: Task 1 only (modal/form unification).
- Scope interpreted as **all current `ThemeModal` usages** in project (not only examples in prompt).
- User selected test strategy: **tests-after** with existing Playwright E2E infrastructure.

**Research Findings**:
- `ThemeModal` usages confirmed in 7 consumer files + wrapper + barrel export.
- Existing frontend tests are E2E-focused (`Playwright`), no frontend Jest/Vitest/Cypress infra detected.

### Metis Review
**Identified Gaps (addressed)**:
- Possible scope creep into unrelated CSS cleanup -> locked to ThemeModal migration surface only.
- Risk of style parity mismatch (mask blur/tint) -> accepted default: prioritize token consistency over pixel-perfect wrapper replication.
- Risk of breakage from export deletion order -> enforce zero-usage check before final cleanup.

---

## Work Objectives

### Core Objective
Replace `ThemeModal` with native `antd` `Modal` everywhere it is currently used, centralize modal skinning in global theme tokens, and remove modal-specific visual style hacks without changing business logic.

### Concrete Deliverables
- `components.Modal` token block finalized in `apps/frontend/src/theme/themeRuntime.tsx`.
- `apps/frontend/src/components/ui/ThemeModal.tsx` deleted.
- `apps/frontend/src/components/ui/index.ts` updated to remove `ThemeModal` export.
- Consumer migration in:
  - `apps/frontend/src/components/bot/proxy/ProxyEditorModal.tsx`
  - `apps/frontend/src/components/bot/license/LicenseFormModal.tsx`
  - `apps/frontend/src/components/bot/license/AssignLicenseModal.tsx`
  - `apps/frontend/src/pages/vms/page/VMPageModals.tsx`
  - `apps/frontend/src/pages/vms/DeleteVmModal.tsx`
  - `apps/frontend/src/components/finance/TransactionForm.tsx`
  - `apps/frontend/src/features/bot-account/account/modals.tsx`

### Definition of Done
- [x] `git grep -n "ThemeModal" -- apps/frontend/src` returns no matches.
- [x] Theme tokens for modal are present and used via `ConfigProvider` runtime.
- [x] Migrated modals compile and preserve behavior props (open/cancel/ok/loading/width/text).
- [x] Manual inline color/background styles for modal shell/form theming are removed from migrated files (unless explicitly justified).
- [x] Per-modal verification matrix (7/7) completed with observable pass evidence.
- [x] `pnpm --filter @botmox/frontend typecheck` passes.
- [x] `pnpm --filter @botmox/frontend lint` passes.
- [x] `pnpm --filter @botmox/frontend test:e2e` passes.

### Must Have
- Token-driven modal look and theme switching compatibility (light/dark).
- No `ThemeModal` in codebase after task completion.
- Existing modal workflows remain functionally unchanged.

### Must NOT Have (Guardrails)
- No business logic changes in forms, submit handlers, validation, data fetching.
- No redesign of unrelated pages/components.
- No broad CSS purge beyond ThemeModal-related modal theming in this task.
- No removal of non-theming structural classes in complex modal content (especially VM delete flow).

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (Tests-after)
- **Framework**: Playwright E2E

### Tests-After Workflow
For each migration wave:
1. Complete implementation changes for assigned files.
2. Run targeted checks (grep + typecheck/lint as needed).
3. Run frontend Playwright E2E after migration is complete.

### Verification Commands
```bash
git grep -n "ThemeModal" -- apps/frontend/src
git grep -nE "style=\{\{.*(var\(--boxmox-color|color: token\.colorText|background: 'var\(--boxmox-color)" -- apps/frontend/src/components/bot apps/frontend/src/components/finance apps/frontend/src/features/bot-account apps/frontend/src/pages/vms
pnpm --filter @botmox/frontend typecheck
pnpm --filter @botmox/frontend lint
pnpm --filter @botmox/frontend test:e2e
pnpm --filter @botmox/frontend test:e2e:report
```

### Manual Visual Checks (required in addition to tests)
- Open each migrated modal in light and dark themes.
- Verify title contrast, body readability, footer actions, and filled input backgrounds.
- Verify open/close/cancel/submit behavior unchanged.

### Per-Modal Verification Matrix (objective)

| File | Trigger/Route | Action | Expected Observable Result |
|------|---------------|--------|----------------------------|
| `apps/frontend/src/components/bot/proxy/ProxyEditorModal.tsx` | Resource flow that opens Add/Edit Proxy modal | Open modal; enter valid proxy string; observe form state | Title `Add Proxy`/`Edit Proxy` visible; `Update/Add` button enable/disable behavior unchanged; `Expiration Date` control visible |
| `apps/frontend/src/components/bot/license/LicenseFormModal.tsx` | License create/edit flow | Open modal; inspect fields | Title equals passed `title`; fields `License Key`, `Type`, `Expiration Date` visible; submit button text equals `okText` |
| `apps/frontend/src/components/bot/license/AssignLicenseModal.tsx` | License assign flow | Open modal; type in autocomplete | Title `Assign Existing License` visible; autocomplete options render/filter; submit button `Assign` present |
| `apps/frontend/src/components/finance/TransactionForm.tsx` | Finance operation create/edit flow | Open modal; toggle Income/Expense; inspect sections | Title `Add Transaction`/`Edit Transaction` visible; category/project conditional blocks behave as before; confirm loading behavior unchanged |
| `apps/frontend/src/features/bot-account/account/modals.tsx` | Account credential generation flow | Open confirm modal with `pendingGenerationType` variants | Title `Confirm Generation` visible; warning alert rendered; secondary error alert shows only when `pendingGenerationType !== password && !isPersonComplete` |
| `apps/frontend/src/pages/vms/page/VMPageModals.tsx` | `/vms` -> click `Settings` | Open VM settings modal | Title `Virtual Machines Settings` visible; width/footers consistent (`footer=null` behavior preserved) |
| `apps/frontend/src/pages/vms/DeleteVmModal.tsx` | `/vms` delete workflow | Open delete modal; use rule/view popovers; select/clear rows | Header text and subtitle visible; `Add delete tasks` disabled state tied to selection/loading; popover filter controls still usable |

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (can start immediately):
- Task 1: Theme token finalization (`themeRuntime.tsx`)
- Task 2: Consumer migration group A (proxy + license modals)

Wave 2 (after Wave 1):
- Task 3: Consumer migration group B (finance + account + VM page modals)
- Task 4: VM delete modal migration (shell-level only, preserve internal layout styles)

Wave 3 (after Wave 2):
- Task 5: Wrapper/barrel removal + zero-usage checks + verification run

Critical Path: Task 1 -> Task 3/4 -> Task 5

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 3, 4, 5 | 2 |
| 2 | None | 5 | 1 |
| 3 | 1 | 5 | 4 |
| 4 | 1 | 5 | 3 |
| 5 | 2, 3, 4 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1, 2 | `delegate_task(category="quick"/"unspecified-low", load_skills=["frontend-ui-ux"], run_in_background=true)` |
| 2 | 3, 4 | parallel dispatch after Wave 1 completion |
| 3 | 5 | single integration and verification pass |

---

## TODOs

- [x] 1. Finalize global Modal token configuration in theme runtime

  **What to do**:
  - Update `components.Modal` in `apps/frontend/src/theme/themeRuntime.tsx` with explicit mapping:
    - `contentBg` -> `palette['--boxmox-color-surface-panel']`
    - `headerBg` -> `palette['--boxmox-color-surface-muted']`
    - `footerBg` -> `palette['--boxmox-color-surface-muted']`
    - `titleColor` -> `palette['--boxmox-color-text-primary']`
    - `colorText` -> `palette['--boxmox-color-text-primary']`
    - `borderRadius` -> `sanitizeThemeShapeSettings(shape).radiusMd`
    - `boxShadow` -> `'0 20px 54px rgba(0, 0, 0, 0.35)'`
  - Keep token values bound to existing palette/shape runtime sources only.
  - Record explicit parity decision: old wrapper `mask` blur/tint and header/footer border lines are optional visual deltas (not blocking if AntD token surface is consistent).

  **Must NOT do**:
  - Do not introduce hardcoded app-specific styles outside token system.
  - Do not alter unrelated component token blocks.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: single-file, low-risk token adjustment.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: ensures design-token consistency and AntD-native styling intent.
  - **Skills Evaluated but Omitted**:
    - `git-master`: not needed for implementation itself.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 3, 4, 5
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/theme/themeRuntime.tsx` - existing runtime token composition and `components` config pattern.
  - `apps/frontend/src/components/ui/ThemeModal.tsx` - old visual intent to map into tokenized modal styling.

  **Acceptance Criteria**:
  - [ ] `components.Modal` contains required keys and exact mapping above.
  - [ ] No TS errors introduced in theme runtime.

  **Commit**: NO

- [x] 2. Migrate proxy/license modal group to native antd Modal

  **What to do**:
  - Replace `ThemeModal` import/usages with `Modal` from `antd` in:
    - `apps/frontend/src/components/bot/proxy/ProxyEditorModal.tsx`
    - `apps/frontend/src/components/bot/license/LicenseFormModal.tsx`
    - `apps/frontend/src/components/bot/license/AssignLicenseModal.tsx`
  - Remove title `<span style=...>` wrappers and inline color/background styling.
  - Use AntD-native field styling (for example `variant="filled"`) where muted input surface is required.
  - Preserve existing behavior props and submit/cancel flows.

  **Must NOT do**:
  - No form schema/rules/submit payload changes.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: 3-file UI migration with repetitive edits.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: ensures removal of custom visual hacks while preserving UX consistency.
  - **Skills Evaluated but Omitted**:
    - `openspec`: unnecessary for this bounded refactor task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: 5
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/components/bot/proxy/ProxyEditorModal.tsx` - direct `ThemeModal` migration target.
  - `apps/frontend/src/components/bot/license/LicenseFormModal.tsx` - contains inline theme styles to purge.
  - `apps/frontend/src/components/bot/license/AssignLicenseModal.tsx` - contains inline theme styles to purge.

  **Acceptance Criteria**:
  - [ ] No `ThemeModal` import/usage in these files.
  - [ ] No modal title color span wrappers remain.
  - [ ] Inline theme color/background styles removed unless justified.
  - [ ] Form submit/cancel behaviors are unchanged (same handler wiring and button labels).

  **Commit**: NO

- [x] 3. Migrate remaining standard modal consumers (finance/account/vm page)

  **What to do**:
  - Replace wrapper usage in:
    - `apps/frontend/src/components/finance/TransactionForm.tsx`
    - `apps/frontend/src/features/bot-account/account/modals.tsx`
    - `apps/frontend/src/pages/vms/page/VMPageModals.tsx`
  - Remove wrapper-specific styles and preserve modal behavior props.

  **Must NOT do**:
  - No unrelated cleanup in adjacent components.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: multi-file mechanical migration with moderate review need.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: keeps consistency of titles, spacing, and controls after swap.
  - **Skills Evaluated but Omitted**:
    - `beads`: no issue tracker workflow needed for this isolated task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 4)
  - **Blocks**: 5
  - **Blocked By**: 1

  **References**:
  - `apps/frontend/src/components/finance/TransactionForm.tsx` - large modal consumer with wrapper usage.
  - `apps/frontend/src/features/bot-account/account/modals.tsx` - account modal wrapper usage.
  - `apps/frontend/src/pages/vms/page/VMPageModals.tsx` - VM page modal container usage.

  **Acceptance Criteria**:
  - [ ] No `ThemeModal` import/usage in these files.
  - [ ] `TransactionForm` keeps confirm loading and conditional finance sections behavior.
  - [ ] `ConfirmGenerationModal` alert logic remains conditionally identical.
  - [ ] VM settings modal keeps `footer={null}`, `width={1100}`, and open/close wiring.

  **Commit**: NO

- [x] 4. Migrate VM delete modal shell while preserving internal structural styling

  **What to do**:
  - Replace wrapper usage in `apps/frontend/src/pages/vms/DeleteVmModal.tsx`.
  - Remove only wrapper-themed styles (title color span / modal shell styling hacks).
  - Keep non-theming internal class-based layout/interaction styles intact unless strictly required by migration.

  **Must NOT do**:
  - Do not redesign VM delete flow UI structure.
  - Do not remove class styles that are not directly tied to ThemeModal shell theming.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
    - Reason: single-file but high visual-regression sensitivity.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: needed to avoid contrast/spacing regressions in high-risk modal.
  - **Skills Evaluated but Omitted**:
    - `ultrabrain`: overkill; no architecture complexity.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with Task 3)
  - **Blocks**: 5
  - **Blocked By**: 1

  **References**:
  - `apps/frontend/src/pages/vms/DeleteVmModal.tsx` - migration target with mixed wrapper + internal class styling.

  **Acceptance Criteria**:
  - [ ] `ThemeModal` removed from file.
  - [ ] Keep `className={cx('vm-generator-modal vm-delete-vm-modal')}` and existing internal `cx(...)` class usage.
  - [ ] Preserve button disabled logic for `okButtonProps` and selection action buttons.
  - [ ] Popover filters still open and toggle policy/view states.

  **Commit**: NO

- [x] 5. Remove wrapper files, run zero-usage checks, and execute verification suite

  **What to do**:
  - Delete `apps/frontend/src/components/ui/ThemeModal.tsx`.
  - Remove `ThemeModal` export from `apps/frontend/src/components/ui/index.ts`.
  - Run grep/typecheck/lint/e2e verification commands.
  - Capture final status and regressions (if any) for follow-up fixes.

  **Must NOT do**:
  - No commit/push strategy changes unless explicitly requested.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: cleanup + validation orchestration.
  - **Skills**: `frontend-ui-ux`, `git-master`
    - `frontend-ui-ux`: validates UI consistency expectations.
    - `git-master`: useful if commit packaging requested after checks.
  - **Skills Evaluated but Omitted**:
    - `dev-browser`: optional; Playwright already provides browser-level checks.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential final wave
  - **Blocks**: None
  - **Blocked By**: 2, 3, 4

  **References**:
  - `apps/frontend/src/components/ui/ThemeModal.tsx` - file to delete.
  - `apps/frontend/src/components/ui/index.ts` - export cleanup target.
  - `apps/frontend/playwright.config.ts` - E2E setup reference.
  - `apps/frontend/e2e/smoke.spec.ts` - baseline UI smoke behavior reference.
  - `apps/frontend/e2e/authenticated-shell.spec.ts` - modal-adjacent flow verification reference.

  **Acceptance Criteria**:
  - [ ] `git grep -n "ThemeModal" -- apps/frontend/src` returns no matches.
  - [ ] Per-modal verification matrix completed (7 rows validated).
  - [ ] `pnpm --filter @botmox/frontend typecheck` passes.
  - [ ] `pnpm --filter @botmox/frontend lint` passes.
  - [ ] `pnpm --filter @botmox/frontend test:e2e` passes.

  **Commit**: NO

---

## Commit Strategy

No commit is included in this plan by default. If requested, create one atomic commit after Task 5 verification passes.

---

## Success Criteria

### Verification Commands
```bash
git grep -n "ThemeModal" -- apps/frontend/src
pnpm --filter @botmox/frontend typecheck
pnpm --filter @botmox/frontend lint
pnpm --filter @botmox/frontend test:e2e
```

### Final Checklist
- [x] All in-scope modal consumers use native `antd` `Modal`.
- [x] Global modal token styling controls visual consistency.
- [x] Wrapper file and export removed cleanly.
- [x] No scope bleed into unrelated CSS standardization tasks.
- [x] Regression checks pass.
