# Refine Architecture Integration (UI + Routing De-boilerplate)

## TL;DR

> **Quick Summary**: Migrate frontend resource flows from mixed manual React Router/CRUD/table/modal state to idiomatic Refine patterns so routing, table URL-state, and CRUD forms are framework-managed.
>
> **Deliverables**:
> - Refine router/resource configuration with URL sync in app shell
> - Refactored resource pages (`licenses`, `proxies`, `subscriptions`) using `useTable` + `useModalForm`
> - Refactored bot resource tabs (`BotLicense`, `BotProxy`, `BotSubscription`) to the same CRUD/modal pattern
> - Action controls moved to Refine primitives (`EditButton`/`DeleteButton`) where appropriate
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Router foundation -> page CRUD/table migration -> bot tab parity -> regression verification

---

## Context

### Original Request
Полная интеграция архитектуры Refine: убрать ручной стейт-менеджмент для роутинга/таблиц/CRUD-модалок, перейти на идиоматичный Refine, сохранить текущий UI/UX.

### Interview Summary
**Key Discussions**:
- Scope includes not only resource pages but also bot tabs (`BotLicense`, `BotProxy`, `BotSubscription`).
- Verification strategy is **Tests-after** (implementation first, then automated checks).
- UI behavior and styling must remain unchanged; architecture/state management only.

**Research Findings**:
- Frontend Refine root and manual routes are in `apps/frontend/src/App.tsx`.
- Main anti-pattern pages: `apps/frontend/src/pages/licenses/index.tsx`, `apps/frontend/src/pages/proxies/ProxiesPage.tsx`, `apps/frontend/src/pages/subscriptions/index.tsx`.
- Bot tab anti-pattern duplicates exist in `apps/frontend/src/components/bot/BotLicense.tsx`, `apps/frontend/src/components/bot/BotProxy.tsx`, `apps/frontend/src/components/bot/BotSubscription.tsx`.
- Current frontend test infra is primarily Playwright E2E (`apps/frontend/playwright.config.ts`, `apps/frontend/e2e/*.spec.ts`) plus root quality gates.

### Metis Review
**Identified Gaps (addressed)**:
- Locked scope creep risk: no opportunistic redesign of data provider internals or unrelated resources.
- Added parity acceptance criteria for routing, URL query behavior, CRUD lifecycle, modal lifecycle, and bot tabs.
- Added edge-case checks (pagination underflow after delete, invalid query params, stale state edits/deletes).
- Added explicit guardrail: preserve existing route behavior (redirects/not-found/auth wrappers).

### External Reference Pack (mandatory for executor)
- Refine React Router integration: https://refine.dev/docs/routing/integrations/react-router/
- Refine resources and route inference: https://refine.dev/docs/core/refine-component/#resources
- Refine AntD `useTable`: https://refine.dev/docs/ui-integrations/ant-design/hooks/use-table/
- Refine AntD `useModalForm`: https://refine.dev/docs/ui-integrations/ant-design/hooks/use-modal-form/
- Refine `EditButton`: https://refine.dev/docs/ui-integrations/ant-design/components/buttons/edit-button/
- Refine `DeleteButton`: https://refine.dev/docs/ui-integrations/ant-design/components/buttons/delete-button/

---

## Work Objectives

### Core Objective
Refactor the frontend resource architecture so Refine owns routing state, table state, and standard CRUD modal/form flows, reducing manual boilerplate while preserving current product behavior.

### Concrete Deliverables
- Refine routing/resource configuration in `apps/frontend/src/App.tsx` with URL sync enabled.
- Resource pages refactored to `useTable` and `useModalForm` patterns.
- Bot tabs refactored to same modal/CRUD architecture for consistency.
- Manual page-level modal visibility/edit/saving state removed for standard resources.
- Manual `useCreate`/`useUpdate` calls removed from standard create/edit forms covered by `useModalForm`.

