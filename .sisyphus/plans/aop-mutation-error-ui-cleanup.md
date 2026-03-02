# AOP Mutation Error Handling and UI State Cleanup

## TL;DR
> **Summary**: Refactor frontend mutation flows to remove local try/catch/loading boilerplate, centralize mutation error toasts in QueryClient, and move success toasts into mutation hooks with explicit ownership rules.
> **Deliverables**:
> - Global frontend `MutationCache.onError` interceptor with normalized error extraction and dedupe guard
> - Migrated frontend mutation hooks with success toast ownership and invalidate/cache behavior preserved
> - Frontend UI handlers migrated from `mutateAsync + try/catch + local saving` to `mutate(..., { onSuccess }) + isPending` where safe
> - Exception allowlist for legitimate `mutateAsync` orchestration paths
> - Objective completion gates (grep/ast + typecheck/build/lint + QA evidence)
> **Effort**: Large
> **Parallel**: YES - 5 waves
> **Critical Path**: 1 -> 2 -> 3 -> 9 -> 10 -> F1-F4

## Context
### Original Request
Epic: aspect-oriented error handling and UI mutation state cleanup; remove try/catch hell, use global mutation error handling in React Query, move success messaging to hooks, and make components thin.

### Interview Summary
- Scope confirmed: full frontend migration.
- Priority files remain mandatory: `apps/frontend/src/features/bot-account/BotAccount.tsx`, `apps/frontend/src/widgets/bot-profile/ui/BotPerson.tsx`, `apps/frontend/src/widgets/vm/settingsForm/PlaybookTab.tsx`, `apps/frontend/src/widgets/vm/settingsForm/SecretField.tsx`.
- User emphasized: tests are useful for regression, but completion must also prove engineering quality and code cleanliness.
- Strategy selected: tests-after with non-test structural completion gates.

### Metis Review (gaps addressed)
- Added ownership contract to prevent duplicate toasts across global/hook/component layers.
- Added strict `mutateAsync` exception allowlist for sequencing/composition flows.
- Added anti-pattern eradication gates using grep/AST, not tests-only validation.
- Added guardrails for callback ordering/unmount behavior and non-conversion of orchestration flows.

## Work Objectives
### Core Objective
Establish a single frontend mutation execution model: global fallback error handling, hook-level success ownership, and thin UI handlers using mutation state directly.

### Deliverables
- Updated frontend query client with `MutationCache` global error handler.
- Standardized success toast placement in mutation hooks.
- Refactored UI mutation handlers across frontend from imperative to callback-driven model.
- Documented and enforced `mutateAsync` exception allowlist.
- Evidence artifacts for each task in `.sisyphus/evidence/`.

### Definition of Done (verifiable conditions with commands)
- `pnpm --filter @botmox/frontend typecheck` exits 0.
- `pnpm --filter @botmox/frontend lint` exits 0.
- `pnpm --filter @botmox/frontend build` exits 0.
- `grep "new MutationCache\(" apps/frontend/src/shared/lib/query/queryClient.ts` returns exactly one frontend interceptor definition.
- `grep "mutateAsync\(" apps/frontend/src` returns only approved exception allowlist paths.
- `ast_grep_search` for UI `try { ... mutateAsync(...) ... } catch` in migrated scopes returns no matches.

### Must Have
- No local `saving/submitting` state for mutation progress in migrated component handlers.
- No local `message.error` for mutation failures in migrated component handlers.
- Local flow actions (`closeModal`, `resetFields`, unlock flags) executed from `mutate(..., { onSuccess })`.
- Global error handler extracts readable message from `ApiClientError` or generic fallback.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No blanket conversion of valid orchestration flows that require awaited mutation results.
- No duplicate success/error toasts between hook and component/global layers.
- No migration of non-mutation async flows (pure data loading, validation-only try/catch) unless tied to mutation anti-pattern cleanup.
- No scope expansion to `apps/admin` in this epic.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + existing frontend quality gates.
- QA policy: every task includes executable happy and failure scenarios with saved evidence.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave.

Wave 1: foundation contract and global interception (Tasks 1-3)
Wave 2: hook-layer migration by domain slices (Tasks 4-7)
Wave 3: priority UI surgical cleanup (Tasks 8-11)
Wave 4: broad UI migration by feature clusters (Tasks 12-15)
Wave 5: exception reconciliation and hardening gates (Tasks 16-18)

### Dependency Matrix (full, all tasks)
- 1 blocks 2, 3, 4-18
- 2 blocks 4-18
- 3 blocks 8-15
- 4 blocks 8, 12, 13
- 5 blocks 9, 12
- 6 blocks 10, 13
- 7 blocks 11, 14, 15
- 8-15 block 16
- 16 blocks 17
- 17 blocks 18
- 18 blocks F1-F4

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 3 tasks -> `deep`, `quick`
- Wave 2 -> 4 tasks -> `general`, `quick`
- Wave 3 -> 4 tasks -> `quick`, `unspecified-low`
- Wave 4 -> 4 tasks -> `general`, `unspecified-low`
- Wave 5 -> 3 tasks -> `deep`, `unspecified-high`
- Final Verification -> 4 tasks -> `oracle`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task has Agent Profile + Parallelization + QA Scenarios.