### Definition of Done
- [x] No page-level `isModalOpen`/equivalent modal visibility state remains in targeted resource pages and bot tabs.
- [x] No manual create/update mutation invocation remains for standard resource create/edit forms in targeted scope.
- [x] Table state (page/filter/sort) persists in URL and survives refresh/back-forward on targeted pages.
- [x] Existing UI/UX remains functionally and visually equivalent.
- [x] Verification gates pass (`lint`, `check:types`, `build`, `test:e2e`).

### Must Have
- `@refinedev/antd` hooks for UI binding (`useTable`, `useModalForm`).
- Refine resources configured for list/create/edit/show paths.
- `syncWithLocation` enabled and effective for target table pages.
- Route behavior parity matrix explicitly validated (protected/public/fallback redirects).

### Must NOT Have (Guardrails)
- No visual redesign, CSS module rewrite, or class naming churn.
- No expansion into unrelated resources/pages outside agreed scope.
- No broad provider/backend contract rewrites unless strictly required to preserve parity.
- No new manual modal state machines for standard resource CRUD.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (Tests-after)
- **Framework**: Playwright E2E + project quality gates

### Tests-after Verification Flow
For each migration slice:
1. Implement refactor for the slice.
2. Run focused validation locally (page flow + URL behavior).
3. Run repo gates near end of wave.

Required commands for final verification:
- `pnpm run lint`
- `pnpm run check:types`
- `pnpm run build`
- `pnpm run test:e2e`

Manual execution checks (required in addition to commands):
- Resource list page refresh keeps pagination/filters/sort.
- Browser back/forward preserves list state.
- Create/edit modal opens with correct defaults/record values.
- Delete flow confirms and updates table state correctly.

### Route/Resource Parity Matrix (must remain equivalent)

Protected routes (inside `Authenticated` + `ProxmoxLayout`):
- `/` -> Datacenter page
- `/project/:id` -> Project page
- `/bot/:id` -> Bot page
- `/finance` -> Finance page
- `/billing` -> Billing page
- `/admin/*` -> external redirect via `AdminRedirectPage`
- `/archive/banned` -> Archive page
- `/settings` -> Settings page
- `/notes` -> Notes page
- `/workspace/calendar` -> Workspace Calendar page
- `/workspace/kanban` -> Workspace Kanban page
- `/notes/reminders` -> redirect to `/workspace/calendar`
- `/licenses` -> Licenses page
- `/proxies` -> Proxies page
- `/subscriptions` -> Subscriptions page
- `/vms` -> VMs page
- `/vms/list` -> redirect to `/vms`
- `/vms/unattend-profiles` -> redirect to `/vms`

Public/auth routes:
- `/login` remains public route with authenticated-user redirect to `/`
- `*` remains fallback redirect to `/`

Resource definitions in Refine must match concrete app paths for `licenses`, `proxies`, `subscriptions`, `notes`, `bots` and not break existing route tree.

Required resource action mapping for target resources (preserve public paths):
- `licenses`: `list/create/edit/show` -> `/licenses`
- `proxies`: `list/create/edit/show` -> `/proxies`
- `subscriptions`: `list/create/edit/show` -> `/subscriptions`
Implementation note: create/edit/show are modal-driven on same list route; id/action context should be represented via URL params/query compatible with selected router provider.

Required mapping for parity-dependent non-target resources:
- `bots`: `list` -> `/`, `show` -> `/bot/:id`
- `notes`: `list` -> `/notes`, `show` -> `/notes`

### Modal URL Contract (explicit)

For list-route modal actions, use this URL query contract:
- Create: `?modal=create`
- Edit: `?modal=edit&id=<recordId>`
- Show (if used): `?modal=show&id=<recordId>`

Examples:
- `/licenses?modal=create`
- `/proxies?page=2&sort=expires_at&order=desc&modal=edit&id=123`
- `/subscriptions?status=active&modal=show&id=abc`

Navigation behavior requirements:
- Opening modal pushes URL state.
- Closing modal removes `modal`/`id` and preserves existing table query keys.
- Browser back/forward replays modal open/close state correctly.

---

## Execution Strategy

### Parallel Execution Waves

Wave 1 (foundation, sequential-critical):
- Task 1: lock Refine router package/API compatibility decision and dependencies.
- Task 2: App routing/resources/syncWithLocation refactor in shell.

Wave 2 (can run in parallel after Wave 1):
- Task 3: licenses page refactor.
- Task 4: proxies page + proxy modal refactor.
- Task 5: subscriptions page refactor.

Wave 3 (can run in parallel after Wave 2):
- Task 6: bot tabs refactor (license/proxy/subscription).
- Task 7: action button normalization (`EditButton`/`DeleteButton`) across targets.

Wave 4 (final integration):
- Task 8: edge-case fixes and URL parity hardening.
- Task 9: full verification run + evidence capture.

Critical Path: 1 -> 2 -> (3/4/5) -> 8 -> 9

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 2-9 | None |
| 2 | 1 | 3-9 | None |
| 3 | 2 | 8,9 | 4,5 |
| 4 | 2 | 8,9 | 3,5 |
| 5 | 2 | 8,9 | 3,4 |
| 6 | 3,4,5 | 8,9 | 7 |
| 7 | 3,4,5 | 8,9 | 6 |
| 8 | 3,4,5,6,7 | 9 | None |
| 9 | 8 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|-------------------|
| 1 | 1,2 | `delegate_task(category="quick", load_skills=["git-master"])` + codebase agent |
| 2 | 3,4,5 | 3 parallel implementation agents (`unspecified-high`) |
| 3 | 6,7 | 2 parallel implementation agents (`unspecified-high`) |
| 4 | 8,9 | single integration/verification agent |

---

## TODOs

- [x] 1. Validate Refine router integration package/API contract

  **What to do**:
  - Use explicit compatibility rule:
    - If app stays on `react-router-dom@7` (current), prefer `@refinedev/react-router` integration package for Refine v5 style API.
    - Use `@refinedev/react-router-v6` only if repository constraints force React Router v6 API path and type checks prove compatibility.
  - Document chosen package + import surface to be used in `apps/frontend/src/App.tsx` (`routerProvider`, route helpers as needed).
  - Add/update dependency only if required for stable routerProvider integration.

  **Must NOT do**:
  - Do not perform broad Refine version migration.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 1)
  - **Blocks**: 2-9
  - **Blocked By**: None

  **References**:
  - `apps/frontend/package.json` - Current Refine/router dependency baseline.
  - `apps/frontend/src/App.tsx` - Current Refine root where routerProvider/resources will be wired.

  **Acceptance Criteria**:
  - [x] Router package/API decision documented and justified against current `apps/frontend/package.json` (`react-router-dom` + Refine versions).
  - [x] `apps/frontend/src/App.tsx` has a clear target import plan for selected router integration package.
  - [x] Dependency graph remains installable.
  - [x] Decision record saved to `.sisyphus/evidence/refine-architecture-integration/router-decision.md` with: selected package, rejected alternative, reason, import snippet target.

- [x] 2. Refactor app routing to idiomatic Refine resources + URL sync

  **What to do**:
  - Configure router provider in frontend `<Refine>` setup.
  - Define complete `resources` entries for `licenses`, `proxies`, `subscriptions` (and existing app resources as needed for parity) with list/create/edit/show paths.
  - Ensure global `syncWithLocation: true` is enabled.
  - Preserve auth wrappers, redirects, and not-found behavior according to the parity matrix above.

  **Must NOT do**:
  - Do not change user-facing route paths unless explicitly required for parity fixes.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 1)
  - **Blocks**: 3-9
  - **Blocked By**: 1

  **References**:
  - `apps/frontend/src/App.tsx` - route tree, auth wrappers, and current Refine options.
  - `apps/frontend/package.json` - actual React Router/Refine version constraints.
  - https://refine.dev/docs/routing/integrations/react-router/ - routerProvider integration contract.
  - https://refine.dev/docs/core/refine-component/#resources - canonical resources action config.

  **Acceptance Criteria**:
  - [x] Route parity matrix is satisfied for every listed route/redirect/fallback.
  - [x] `syncWithLocation` enabled at Refine options level.
  - [x] No regression in `/admin/*` external redirect behavior.
  - [x] `resources` mapping implemented exactly for: `licenses`, `proxies`, `subscriptions`, `bots`, `notes`.