- [x] 17. Execute Frontend Quality Gates and Capture Outputs

  **What to do**: Run mandatory frontend quality commands after migration and store raw outputs in evidence artifacts.
  **Must NOT do**: Do not skip failing commands; do not mask non-zero exits.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: final quality confidence gate.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - no UI construction.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: [18, F1-F4] | Blocked By: [16]

  **References** (executor has NO interview context - be exhaustive):
  - Build/typecheck scripts: `apps/frontend/package.json`.
  - Root orchestration scripts: `package.json`.

  **Acceptance Criteria** (agent-executable only):
  - [x] `pnpm --filter @botmox/frontend typecheck` exits 0.
  - [x] `pnpm --filter @botmox/frontend lint` exits 0.
  - [x] `pnpm --filter @botmox/frontend build` exits 0.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Typecheck gate
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend typecheck`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-17-typecheck.txt

  Scenario: Lint and build gates
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend lint && pnpm --filter @botmox/frontend build`
    Expected: Exit code 0 for both commands
    Evidence: .sisyphus/evidence/task-17-lint-build.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/evidence/task-17-*`

- [x] 18. Final Contract Conformance Audit and Evidence Index

  **What to do**: Create final conformance report for this epic: ownership contract coverage, allowlist conformance, anti-pattern delta before/after, and remaining intentional exceptions.
  **Must NOT do**: Do not claim full eradication without command evidence.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: closes decision loop and prevents silent regression.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['test']` - synthesis task, not test generation.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: [F1-F4] | Blocked By: [16, 17]

  **References** (executor has NO interview context - be exhaustive):
  - Baseline evidence: `.sisyphus/evidence/task-3-*`.
  - Sweep evidence: `.sisyphus/evidence/task-16-*`.
  - Quality gate evidence: `.sisyphus/evidence/task-17-*`.

  **Acceptance Criteria** (agent-executable only):
  - [x] Final report lists all allowlisted `mutateAsync` files with rationale.
  - [x] Final report includes before/after counts for `mutateAsync`, mutation `try/catch`, and local saving booleans.
  - [x] All evidence file paths are valid and present.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Evidence completeness check
    Tool: Bash
    Steps: Verify referenced evidence files exist under `.sisyphus/evidence/`
    Expected: No missing files
    Evidence: .sisyphus/evidence/task-18-evidence-check.txt

  Scenario: Final conformance summary generation
    Tool: Bash
    Steps: Generate report from grep/AST outputs and quality command logs
    Expected: Report includes counts, allowlist, and pass/fail status per gate
    Evidence: .sisyphus/evidence/task-18-conformance-report.md
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/evidence/task-18-*`


- [x] 13. Refactor Bot Profile Widget Cluster

  **What to do**: Migrate mutation handlers in bot-profile widgets (`BotCharacterWidget`, `BotSchedule`, `BotLicense`, `BotProxy`, `BotSubscription`, `BotLifeStagesWidget`) to callback-driven mutate flow and hook/global toast ownership.
  **Must NOT do**: Do not modify domain-specific generation, scheduling, or lifecycle business logic.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: multiple related widgets sharing bot mutation patterns.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - no design changes.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [16] | Blocked By: [3, 4, 6]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotCharacterWidget.tsx`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotSchedule.tsx`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotLicense.tsx`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotProxy.tsx`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotSubscription.tsx`.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotLifeStagesWidget.tsx`.
  - Hook source: `apps/frontend/src/entities/bot/api/use*Mutations.ts`.

  **Acceptance Criteria** (agent-executable only):
  - [x] No mutation-specific local `saving/submitting` flags in migrated bot-profile widgets.
  - [x] No component-level mutation try/catch for handled mutation flows.
  - [x] `mutateAsync` removed except for documented allowlist cases.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Bot profile anti-pattern sweep
    Tool: Grep
    Steps: Search listed bot-profile files for `mutateAsync(` and `setSaving(`
    Expected: Matches only in allowlist exceptions (if any), none for routine button handlers
    Evidence: .sisyphus/evidence/task-13-botprofile-grep.txt

  Scenario: Build health after cluster migration
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend build`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-13-botprofile-build.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): cleanup mutation boilerplate in bot profile widgets` | Files: `apps/frontend/src/widgets/bot-profile/ui/*.tsx`

- [x] 14. Refactor Notes, Finance, Licenses, Proxies, Project Mutation UIs

  **What to do**: Migrate mutation handlers in `NoteEditor`, `NoteSidebar`, `pages/finance`, `pages/licenses`, `pages/proxies`, `pages/project` to mutate callbacks and mutation pending state.
  **Must NOT do**: Do not alter CRUD payload schemas or service contract signatures.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: broad but repetitive cleanup across feature pages.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['test']` - no new framework setup.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [16] | Blocked By: [3, 7]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/notes-editor/NoteEditor.tsx`.
  - Pattern: `apps/frontend/src/widgets/notes-editor/NoteSidebar.tsx`.
  - Pattern: `apps/frontend/src/pages/finance/index.tsx`.
  - Pattern: `apps/frontend/src/pages/licenses/index.tsx`.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx`.
  - Pattern: `apps/frontend/src/pages/project/index.tsx`.
  - Hook sources: `apps/frontend/src/entities/notes/api/useNoteMutations.ts`, `apps/frontend/src/entities/resources/api/**`.

  **Acceptance Criteria** (agent-executable only):
  - [x] Mutation button handlers in listed files are callback-driven (`mutate`) where no allowlist exception applies.
  - [x] Component-level mutation error toasts removed for globally/hook-handled cases.
  - [x] Local UI completion effects remain functional via `onSuccess` callbacks.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Feature cluster mutateAsync cleanup
    Tool: Grep
    Steps: Search listed files for `mutateAsync(` and classify residue vs allowlist
    Expected: Non-allowlisted usage removed
    Evidence: .sisyphus/evidence/task-14-featurecluster-grep.txt

  Scenario: Lint after cluster migration
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend lint`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-14-featurecluster-lint.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): migrate notes finance licenses proxies project mutation handlers` | Files: `apps/frontend/src/{widgets/notes-editor,pages/finance,pages/licenses,pages/proxies,pages/project}/**`

- [x] 15. Refactor VM Widget/Hook Mutation Call Sites (Non-Exception Paths)

  **What to do**: Migrate routine VM mutation call sites (`VMCommandPanel`, `VMConfigPreview`, `VMOperationLog`, `VMSettingsForm`, `settingsForm/UnattendTab`) to mutate callback/pending model; preserve orchestration exceptions explicitly.
  **Must NOT do**: Do not convert known sequencing flows needing awaited results (`useVmListController` upid/task chain).

  **Recommended Agent Profile**:
  - Category: `general` - Reason: mixed complexity with valid exceptions.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - no visual redesign.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [16] | Blocked By: [3, 7]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/vm/VMCommandPanel.tsx`.
  - Pattern: `apps/frontend/src/widgets/vm/VMConfigPreview.tsx`.
  - Pattern: `apps/frontend/src/widgets/vm/VMOperationLog.tsx`.
  - Pattern: `apps/frontend/src/widgets/vm/VMSettingsForm.tsx`.
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/UnattendTab.tsx`.
  - Exception reference: `apps/frontend/src/widgets/vm/useVmListController.ts`.

  **Acceptance Criteria** (agent-executable only):
  - [x] Routine VM mutation handlers no longer use local try/catch/finally boilerplate.
  - [x] VM sequencing paths in exception allowlist retain safe `mutateAsync` behavior.
  - [x] Mutation loading in migrated VM components uses `isPending`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: VM call-site cleanup with exception preservation
    Tool: Grep
    Steps: Search VM widget files for `mutateAsync(` and compare to allowlist
    Expected: Only approved orchestration files keep `mutateAsync`
    Evidence: .sisyphus/evidence/task-15-vm-grep.txt

  Scenario: Frontend typecheck after VM migration
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend typecheck`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-15-vm-typecheck.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): cleanup vm mutation call sites with explicit async exceptions` | Files: `apps/frontend/src/widgets/vm/**`

- [x] 16. Run Frontend-Wide Anti-Pattern Eradication Sweep

  **What to do**: Execute full frontend sweep to remove residual mutation anti-patterns: `mutateAsync` in non-allowlisted UI handlers, local saving/submitting duplication, and try/catch for mutation error-toasts.
  **Must NOT do**: Do not alter allowlisted exception files; do not touch non-frontend app code.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: correctness sweep across many files with exceptions.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - not a visual task.

  **Parallelization**: Can Parallel: NO | Wave 5 | Blocks: [17, 18] | Blocked By: [8-15]

  **References** (executor has NO interview context - be exhaustive):
  - Baseline inventory evidence: `.sisyphus/evidence/task-3-mutateasync-baseline.txt`.
  - Priority files: `apps/frontend/src/features/bot-account/BotAccount.tsx`, `apps/frontend/src/widgets/bot-profile/ui/BotPerson.tsx`, `apps/frontend/src/widgets/vm/settingsForm/PlaybookTab.tsx`, `apps/frontend/src/widgets/vm/settingsForm/SecretField.tsx`.
  - Exception anchor: `apps/frontend/src/widgets/vm/useVmListController.ts`.

  **Acceptance Criteria** (agent-executable only):
  - [x] `grep "mutateAsync\(" apps/frontend/src` output matches only allowlist files.
  - [x] Grep for local mutation loading booleans (`saving|submitting`) is reduced to non-mutation or allowlisted scenarios.
  - [x] AST search for mutation try/catch wrappers in migrated UI files returns no matches.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: mutateAsync residue gate
    Tool: Grep
    Steps: Run grep `mutateAsync\(` against frontend source
    Expected: Results equal allowlist exactly
    Evidence: .sisyphus/evidence/task-16-mutateasync-gate.txt

  Scenario: Mutation try/catch structural gate
    Tool: AST-grep
    Steps: Run AST query for `try/catch` in migrated frontend TSX scopes
    Expected: No mutation-wrapper matches outside allowlist
    Evidence: .sisyphus/evidence/task-16-trycatch-gate.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): complete mutation anti-pattern eradication sweep` | Files: `apps/frontend/src/**`


- [x] 9. Refactor Priority Component: BotPerson

  **What to do**: In `BotPerson.tsx`, remove local mutation `saving` flow and mutation `try/catch` wrappers; migrate save/unlock handlers to `mutate(..., { onSuccess })` and `updateBotMutation.isPending`.
  **Must NOT do**: Do not change random person generation behavior or country persistence logic.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: isolated but multi-handler component migration.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - no design work.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [16] | Blocked By: [3, 4]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/BotPerson.tsx`.
  - Hook contract: `apps/frontend/src/entities/bot/api/useBotMutations.ts`.

  **Acceptance Criteria** (agent-executable only):
  - [x] `BotPerson.tsx` save/unlock mutation handlers no longer use `mutateAsync`.
  - [x] Component-level mutation `message.error` handling removed for migrated handlers.
  - [x] `saving` mutation state replaced by mutation `isPending`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: BotPerson mutation boilerplate removed
    Tool: Grep
    Steps: Search `BotPerson.tsx` for `mutateAsync(`, `setSaving(`, `try {`, `catch (` around mutation handlers
    Expected: No mutation anti-pattern remains for migrated flows
    Evidence: .sisyphus/evidence/task-9-botperson-grep.txt

  Scenario: Lint stability
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend lint`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-9-botperson-lint.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): simplify BotPerson mutation handlers` | Files: `apps/frontend/src/widgets/bot-profile/ui/BotPerson.tsx`

- [x] 10. Refactor Priority Component: PlaybookTab

  **What to do**: Replace local `saving` toggle pattern in `PlaybookTab.tsx` mutation-like save/delete handlers with mutation-driven pending state through dedicated hooks/adapters where needed; remove repetitive try/catch toast handling for mutation operations.
  **Must NOT do**: Do not modify YAML editor behavior, import/export semantics, or validation UI semantics.

  **Recommended Agent Profile**:
  - Category: `unspecified-low` - Reason: moderate refactor in a larger component with multiple actions.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - interaction model stays unchanged.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [16] | Blocked By: [3, 6]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/PlaybookTab.tsx`.
  - API: `apps/frontend/src/entities/vm/api/playbookFacade.ts`.
  - VM mutation style: `apps/frontend/src/entities/vm/api/useVmActionMutations.ts`.

  **Acceptance Criteria** (agent-executable only):
  - [x] Save/delete mutation flows no longer use manual `setSaving(true/false)` wrappers.
  - [x] Error display for mutation failures is delegated to global/hook ownership contract.
  - [x] Button loading states are tied to mutation pending state, not duplicated booleans.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: PlaybookTab anti-pattern removed
    Tool: Grep
    Steps: Search `PlaybookTab.tsx` for `setSaving(` and mutation operation `try/catch` wrappers
    Expected: No save/delete mutation boilerplate with local saving toggles
    Evidence: .sisyphus/evidence/task-10-playbook-grep.txt

  Scenario: Build after VM settings form refactor
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend build`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-10-playbook-build.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): remove manual mutation state handling in PlaybookTab` | Files: `apps/frontend/src/widgets/vm/settingsForm/PlaybookTab.tsx`, `apps/frontend/src/entities/vm/api/**`

- [x] 11. Refactor Priority Component: SecretField

  **What to do**: In `SecretField.tsx`, migrate save operation to mutation-driven flow (`mutate + onSuccess`) with `isPending` and remove local mutation try/catch/error toast boilerplate.
  **Must NOT do**: Do not alter modal UX copy, binding shape, or secret rotation semantics.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: small focused component.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['test']` - existing gates sufficient.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [16] | Blocked By: [3, 7]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/vm/settingsForm/SecretField.tsx`.
  - API: `apps/frontend/src/entities/vm/api/secretsFacade.ts`.
  - Similar pattern target: `apps/frontend/src/features/bot-account/BotAccount.tsx`.

  **Acceptance Criteria** (agent-executable only):
  - [x] No local `saving` state for secret mutation progress.
  - [x] No local mutation catch-based `message.error` call in save flow.
  - [x] Modal `confirmLoading` derives from mutation pending state.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: SecretField mutation cleanup verified
    Tool: Grep
    Steps: Search `SecretField.tsx` for `setSaving(`, `mutateAsync(`, and mutation `try/catch`
    Expected: Mutation flow is callback-based and pending-driven
    Evidence: .sisyphus/evidence/task-11-secretfield-grep.txt

  Scenario: Typecheck after SecretField migration
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend typecheck`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-11-secretfield-typecheck.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): convert SecretField to mutation pending model` | Files: `apps/frontend/src/widgets/vm/settingsForm/SecretField.tsx`

- [x] 12. Refactor Workspace Pages (Kanban/Calendar)

  **What to do**: Migrate `apps/frontend/src/pages/workspace/kanban/index.tsx` and `apps/frontend/src/pages/workspace/calendar/index.tsx` handlers away from `mutateAsync + try/catch + saving` to hook-owned success and callback-driven local completion (`closeModal`, mode switches, date selection updates).
  **Must NOT do**: Do not alter form validation semantics or board/calendar domain rules.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: two high-surface pages with multiple handlers.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - no visual redesign.

  **Parallelization**: Can Parallel: YES | Wave 4 | Blocks: [16] | Blocked By: [3, 4, 5]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/pages/workspace/kanban/index.tsx`.
  - Pattern: `apps/frontend/src/pages/workspace/calendar/index.tsx`.
  - Hook source: `apps/frontend/src/entities/workspace/api/useWorkspaceMutations.ts`.

  **Acceptance Criteria** (agent-executable only):
  - [x] No local mutation `saving` booleans in both page files.
  - [x] No mutation `try/catch` blocks for create/update/delete handlers.
  - [x] Post-success local UX actions execute from mutate callback `onSuccess`.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Workspace pages no longer use mutation try/catch boilerplate
    Tool: AST-grep
    Steps: Search both files for `try { $$$ } catch ($ERR) { $$$ }` around mutation handlers
    Expected: No mutation-wrapper try/catch blocks remain
    Evidence: .sisyphus/evidence/task-12-workspace-ast.txt

  Scenario: Frontend lint gate
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend lint`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-12-workspace-lint.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): declarative mutation handlers in workspace pages` | Files: `apps/frontend/src/pages/workspace/{kanban,calendar}/index.tsx`


- [x] 5. Migrate Workspace Mutation Hooks (Kanban/Calendar) for Success Ownership

  **What to do**: Add success messaging ownership to workspace mutation hooks while preserving query invalidation for calendar/kanban slices.
  **Must NOT do**: Do not place message logic back into page components after hook migration.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: domain-wide hook updates with shared query keys.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - no visual changes.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [12, 16] | Blocked By: [2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/entities/workspace/api/useWorkspaceMutations.ts`.
  - Consumer: `apps/frontend/src/pages/workspace/kanban/index.tsx`.
  - Consumer: `apps/frontend/src/pages/workspace/calendar/index.tsx`.

  **Acceptance Criteria** (agent-executable only):
  - [x] Workspace hooks include `onSuccess` success toasts with clear operation labels.
  - [x] Invalidation keys remain unchanged.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Hook-level success ownership present
    Tool: Grep
    Steps: Search `useWorkspaceMutations.ts` for `message.success` and `onSuccess`
    Expected: Success messages live in hook layer
    Evidence: .sisyphus/evidence/task-5-workspace-hooks-grep.txt

  Scenario: Typecheck after workspace hook changes
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend typecheck`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-5-workspace-hooks-typecheck.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): centralize workspace success toasts in mutation hooks` | Files: `apps/frontend/src/entities/workspace/api/useWorkspaceMutations.ts`

- [x] 6. Migrate Settings/Theme Mutation Hooks for Success Ownership

  **What to do**: Move success toasts for theme/settings save/apply/upload/delete operations into settings/theme mutation hooks or aligned mutation adapters.
  **Must NOT do**: Do not break existing `setQueryData` and invalidate behavior in theme hooks.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: multiple related hooks and helper adapters.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['test']` - no framework expansion.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [10, 13, 16] | Blocked By: [2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/entities/settings/api/useSettingsMutations.ts`.
  - Pattern: `apps/frontend/src/entities/settings/api/useThemeMutations.ts`.
  - Consumer: `apps/frontend/src/pages/settings/themePresetActions.ts` - current component/helper-level success/error messages.

  **Acceptance Criteria** (agent-executable only):
  - [x] Theme/settings mutation hooks own operation success toasts.
  - [x] Existing cache update and invalidation logic remains functionally equivalent.
  - [x] Direct toast emissions in settings helper consumers are removed where now hook-owned.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Theme/settings hooks now own success messages
    Tool: Grep
    Steps: Search `useSettingsMutations.ts` and `useThemeMutations.ts` for `message.success`
    Expected: Success toast ownership exists in hooks, with reduced duplicates in settings helpers
    Evidence: .sisyphus/evidence/task-6-settings-hooks-grep.txt

  Scenario: Frontend build integrity
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend build`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-6-settings-hooks-build.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): move settings and theme success messaging into hooks` | Files: `apps/frontend/src/entities/settings/api/*`, `apps/frontend/src/pages/settings/*`

- [x] 7. Align Notes/VM/Resource Mutation Hook Adapters with Ownership Contract

  **What to do**: For domains still pushing toast/error concerns into UI (notes, vm actions, resource CRUD adapters), introduce hook/adaptor-level ownership metadata and success handling where appropriate.
  **Must NOT do**: Do not force success toasts for low-level technical operations that should stay silent.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: mixed domain adapters need consistent contract application.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - behavior-layer only.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [11, 14, 15, 16] | Blocked By: [2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/entities/notes/api/useNoteMutations.ts`.
  - Pattern: `apps/frontend/src/entities/vm/api/useVmActionMutations.ts`.
  - Pattern: `apps/frontend/src/entities/resources/api/resourceContractFacade.ts`.
  - Consumer examples: `apps/frontend/src/widgets/notes-editor/NoteEditor.tsx`, `apps/frontend/src/widgets/vm/VMCommandPanel.tsx`.

  **Acceptance Criteria** (agent-executable only):
  - [x] Domain mutation adapters expose ownership metadata usable by global interceptor.
  - [x] Success toasts are moved from component level where mutation semantics are stable.
  - [x] Existing domain-specific cache invalidation behavior is preserved.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Ownership contract applied to mixed domains
    Tool: Grep
    Steps: Search notes/vm/resource mutation adapter files for metadata keys introduced in Task 1
    Expected: Contract keys present in migrated domains
    Evidence: .sisyphus/evidence/task-7-domain-contract-grep.txt

  Scenario: Type safety across affected domains
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend typecheck`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-7-domain-contract-typecheck.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): align notes vm and resource mutation adapters with ownership contract` | Files: `apps/frontend/src/entities/{notes,vm,resources}/**`

- [x] 8. Refactor Priority Component: BotAccount

  **What to do**: In `BotAccount.tsx`, remove local mutation `saving` state, remove mutation `try/catch/finally`, switch to `updateBotMutation.mutate(payload, { onSuccess })`, and use `updateBotMutation.isPending` for UI loading.
  **Must NOT do**: Do not alter account generation business rules or form value mapping.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused single-file surgical cleanup.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['test']` - structural refactor with existing gates.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [16] | Blocked By: [3, 4]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/features/bot-account/BotAccount.tsx` - current anti-pattern block.
  - Hook contract: `apps/frontend/src/entities/bot/api/useBotMutations.ts`.
  - Similar target: `apps/frontend/src/widgets/bot-profile/ui/BotPerson.tsx`.

  **Acceptance Criteria** (agent-executable only):
  - [x] `BotAccount.tsx` has no local `saving` state for mutation progress.
  - [x] `BotAccount.tsx` does not call `mutateAsync` for save flow.
  - [x] Success local flow (`setGenerationLocks`, `setPendingLocks`) runs from `onSuccess` callback.
  - [x] No component-level `message.error` in mutation catch for this flow.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Anti-pattern removed in BotAccount
    Tool: Grep
    Steps: Search `BotAccount.tsx` for `mutateAsync(`, `setSaving(`, `try {`, `message.error(` in save handler area
    Expected: No mutation-specific anti-pattern remnants
    Evidence: .sisyphus/evidence/task-8-botaccount-grep.txt

  Scenario: Frontend typecheck remains green
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend typecheck`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-8-botaccount-typecheck.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): simplify BotAccount mutation flow with mutate callbacks` | Files: `apps/frontend/src/features/bot-account/BotAccount.tsx`


- [x] 1. Define Mutation Toast Ownership Contract

  **What to do**: Introduce a shared frontend contract for mutation toast ownership and exception flags (global fallback vs hook-owned success/error vs suppressed global error). Define normalized metadata keys used by mutation hooks and global interceptor.
  **Must NOT do**: Do not change runtime behavior yet; do not wire to admin app.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: cross-cutting contract prevents duplicate toast behavior.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - visual design is irrelevant.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2-18] | Blocked By: []

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/entities/bot/api/useBotMutations.ts` - canonical hook typing and `onSuccess` invalidation.
  - Pattern: `apps/frontend/src/entities/settings/api/useThemeMutations.ts` - rich hook-side effects with cache updates.
  - API/Type: `apps/frontend/src/shared/api/internal/types.ts:ApiClientError` - normalized backend error payload class.
  - External: `https://tanstack.com/query/v5/docs/reference/MutationCache` - global mutation callbacks.
  - External: `https://tanstack.com/query/v5/docs/framework/react/reference/useMutation` - callback semantics.

  **Acceptance Criteria** (agent-executable only):
  - [x] Shared contract file/type is added in frontend shared layer and imported by mutation/query infrastructure.
  - [x] Contract defines at minimum: suppress-global-error flag, local-owner flag, and dedupe key strategy.
  - [x] No compile errors introduced by new contract.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Contract compiles and is consumable
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend typecheck`
    Expected: Exit code 0, no unresolved type/import errors
    Evidence: .sisyphus/evidence/task-1-toast-contract-typecheck.txt

  Scenario: Contract keys are discoverable
    Tool: Grep
    Steps: Search frontend for newly defined contract key names
    Expected: Keys found in contract definition and at least one consumer import
    Evidence: .sisyphus/evidence/task-1-toast-contract-grep.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): define mutation toast ownership contract` | Files: `apps/frontend/src/shared/**`

- [x] 2. Add Global Mutation Error Interceptor in Frontend QueryClient

  **What to do**: Update `apps/frontend/src/shared/lib/query/queryClient.ts` to use `MutationCache` and global `onError` callback. Extract error message from `ApiClientError`/`Error`, apply fallback string, and respect ownership contract suppress flags.
  **Must NOT do**: Do not emit success toasts globally; do not alter query defaults unrelated to mutations.

  **Recommended Agent Profile**:
  - Category: `quick` - Reason: isolated infrastructure file change.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['test']` - no new test framework work needed here.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [4-18] | Blocked By: [1]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/shared/lib/query/queryClient.ts` - current QueryClient initialization.
  - API/Type: `apps/frontend/src/shared/api/internal/types.ts:ApiClientError` - error typing.
  - External: `https://tanstack.com/query/v5/docs/reference/MutationCache` - global callback behavior.
  - External: `https://ant.design/components/message/` - `message.error` API and key behavior.

  **Acceptance Criteria** (agent-executable only):
  - [x] `queryClient.ts` initializes QueryClient with `mutationCache: new MutationCache({ onError })`.
  - [x] `onError` resolves human-readable message from `ApiClientError` and generic `Error`.
  - [x] Interceptor skips toast when contract suppression metadata is present.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Global interceptor exists exactly once
    Tool: Grep
    Steps: Run grep for `new MutationCache(` in `apps/frontend/src/shared/lib/query/queryClient.ts`
    Expected: Exactly one match in frontend query client
    Evidence: .sisyphus/evidence/task-2-mutationcache-grep.txt

  Scenario: Type safety preserved
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend typecheck`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-2-queryclient-typecheck.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): centralize mutation error handling in query client` | Files: `apps/frontend/src/shared/lib/query/queryClient.ts`

- [x] 3. Establish mutateAsync Exception Allowlist and Eradication Gates

  **What to do**: Inventory all current `mutateAsync` usages in frontend; define approved exception list (sequencing/composition/service-boundary cases) and migration targets. Add CI-checkable grep/AST commands in plan evidence workflow.
  **Must NOT do**: Do not auto-convert all `mutateAsync` blindly; do not include admin app.

  **Recommended Agent Profile**:
  - Category: `deep` - Reason: correctness depends on safe exception classification.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['frontend-ui-ux']` - non-visual static analysis task.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [8-18] | Blocked By: [1]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/widgets/vm/useVmListController.ts` - known sequential `mutateAsync` exception pattern.
  - Pattern: `apps/frontend/src/features/bot-account/BotAccount.tsx` - non-exception anti-pattern candidate.
  - External: `https://tanstack.com/query/v5/docs/framework/react/guides/mutations` - mutate vs mutateAsync guidance.

  **Acceptance Criteria** (agent-executable only):
  - [x] Exception allowlist is documented in repo plan artifacts and referenced by migration tasks.
  - [x] Baseline grep report for `mutateAsync(` in frontend is captured.
  - [x] AST query for `try/catch` wrappers around mutation handlers is captured.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Baseline mutateAsync inventory
    Tool: Grep
    Steps: Run grep `mutateAsync\(` in `apps/frontend/src`
    Expected: Output saved with all current files and classified as migrate vs exception
    Evidence: .sisyphus/evidence/task-3-mutateasync-baseline.txt

  Scenario: Try/catch anti-pattern inventory
    Tool: AST-grep
    Steps: Run AST search for `try { $$$ } catch ($ERR) { $$$ }` in frontend TSX files
    Expected: Output saved and linked to migration backlog
    Evidence: .sisyphus/evidence/task-3-trycatch-baseline.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: `.sisyphus/plans/aop-mutation-error-ui-cleanup.md`

  **Baseline Output Summary**:
  - `mutateAsync(` inventory (`apps/frontend/src`, `*.ts` + `*.tsx`): 53 matches across 23 files.
  - Generic TSX `try/catch` inventory (`try { $$$ } catch ($ERR) { $$$ }`): 42 matches.
  - `try/catch` with direct `await <mutation>.mutateAsync(...)` TSX pattern: 2 confirmed direct wrapper matches.

  **Allowlist (allowed-exception)**:
  - `apps/frontend/src/widgets/vm/useVmListController.ts` (4) - sequencing boundary; rename flow chains `updateVmConfig -> waitForVmTask` with awaited `upid` and task status.
  - `apps/frontend/src/pages/vms/hooks/useVmStartAndQueueActions.ts` (1) - composition boundary; queue orchestration requires awaited batch result payload (`ok/failed/results`) for control flow and summary messaging.
  - `apps/frontend/src/pages/settings/useThemeSettings.ts` (7) - service/composition boundary; exposes Promise-returning mutation adapters to internal action/preset orchestration helpers.

  **Migration Backlog (must-migrate)**:
  - `apps/frontend/src/features/bot-account/BotAccount.tsx` (2)
  - `apps/frontend/src/widgets/notes-editor/NoteSidebar.tsx` (3)
  - `apps/frontend/src/widgets/notes-editor/NoteEditor.tsx` (2)
  - `apps/frontend/src/widgets/vm/VMConfigPreview.tsx` (1)
  - `apps/frontend/src/widgets/vm/VMCommandPanel.tsx` (1)
  - `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts` (1)
  - `apps/frontend/src/widgets/bot-profile/ui/BotLicense.tsx` (3)
  - `apps/frontend/src/widgets/bot-profile/ui/BotCharacterWidget.tsx` (3)
  - `apps/frontend/src/widgets/schedule/ScheduleGenerator.tsx` (3)
  - `apps/frontend/src/widgets/bot-profile/ui/BotSubscription.tsx` (1)
  - `apps/frontend/src/widgets/bot-profile/ui/BotSchedule.tsx` (2)
  - `apps/frontend/src/widgets/bot-profile/ui/BotProxy.tsx` (1)
  - `apps/frontend/src/widgets/bot-profile/ui/BotPerson.tsx` (2)
  - `apps/frontend/src/widgets/bot-profile/ui/BotLifeStagesWidget.tsx` (2)
  - `apps/frontend/src/pages/workspace/kanban/index.tsx` (4)
  - `apps/frontend/src/pages/workspace/calendar/index.tsx` (3)
  - `apps/frontend/src/pages/proxies/ProxiesPage.tsx` (1)
  - `apps/frontend/src/pages/project/index.tsx` (1)
  - `apps/frontend/src/pages/licenses/index.tsx` (2)
  - `apps/frontend/src/pages/finance/index.tsx` (3)

  **Gate Commands (copy/paste)**:
  ```bash
  # Gate A: full mutateAsync residue inventory
  grep -R -F "mutateAsync(" "apps/frontend/src"

  # Gate B: allowlist-only residue check (fails if any non-allowlisted file remains)
  grep -R -F "mutateAsync(" "apps/frontend/src" | grep -v "apps/frontend/src/widgets/vm/useVmListController.ts" | grep -v "apps/frontend/src/pages/vms/hooks/useVmStartAndQueueActions.ts" | grep -v "apps/frontend/src/pages/settings/useThemeSettings.ts"

  # Gate C: baseline structural try/catch inventory in frontend TSX
  ast-grep run --lang tsx --pattern 'try { $$$ } catch ($ERR) { $$$ }' apps/frontend/src

  # Gate D: focused mutation-wrapper try/catch inventory in frontend TSX
  ast-grep run --lang tsx --pattern 'try { $$$BEFORE; await $MUT.mutateAsync($$$ARGS); $$$AFTER } catch ($ERR) { $$$CATCH }' apps/frontend/src
  ```

  **Gate Interpretation**:
  - Gate A baseline is currently 53 matches in 23 files.
  - Gate B baseline currently returns must-migrate residue (41 matches); target after sweep is empty output.
  - Gate C baseline is 42 generic TSX `try/catch` blocks; informational and not mutation-specific pass/fail alone.
  - Gate D baseline is 2 direct mutation wrapper matches; target after sweep is empty output outside allowlisted exception files.

- [x] 4. Migrate Bot Entity Mutations to Hook-Owned Success Messaging

  **What to do**: Update bot mutation hooks to emit success messages in `onSuccess` while preserving invalidation behavior. Introduce ownership metadata so component-level success/error toasts can be removed safely.
  **Must NOT do**: Do not move non-bot domain messages here; do not remove invalidation.

  **Recommended Agent Profile**:
  - Category: `general` - Reason: moderate API/hook refactor with side effects.
  - Skills: `[]` - no extra skill required.
  - Omitted: `['test']` - no framework addition needed.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [8, 12, 13, 16] | Blocked By: [2]

  **References** (executor has NO interview context - be exhaustive):
  - Pattern: `apps/frontend/src/entities/bot/api/useBotMutations.ts` - update/delete bot hooks.
  - Pattern: `apps/frontend/src/entities/bot/api/useBotLifecycleMutations.ts` - ban/unban hooks.
  - Pattern: `apps/frontend/src/entities/settings/api/useThemeMutations.ts` - example of centralized hook side effects.

  **Acceptance Criteria** (agent-executable only):
  - [x] Bot mutation hooks include explicit `onSuccess` success toast ownership.
  - [x] Existing invalidateQueries behavior remains intact.
  - [x] Components no longer need bot-success toasts after migration.

  **QA Scenarios** (MANDATORY - task incomplete without these):
  ```text
  Scenario: Hook ownership migrated
    Tool: Grep
    Steps: Search bot mutation hook files for `onSuccess` and `message.success`
    Expected: Success toasts appear in hooks, not duplicated in migrated bot components
    Evidence: .sisyphus/evidence/task-4-bot-hooks-grep.txt

  Scenario: Build integrity after hook updates
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend typecheck`
    Expected: Exit code 0
    Evidence: .sisyphus/evidence/task-4-bot-hooks-typecheck.txt
  ```

  **Commit**: YES | Message: `refactor(frontend): move bot mutation success messaging into hooks` | Files: `apps/frontend/src/entities/bot/api/use*Mutations.ts`


## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit - oracle
- [x] F2. Code Quality Review - unspecified-high
- [x] F3. Real Manual QA - unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check - deep

## Commit Strategy
- Commit in atomic feature slices by wave.
- Suggested format: `refactor(frontend): centralize mutation errors and thin ui handlers`.
- Keep exception allowlist commit separate for easy review.

## Success Criteria
- Global mutation error path is centralized and consistent.
- Frontend mutation UI handlers are declarative and boilerplate-free.
- `mutateAsync` remains only where justified by documented allowlist.
- Quality gates and structural anti-pattern checks pass with evidence artifacts.