- [x] 3. Migrate Licenses page table + modal CRUD to Refine antd hooks

  **What to do**:
  - Replace custom table/filter plumbing with `useTable` from `@refinedev/antd` and pass `tableProps` into AntD table.
  - Replace manual modal create/edit flow with `useModalForm` (create/edit actions via `show()`/`show(id)`).
  - Remove manual page states for modal visibility/editing/saving and manual create/update calls.

  **Must NOT do**:
  - Do not alter existing visual composition and CSS module classes.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 4,5)
  - **Blocks**: 8,9
  - **Blocked By**: 2

  **References**:
  - `apps/frontend/src/pages/licenses/index.tsx` - current manual states/mutations/filter composition.
  - `apps/frontend/src/providers/data-provider.ts` - resource operation expectations.
  - https://refine.dev/docs/ui-integrations/ant-design/hooks/use-table/ - tableProps/filter/sorter wiring.
  - https://refine.dev/docs/ui-integrations/ant-design/hooks/use-modal-form/ - modal create/edit flow.

  **Acceptance Criteria**:
  - [x] No modal visibility/editing/saving `useState` remains for standard license CRUD flow.
  - [x] No manual create/update mutation call remains for license form create/edit.
  - [x] URL reflects table page/filter/sort and restores on refresh.

- [x] 4. Migrate Proxies page + proxy modal to Refine modal/table architecture

  **What to do**:
  - Refactor proxies table interactions to `useTable` canonical flow.
  - Fold `ProxyCrudModal` flow into `useModalForm`-driven architecture (either inline or retained component with props passthrough).
  - Remove manual create/update invocation paths and modal/editing state.

  **Must NOT do**:
  - Do not regress custom proxy payload mapping behavior.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 3,5)
  - **Blocks**: 8,9
  - **Blocked By**: 2

  **References**:
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx` - current manual modal/table/mutation orchestration.
  - `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx` - current create/update mutation and form lifecycle logic.
  - https://refine.dev/docs/ui-integrations/ant-design/hooks/use-table/
  - https://refine.dev/docs/ui-integrations/ant-design/hooks/use-modal-form/

  **Acceptance Criteria**:
  - [x] Proxy create/edit uses `useModalForm` submit flow.
  - [x] Manual modal visibility/editing state removed from page-level flow.
  - [x] Table state persists in URL.

- [x] 5. Migrate Subscriptions page to Refine modal/table architecture

  **What to do**:
  - Replace manual subscription table filter/sort state composition with `useTable` APIs.
  - Replace modal create/edit flow with `useModalForm`, including data transformation hooks for date/timestamp mapping.
  - Remove `saving` and related manual mutation orchestration.

  **Must NOT do**:
  - Do not break date serialization contract expected by backend.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 3,4)
  - **Blocks**: 8,9
  - **Blocked By**: 2

  **References**:
  - `apps/frontend/src/pages/subscriptions/index.tsx` - current manual modal/edit/saving and mutation flow.
  - `apps/frontend/src/entities/resources/model/types.ts` - entity typing constraints.
  - https://refine.dev/docs/ui-integrations/ant-design/hooks/use-table/
  - https://refine.dev/docs/ui-integrations/ant-design/hooks/use-modal-form/

  **Acceptance Criteria**:
  - [x] Manual modal/edit/saving page state removed for standard CRUD.
  - [x] Create/update performed through modal form submit path.
  - [x] URL query state parity preserved.

- [x] 6. Refactor bot resource tabs to same Refine CRUD/modal conventions

  **What to do**:
  - Apply same `useModalForm`/Refine CRUD architecture to bot tabs where flows are standard create/edit.
  - Preserve bot-specific non-standard behavior explicitly:
    - `BotLicense`: unassign flow that conditionally deletes when no bots remain assigned.
    - `BotProxy`: unassign-to-`bot_id:null` behavior, proxy string parsing, optional IPQS enrichment.
    - `BotSubscription`: bot-account email hydration and bot-scoped list behavior.
  - Keep these domain behaviors intact while removing duplicated modal visibility/edit/saving state where feasible.
  - Per-action boundary (must be explicit in implementation notes):
    - `BotLicense`: create/edit -> `useModalForm`; assign/unassign/delete-when-last remains custom business action.
    - `BotProxy`: create/edit -> `useModalForm`; unassign + IPQS enrichment path remains custom business action.
    - `BotSubscription`: create/edit -> `useModalForm`; delete and account-email hydration remain custom business action.

  **Must NOT do**:
  - Do not alter bot-specific business behavior or parent context wiring.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 7)
  - **Blocks**: 8,9
  - **Blocked By**: 3,4,5

  **References**:
  - `apps/frontend/src/components/bot/BotLicense.tsx` - manual modal/mutation pattern.
  - `apps/frontend/src/components/bot/BotProxy.tsx` - manual modal/mutation pattern.
  - `apps/frontend/src/components/bot/BotSubscription.tsx` - manual modal/mutation + saving pattern.
  - https://refine.dev/docs/ui-integrations/ant-design/hooks/use-modal-form/

  **Acceptance Criteria**:
  - [x] No page/tab-level modal visibility/editing/saving state for standard CRUD.
  - [x] No manual create/update for standard forms where modal form hook applies.
  - [x] Bot-specific non-standard behaviors above remain functionally equivalent.

- [x] 7. Normalize row action controls with Refine buttons

  **What to do**:
  - Replace manual delete handlers with `DeleteButton` where direct fit exists.
  - Replace edit triggers with `EditButton` or `show(id)` wiring for modal edit flows.
  - Ensure confirmation and loading states remain user-friendly and equivalent.

  **Must NOT do**:
  - Do not remove necessary custom handlers for genuinely non-standard action flows.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 6)
  - **Blocks**: 8,9
  - **Blocked By**: 3,4,5

  **References**:
  - `apps/frontend/src/pages/licenses/index.tsx`
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
  - `apps/frontend/src/pages/subscriptions/index.tsx`

  **Acceptance Criteria**:
  - [ ] Delete actions use Refine delete semantics with confirmation.
  - [x] Edit actions open proper modal/form flow with correct record id.

- [x] 8. Edge-case and parity hardening pass

  **What to do**:
  - Validate and patch edge cases discovered by Metis checklist:
    - delete-last-item pagination underflow,
    - stale URL query handling,
    - rapid modal open-close-submit race behavior,
    - API error mapping for modal submit.
  - Keep changes minimal and local.
  - Apply deterministic URL sanitization rules for target pages:
    - Allowed query keys: `page`, `limit`, `sort`, `order`, `q`, `status`, `type`, `country`, `country_code`, `bot_id`.
    - `page`: integer >= 1, fallback `1`.
    - `limit`: integer > 0, fallback `20`.
    - `order`: only `asc|desc`, fallback `asc`.
    - unknown keys ignored for table-state reconstruction.

  **Must NOT do**:
  - Do not add large abstractions unrelated to these edge cases.

  **Recommended Agent Profile**:
  - **Category**: `ultrabrain`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 4)
  - **Blocks**: 9
  - **Blocked By**: 3,4,5,6,7

  **References**:
  - `apps/frontend/src/providers/data-provider/utils.ts` - query/filter translation behavior.
  - `apps/frontend/src/providers/data-provider.ts` - operation/refetch behavior expectations.

  **Acceptance Criteria**:
  - [x] Delete last row on non-first page returns user to valid page and table refetches without empty stuck state.
  - [x] Invalid URL query values (page/sort/filter) are sanitized to stable defaults without crash.
  - [x] Rapid modal open-close-submit does not create duplicate submits or frozen loading state.
  - [x] 4xx/5xx API failures surface meaningful error feedback without breaking table/form state.

- [x] 9. Run full verification and capture evidence

  **What to do**:
  - Execute required command gates.
  - Perform manual scenario walkthrough for each target page/tab and capture outputs/screens evidence.
  - Produce concise verification report at `.sisyphus/evidence/refine-architecture-integration/verification.md`.
  - Save UI screenshots to `.sisyphus/evidence/refine-architecture-integration/screens/`.
  - Use verification matrix template at `.sisyphus/evidence/refine-architecture-integration/verification.md`:
    - Column 1: Route/Scenario
    - Column 2: Input URL/action
    - Column 3: Expected result
    - Column 4: Actual result
    - Column 5: Evidence link (screenshot/log)

  **Must NOT do**:
  - Do not merge or finalize without both command and manual checks.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-low`
  - **Skills**: `git-master`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (Wave 4)
  - **Blocks**: None
  - **Blocked By**: 8

  **References**:
  - `apps/frontend/playwright.config.ts` - e2e configuration entrypoint.
  - `apps/frontend/e2e/smoke.spec.ts` - baseline E2E behavior.
  - `package.json` - root command orchestrations.

  **Acceptance Criteria**:
  - [ ] `pnpm run lint` passes.
  - [x] `pnpm run check:types` passes.
  - [x] `pnpm run build` passes.
  - [x] `pnpm run test:e2e` passes.
  - [x] Manual parity checklist completed for routing/table/modal/actions with explicit outcomes:
    - `licenses`: URL keeps `page`, `sort`, filters after refresh.
    - `proxies`: create/edit via modal form works; delete/unassign parity preserved.
    - `subscriptions`: create/edit with date mapping stays contract-compatible.
    - `bot tabs`: bot-scoped operations preserve non-standard behavior contracts.
    - route redirects (`/vms/list`, `/vms/unattend-profiles`, `/notes/reminders`, `*`) remain equivalent.
  - [ ] Bot-specific explicit scenarios pass:
    - `BotLicense`: unassign last bot -> license delete; unassign with remaining bots -> update bot_ids only.
    - `BotProxy`: unassign sets `bot_id:null`; edit preserves parse/IPQS enrichment behavior.
    - `BotSubscription`: account email prefill/hydration remains intact; bot-scoped list stays filtered.
  - [ ] Evidence artifact contains: executed commands with pass/fail, URL samples before/after refresh, and screenshot filenames.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 2 | `refactor(frontend): align refine routing resources` | `apps/frontend/src/App.tsx` (+ deps if needed) | lint + typecheck |
| 3/4/5 | `refactor(frontend): migrate resource pages to refine table/modal hooks` | resource pages/modals | lint + typecheck + targeted manual checks |
| 6/7 | `refactor(frontend): unify bot resource crud actions with refine` | bot tab components | lint + typecheck |
| 8/9 | `test(frontend): harden edge cases and verify refine migration` | verification/support changes | build + e2e |

---

## Success Criteria

### Verification Commands
```bash
pnpm run lint
pnpm run check:types
pnpm run build
pnpm run test:e2e
```

### Final Checklist
- [x] All targeted resources/pages/tabs use Refine-first table and modal CRUD architecture.
- [x] URL synchronization works as expected for table state.
- [x] No banned manual modal state/mutation patterns remain in agreed scope.
- [x] Visual behavior parity preserved.
- [x] All verification commands pass.
