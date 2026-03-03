# Frontend Thin Client Cleanup (FSD Refactor Completion)

## TL;DR
> **Summary**: Complete frontend migration to thin-client mode by removing local finance/status/deletion business logic and making backend payloads the only source of truth.
> **Deliverables**:
> - Finance summary path no longer depends on raw operations list.
> - VM delete modal opens with a single `POST /api/v1/vms/evaluate-deletion` request.
> - Resource status/expiry rendering uses backend computed fields only.
> - Legacy helper/lib business-logic code deleted and contracts tightened.
> **Effort**: Large
> **Parallel**: YES - 3 waves
> **Critical Path**: 1 -> 2 -> 4 -> 7 -> 9

## Context
### Original Request
Epic: frontend cleanup to finish thin-client transition; remove over-fetching and local business logic across finance, resource statuses, and VM deletion workflow.

### Interview Summary
- Datacenter is in scope to enable full removal of `entities/finance/lib/analytics.ts`.
- `ProjectPerformanceTable` must be backend-driven via expanded per-project DTO.
- VM delete modal must perform exactly one open-time request: `POST /api/v1/vms/evaluate-deletion`.
- Test strategy is tests-after with strict automated verification and dead-code/scope audits.

### Metis Review (gaps addressed)
- Added explicit guardrail to restrict `Date.now()` cleanup to business status/expiry logic only.
- Added migration ordering constraint: contract alignment before consumer cleanup/deletion.
- Added acceptance criteria for request-count verification and forbidden pattern detection.
- Added compatibility note for status-token normalization (`expiring`/`expiring_soon`) during migration.

## Work Objectives
### Core Objective
Ship a contract-first thin-client frontend where finance/status/deletion business decisions are backend-authored and frontend only presents DTO outputs.

### Deliverables
- Finance page summary and chart paths consume aggregate DTOs without local recomputation from operations.
- Datacenter no longer imports finance analytics helpers.
- VM deletion flow removes fan-out facade/context loaders and renders only evaluation payload.
- Resource UIs remove local `isExpired`/`isExpiringSoon`/`daysUntilExpiry` math.
- Optional backend-guaranteed fields in frontend resource types are converted to required where contract guarantees exist.

### Definition of Done (verifiable conditions with commands)
- `apps/frontend/src/entities/finance/lib/analytics.ts` removed and has zero references.
- Finance summary tab does not trigger `finance/operations` fetch path.
- Business-resource `Date.now()` expiry math removed from targeted files.
- Delete VM modal open emits exactly one network call to `/api/v1/vms/evaluate-deletion`.
- `pnpm --filter @botmox/frontend run typecheck` passes.
- `pnpm --filter @botmox/frontend run build` passes.

### Must Have
- One-plan execution (no phase-split plans).
- Contract-first sequence with explicit references to existing patterns and endpoints.
- Every task includes executable QA scenarios with evidence artifact paths.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No broad `Date.now()` removals outside business expiry/status logic.
- No UI redesign or unrelated refactors.
- No mixed dual-source final state (local + backend logic both active after completion).
- No delete-modal fallback fan-out path left in active workflow.

## Verification Strategy
> ZERO HUMAN INTERVENTION — all verification is agent-executed.
- Test decision: tests-after + Playwright e2e + TypeScript build gates.
- QA policy: Every task includes happy and failure/edge scenarios.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`.

## Execution Strategy
### Parallel Execution Waves
> Target: 5-8 tasks per wave. Shared contract/guardrail dependencies extracted first.

Wave 1: Contract alignment + safety baselines (tasks 1-4)
Wave 2: Domain migrations in parallel (tasks 5-8)
Wave 3: Cleanup + hardening + full verification (tasks 9-12)

### Dependency Matrix (full, all tasks)
1 -> 2,3,4,5,6,7,8
2 -> 5,6
3 -> 7
4 -> 8
5 -> 9
6 -> 9
7 -> 9,10
8 -> 10
9 -> 11
10 -> 11
11 -> 12

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 4 tasks -> `deep`, `unspecified-high`
- Wave 2 -> 4 tasks -> `general`, `quick`, `unspecified-high`
- Wave 3 -> 4 tasks -> `quick`, `unspecified-high`, `deep`

## TODOs
> Implementation + Test = ONE task. Every task includes agent profile, parallelization, references, acceptance criteria, and QA scenarios.

- [x] 1. Lock Thin-Client Contracts and Migration Guardrails

  **What to do**: Finalize DTO contracts and migration invariants for (a) finance project-performance data source, (b) VM deletion evaluation payload usage, and (c) resource status field vocabulary. Establish code-level guardrails: scoped forbidden patterns and allowed temporary adapters.
  **Must NOT do**: Do not implement consumer refactors before contract fields/query semantics are explicitly aligned.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: cross-domain contract decisions with downstream dependency impact.
  - Skills: `[]` — no extra skill required.
  - Omitted: [`frontend-ui-ux`] — visual redesign is out of scope.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [2,3,4,5,6,7,8] | Blocked By: []

  **References**:
  - Pattern: `packages/api-contract/src/schemasWorkspaceFinance.ts` — existing aggregate schemas to extend instead of ad-hoc frontend math.
  - Pattern: `apps/backend/src/modules/finance/finance.controller.ts` — canonical finance aggregate endpoints.
  - Pattern: `apps/backend/src/modules/infra/infra-vms.controller.ts` — authoritative `POST /vms/evaluate-deletion` route.
  - Pattern: `apps/frontend/src/pages/project/selectors.ts` — existing backend-computed status consumption model.
  - Pattern: `apps/frontend/src/entities/vm/api/vmDeleteContextFacade.ts` — current fan-out logic to retire.

  **Acceptance Criteria**:
  - [x] Contract decisions documented inside plan-driven task output and referenced by all downstream tasks.
  - [x] Status vocabulary mapping (`computed_status`, `status`, `days_remaining`, `is_expiring_soon`) has no unresolved ambiguity.
  - [x] Delete-modal invariant is explicit: one modal-open request (`POST /api/v1/vms/evaluate-deletion`) only.

  **QA Scenarios**:
  ```bash
  Scenario: Contract baseline verification
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/api-contract build` and `pnpm --filter @botmox/frontend run typecheck`.
    Expected: Both commands exit 0 with no schema/type drift errors.
    Evidence: .sisyphus/evidence/task-1-contract-baseline.txt

  Scenario: Guardrail scope validation
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend run lint`.
    Expected: No new boundary or contract-client wiring violations introduced by contract alignment changes.
    Evidence: .sisyphus/evidence/task-1-contract-guardrails.txt
  ```

  **Commit**: YES | Message: `chore(frontend): lock thin-client contract guardrails` | Files: `packages/api-contract/src/schemasWorkspaceFinance.ts`, `apps/backend/src/modules/finance/finance.controller.ts`, related contract/backend files

- [x] 2. Expand Backend Finance Aggregate Output for Project Performance

  **What to do**: Extend finance aggregate contract/backend implementation so `ProjectPerformanceTable` can render from backend DTO (project-grouped totals/metrics) without local regrouping over operations. Reuse existing aggregate route family (`summary`/`breakdown`) rather than introducing parallel ad-hoc frontend calculations.
  **Must NOT do**: Do not hardcode project IDs in frontend; do not keep fallback local regrouping path in final state.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: backend+contract change with regression-sensitive metrics.
  - Skills: `[]` — standard service/controller/test patterns already exist.
  - Omitted: [`test`] — tests are included inside task, not delegated as isolated generation.

  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [5,6] | Blocked By: [1]

  **References**:
  - Pattern: `apps/backend/src/modules/finance/finance.service.ts` — aggregate computation source.
  - Pattern: `apps/backend/src/modules/finance/finance.controller.ts` — aggregate endpoint contract handling.
  - Pattern: `apps/backend/src/modules/finance/finance.service.test.ts` — finance aggregate test conventions.
  - API/Type: `packages/api-contract/src/schemasWorkspaceFinance.ts` — aggregate DTO schema extension point.
  - Pattern: `apps/frontend/src/pages/finance/mappers.ts` — current local project mapping targeted for deletion.

  **Acceptance Criteria**:
  - [x] Backend returns project-performance-ready aggregate DTO sufficient for table rendering without raw operations.
  - [x] API contract schemas and backend tests cover new/expanded project aggregate fields.
  - [x] Frontend compiles against updated contract types without `any` or unsafe casts.

  **QA Scenarios**:
  ```bash
  Scenario: Backend aggregate contract pass
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/api-contract build` and backend finance tests touching aggregates.
    Expected: Contract build and finance aggregate tests pass with new project grouping fields.
    Evidence: .sisyphus/evidence/task-2-finance-aggregate-contract.txt

  Scenario: Aggregate mismatch edge case
    Tool: Bash
    Steps: Execute backend test case for empty/no-ops date window on project grouping response.
    Expected: Endpoint returns deterministic empty project metrics (no crash, no NaN).
    Evidence: .sisyphus/evidence/task-2-finance-aggregate-empty-window.txt
  ```

  **Commit**: YES | Message: `feat(finance): expose project aggregate metrics for thin-client UI` | Files: `apps/backend/src/modules/finance/*`, `packages/api-contract/src/schemasWorkspaceFinance.ts`

- [x] 3. Remove Finance Summary Dependence on Raw Operations Fetch

  **What to do**: Refactor finance page state/query wiring so `summary` tab uses only aggregate DTO queries; keep `useInfiniteList(resource='finance/operations')` mounted and fetched only in `transactions` tab path. Remove `filteredOperations` dependency from summary widget inputs.
  **Must NOT do**: Do not regress transactions table behavior; do not fetch all operation pages while summary tab is active.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: focused frontend query/state restructuring.
  - Skills: `[]` — existing Refine/TanStack patterns are local.
  - Omitted: [`frontend-ui-ux`] — no visual redesign needed.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [5] | Blocked By: [1]

  **References**:
  - Pattern: `apps/frontend/src/pages/finance/index.tsx` — current over-fetch and tab wiring.
  - Pattern: `apps/frontend/src/widgets/finance/FinanceSummary.tsx` — currently receives operations and recomputes metrics.
  - Pattern: `apps/frontend/src/widgets/finance/FinanceTransactions.tsx` — operations consumer that should retain raw list usage.
  - API/Type: `apps/frontend/src/shared/api/providers/finance-contract-client.ts` — contract-driven aggregate calls.

  **Acceptance Criteria**:
  - [x] `summary` tab does not trigger `finance/operations` request chain.
  - [x] `transactions` tab still loads and renders operations list with existing CRUD behavior.
  - [x] `FinancePage` no longer passes operations-derived aggregates into summary rendering path.

  **QA Scenarios**:
  ```bash
  Scenario: Summary tab network isolation
    Tool: Playwright
    Steps: Open `/finance`, keep tab on `Summary`, capture network requests for 10s.
    Expected: Aggregate endpoints may fire; `GET /api/v1/finance/operations` is absent.
    Evidence: .sisyphus/evidence/task-3-finance-summary-network.json

  Scenario: Transactions tab retains operations
    Tool: Playwright
    Steps: Switch to `Transactions` tab and wait for table data.
    Expected: `GET /api/v1/finance/operations` is present and table rows render.
    Evidence: .sisyphus/evidence/task-3-finance-transactions-network.json
  ```

  **Commit**: YES | Message: `refactor(finance): gate operations fetch to transactions tab` | Files: `apps/frontend/src/pages/finance/index.tsx`, related widget props/types

- [x] 4. Add Automated Regression Guards for Forbidden Local Business Logic

  **What to do**: Introduce repeatable command/spec checks for this migration: delete-modal request-count assertion, forbidden status-math grep assertions, and forbidden local finance grouping assertions in targeted files.
  **Must NOT do**: Do not create flaky time-based assertions; do not assert on unrelated Date.now usages.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: durable QA harness affects rollout confidence.
  - Skills: `[]` — uses existing Playwright + command checks.
  - Omitted: [`test`] — broader than unit test generation.

  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [8,11] | Blocked By: [1]

  **References**:
  - Test: `apps/frontend/e2e/smoke.spec.ts` — current e2e project conventions.
  - Test: `apps/frontend/playwright.config.ts` — test runner wiring.
  - Pattern: `apps/frontend/src/widgets/finance/ProjectPerformanceTable.tsx` — forbidden local grouping patterns.
  - Pattern: `apps/frontend/src/pages/licenses/page/helpers.ts` and `apps/frontend/src/widgets/bot-profile/ui/proxy/helpers.tsx` — forbidden status math patterns.

  **Acceptance Criteria**:
  - [x] A deterministic e2e/spec check exists for delete-modal one-request rule.
  - [x] Command-based grep checks detect banned status/finance-local logic patterns in scoped files.
  - [x] QA commands are runnable in CI/local without manual edits.

  **QA Scenarios**:
  ```bash
  Scenario: Guard suite happy path
    Tool: Bash
    Steps: Run migration guard commands (grep/assert script + targeted playwright test).
    Expected: All guard checks pass on compliant code.
    Evidence: .sisyphus/evidence/task-4-guard-suite-pass.txt

  Scenario: Guard suite failure path
    Tool: Bash
    Steps: Execute guard checks against a seeded fixture/branch state containing one banned pattern.
    Expected: Guard command fails with explicit offending file/symbol output.
    Evidence: .sisyphus/evidence/task-4-guard-suite-fail.txt
  ```

  **Commit**: YES | Message: `test(frontend): add thin-client migration guard checks` | Files: `apps/frontend/e2e/*`, guard scripts/config

- [x] 5. Migrate Finance Widgets to Backend DTO-Only Rendering

  **What to do**: Refactor `ProjectPerformanceTable`, `FinanceSummary`, and `GoldPriceChart`/chart inputs to consume backend aggregate DTOs directly. Remove local operations-based regrouping (`forEach` + `Map`) and local gold-history arithmetic.
  **Must NOT do**: Do not reintroduce local aggregate math or hardcoded project identifiers.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: frontend component/data-shape refactor with clear contracts.
  - Skills: `[]` — no specialized skill required.
  - Omitted: [`frontend-ui-ux`] — styling changes are irrelevant.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [9,11] | Blocked By: [2,3]

  **References**:
  - Pattern: `apps/frontend/src/widgets/finance/ProjectPerformanceTable.tsx` — local grouping logic to remove.
  - Pattern: `apps/frontend/src/widgets/finance/FinanceSummary.tsx` — current operations-dependent summary behavior.
  - Pattern: `apps/frontend/src/widgets/finance/GoldPriceChart.tsx` — local price-history math to replace with DTO.
  - Pattern: `apps/frontend/src/pages/finance/mappers.ts` — local mapper functions targeted for minimization/removal.
  - API/Type: `apps/frontend/src/shared/api/providers/finance-contract-client.ts` — DTO source.

  **Acceptance Criteria**:
  - [x] `ProjectPerformanceTable` has no local project aggregation over operations.
  - [x] `GoldPriceChart` uses aggregate history DTO input and does not compute averages from raw operations.
  - [x] Finance summary widgets render correctly with backend-provided metrics only.

  **QA Scenarios**:
  ```bash
  Scenario: Finance summary rendering via DTO
    Tool: Playwright
    Steps: Open `/finance` summary, verify table/chart sections render with non-empty aggregate responses.
    Expected: UI renders without client aggregation errors; no console/runtime exceptions.
    Evidence: .sisyphus/evidence/task-5-finance-widgets-summary.png

  Scenario: Local grouping regression check
    Tool: Bash
    Steps: Run grep checks for `operations.forEach(`, `new Map<string, Project`, and `getGoldPriceHistoryFromOperationsLocal` in finance widgets/mappers.
    Expected: No banned patterns remain in migrated finance files.
    Evidence: .sisyphus/evidence/task-5-finance-widgets-grep.txt
  ```

  **Commit**: YES | Message: `refactor(finance): switch widgets to backend aggregate DTOs` | Files: `apps/frontend/src/widgets/finance/*`, `apps/frontend/src/pages/finance/mappers.ts`

- [x] 6. Migrate Datacenter Finance Consumption and Remove Analytics Dependency

  **What to do**: Replace Datacenter finance summary/gold analytics usage so it consumes backend aggregate DTOs or shared contract-client aggregate outputs; remove dependency on `entities/finance/lib/analytics.ts`.
  **Must NOT do**: Do not leave dual finance-calculation paths between Finance page and Datacenter.

  **Recommended Agent Profile**:
  - Category: `general` — Reason: targeted page-level data-source migration.
  - Skills: `[]` — straightforward consumer refactor.
  - Omitted: [`deep`] — no new architecture decisions once contract is fixed.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [9,11] | Blocked By: [2]

  **References**:
  - Pattern: `apps/frontend/src/pages/datacenter/index.tsx` — current local finance analytics consumer.
  - Pattern: `apps/frontend/src/entities/finance/lib/analytics.ts` — file targeted for deletion once references are zero.
  - Pattern: `apps/frontend/src/pages/finance/index.tsx` — aggregate-query usage model to align with.
  - API/Type: `apps/frontend/src/shared/api/providers/finance-contract-client.ts` — shared aggregate data source.

  **Acceptance Criteria**:
  - [x] `apps/frontend/src/pages/datacenter/index.tsx` no longer imports `entities/finance/lib/analytics.ts`.
  - [x] Datacenter finance cards/charts rely on backend aggregate DTO fields.
  - [x] Cross-page finance totals remain consistent for identical filters/date windows.

  **QA Scenarios**:
  ```bash
  Scenario: Datacenter aggregate parity
    Tool: Playwright
    Steps: Load `/finance` and `/datacenter` with same date range/project filter context.
    Expected: Comparable aggregate totals align (within expected rounding behavior from backend).
    Evidence: .sisyphus/evidence/task-6-datacenter-finance-parity.json

  Scenario: Analytics helper reference failure check
    Tool: Bash
    Steps: Run `grep` for `calculateFinanceSummary` and `entities/finance/lib/analytics` imports across frontend src.
    Expected: No active imports/usages remain before file deletion task.
    Evidence: .sisyphus/evidence/task-6-datacenter-analytics-refs.txt
  ```

  **Commit**: YES | Message: `refactor(datacenter): consume backend finance aggregates` | Files: `apps/frontend/src/pages/datacenter/index.tsx`, related selectors/hooks

- [x] 7. Eliminate Client Expiry/Status Math in Resource and Bot-Profile Surfaces

  **What to do**: Remove business-expiry helpers and inline math (`isExpired`, `isExpiringSoon`, `Math.ceil((expires_at - Date.now())...)`) from resource/business UI surfaces; render badges and days from backend fields (`computed_status`/`status`, `days_remaining`, `is_expiring_soon`).
  **Must NOT do**: Do not touch non-business Date.now uses (cache TTL, IDs, logs, UI timers).

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: broad multi-file correctness-sensitive cleanup.
  - Skills: `[]` — no specialized library needed.
  - Omitted: [`quick`] — too many interdependent files for trivial profile.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [9,10,11] | Blocked By: [1,3]

  **References**:
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/license/helpers.ts` — remove runtime expiry state math.
  - Pattern: `apps/frontend/src/widgets/bot-profile/ui/proxy/helpers.tsx` — remove proxy expiry math.
  - Pattern: `apps/frontend/src/pages/licenses/page/helpers.ts` — remove page-level `isExpired`/`isExpiringSoon` helpers.
  - Pattern: `apps/frontend/src/pages/proxies/ProxiesPage.tsx` and `apps/frontend/src/pages/proxies/proxyColumns.tsx` — inline status math consumers.
  - Pattern: `apps/frontend/src/entities/resources/api/subscriptionFacade.ts` — subscription status recomputation cleanup.
  - Pattern: `apps/frontend/src/pages/project/selectors.ts` — backend-computed status usage template.

  **Acceptance Criteria**:
  - [x] No business-resource status badges depend on client `Date.now()` math.
  - [x] License/Proxy/Subscription views consume backend status fields directly.
  - [x] Scoped grep for banned expiry/status patterns in targeted business files returns zero.

  **QA Scenarios**:
  ```bash
  Scenario: Status badge happy path
    Tool: Playwright
    Steps: Open licenses/proxies/subscriptions pages with fixtures containing active/expiring/expired entities.
    Expected: Badge text/intent matches backend-provided status fields exactly.
    Evidence: .sisyphus/evidence/task-7-status-badges.png

  Scenario: Forbidden client math check
    Tool: Bash
    Steps: Run scoped grep for `isExpired(`, `isExpiringSoon(`, and `expires_at - Date.now()` in targeted resource files.
    Expected: Zero matches in migrated business status logic paths.
    Evidence: .sisyphus/evidence/task-7-status-math-grep.txt
  ```

  **Commit**: YES | Message: `refactor(resources): use backend computed status fields` | Files: targeted pages/widgets/helpers under `apps/frontend/src/pages/{licenses,proxies,subscriptions}` and `apps/frontend/src/widgets/bot-profile`

- [x] 8. Rewrite Delete VM Workflow to Single Evaluation Request

  **What to do**: Remove context fan-out facade usage (`fetchDeleteVmContext*`) and client-side evaluation joins. On modal open, send candidate VM list directly to `/api/v1/vms/evaluate-deletion`, then render rows from response fields (`can_delete`, `reason_code`, `reason`, `reasons`, `linked_bots`) in candidate item component.
  **Must NOT do**: Do not trigger `refreshVms()` as part of modal-open path; do not keep legacy `evaluations`/`linkedBots` props contract.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: high-impact UX/perf workflow surgery.
  - Skills: `[]` — existing API/provider patterns suffice.
  - Omitted: [`frontend-ui-ux`] — behavior refactor only.

  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [9,11] | Blocked By: [1,4]

  **References**:
  - Pattern: `apps/frontend/src/entities/vm/api/vmDeleteContextFacade.ts` — fan-out/context functions to delete.
  - Pattern: `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts` — modal-open orchestration to rewrite.
  - Pattern: `apps/frontend/src/features/vm-management/ui/DeleteVmCandidateItem.tsx` — candidate rendering props to simplify.
  - API/Type: `apps/backend/src/modules/infra/infra-vms.controller.ts` — authoritative evaluate-deletion contract endpoint.
  - API/Type: `packages/api-contract/src/contractRoutesInfra.ts` — request/response schema source for evaluate-deletion (if contract adjustments needed).

  **Acceptance Criteria**:
  - [x] Modal open triggers exactly one network request: `POST /api/v1/vms/evaluate-deletion`.
  - [x] No calls to bots/proxies/licenses/subscriptions listing APIs occur during modal-open evaluation flow.
  - [x] `fetchDeleteVmContext` and `fetchDeleteVmContextWithEvaluation` are removed from active codepath (deleted if no refs).

  **QA Scenarios**:
  ```bash
  Scenario: Delete modal one-request happy path
    Tool: Playwright
    Steps: Open VMs page, trigger Delete VM modal for multiple candidates, capture network calls from click to modal render completion.
    Expected: Exactly one `POST /api/v1/vms/evaluate-deletion`; no additional list fan-out calls.
    Evidence: .sisyphus/evidence/task-8-delete-modal-network.json

  Scenario: Evaluation failure edge case
    Tool: Playwright
    Steps: Mock/force evaluate-deletion 4xx/5xx response when opening modal.
    Expected: Modal shows graceful error state; no fallback fan-out requests are triggered.
    Evidence: .sisyphus/evidence/task-8-delete-modal-error.png
  ```

  **Commit**: YES | Message: `refactor(vm): replace delete modal fan-out with evaluate-deletion DTO flow` | Files: `apps/frontend/src/entities/vm/api/vmDeleteContextFacade.ts`, `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts`, `apps/frontend/src/features/vm-management/ui/DeleteVmCandidateItem.tsx`

- [x] 9. Delete Legacy Finance and VM Cleanup Dead Code

  **What to do**: Remove obsolete business-logic files/functions after reference confirmation: `entities/finance/lib/analytics.ts`, local finance mappers no longer needed, and dead legacy VM delete widget duplicates if unreferenced.
  **Must NOT do**: Do not delete files before zero-reference verification (`lsp_find_references`/grep).

  **Recommended Agent Profile**:
  - Category: `quick` — Reason: deterministic cleanup once migrations are complete.
  - Skills: `[]` — simple remove-and-verify operation.
  - Omitted: [`deep`] — no new design decisions.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [11] | Blocked By: [5,6,7,8]

  **References**:
  - Pattern: `apps/frontend/src/entities/finance/lib/analytics.ts` — explicit removal target.
  - Pattern: `apps/frontend/src/pages/finance/mappers.ts` — remove `getGoldPriceHistoryFromOperationsLocal` and obsolete mapping helpers.
  - Pattern: `apps/frontend/src/widgets/vm-workspace/ui/DeleteVmCandidateItem.tsx` — verify dead legacy duplicate before deletion.
  - Pattern: `apps/frontend/src/widgets/vm-workspace/ui/DeleteVmFilterPopovers.tsx` — verify dead legacy duplicate before deletion.

  **Acceptance Criteria**:
  - [x] Targeted dead files/functions are deleted or reduced to live-only exports.
  - [x] `lsp_find_references`/grep confirms zero remaining references to deleted symbols.
  - [x] Frontend typecheck/build still pass after deletions.

  **QA Scenarios**:
  ```bash
  Scenario: Dead-code deletion happy path
    Tool: Bash
    Steps: Run reference checks for deleted symbols/files, then run frontend typecheck.
    Expected: No missing-import errors and zero references to removed symbols.
    Evidence: .sisyphus/evidence/task-9-dead-code-refs.txt

  Scenario: Hidden consumer edge case
    Tool: Bash
    Steps: Run full frontend build immediately after deletion.
    Expected: Build fails if hidden imports exist; task resolves by removing/rewiring hidden consumer.
    Evidence: .sisyphus/evidence/task-9-dead-code-build.txt
  ```

  **Commit**: YES | Message: `chore(frontend): remove legacy thin-client dead code` | Files: deleted helper/lib files and updated imports

- [x] 10. Tighten Resource and Domain Types to Backend-Guaranteed Fields

  **What to do**: Update `apps/frontend/src/entities/**/model/types.ts` so backend-guaranteed fields (`computed_status`, `days_remaining`, `is_expiring_soon`, related status fields) are required where contract guarantees apply; remove optional markers and normalize naming adapters.
  **Must NOT do**: Do not force-required fields that backend contract does not guarantee.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: broad type-hardening with compile impact.
  - Skills: `[]` — contract/type work only.
  - Omitted: [`quick`] — non-trivial dependency graph.

  **Parallelization**: Can Parallel: YES | Wave 3 | Blocks: [11] | Blocked By: [7,8]

  **References**:
  - API/Type: `packages/api-contract/src/schemasBotsResources.ts` — backend resource field guarantees.
  - API/Type: `apps/frontend/src/entities/resources/model/types.ts` — primary type hardening target.
  - Pattern: `apps/frontend/src/entities/bot/lib/statuses.types.ts` — status-type alignment touchpoint.
  - Pattern: `apps/frontend/src/pages/project/selectors.ts` — known good consumer behavior for required computed fields.

  **Acceptance Criteria**:
  - [x] Optional markers are removed only for fields guaranteed by contract/runtime payloads.
  - [x] No new non-null assertions (`!`) introduced to bypass type errors.
  - [x] Frontend typecheck passes with tightened model types.

  **QA Scenarios**:
  ```bash
  Scenario: Type hardening happy path
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/frontend run typecheck` after type updates.
    Expected: Exit 0 without unsafe-cast workarounds.
    Evidence: .sisyphus/evidence/task-10-type-hardening-typecheck.txt

  Scenario: Contract mismatch edge case
    Tool: Bash
    Steps: Run targeted compile against modules consuming tightened fields.
    Expected: Any missing backend field usage surfaces as compile error and is fixed via contract-aligned mapping, not optional fallback.
    Evidence: .sisyphus/evidence/task-10-type-hardening-edge.txt
  ```

  **Commit**: YES | Message: `refactor(types): require backend-computed resource status fields` | Files: `apps/frontend/src/entities/**/model/types.ts`, aligned consumers

- [x] 11. Run Full Thin-Client Verification Suite and Record Evidence

  **What to do**: Execute end-to-end verification gates for this epic: typecheck, build, targeted e2e (finance tab fetch behavior + VM delete request count + status badge rendering), and scoped grep/AST checks for forbidden local logic.
  **Must NOT do**: Do not declare done with partial gate coverage.

  **Recommended Agent Profile**:
  - Category: `unspecified-high` — Reason: multi-gate validation and evidence collation.
  - Skills: `[]` — existing scripts/e2e infra sufficient.
  - Omitted: [`quick`] — broad validation workload.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [12] | Blocked By: [4,9,10]

  **References**:
  - Test: `apps/frontend/e2e/*.spec.ts` — existing e2e harness.
  - Config: `apps/frontend/playwright.config.ts` — browser test runtime.
  - Pattern: `apps/frontend/src/pages/finance/index.tsx` — summary-vs-transactions network behavior target.
  - Pattern: `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts` — one-request delete workflow target.
  - Pattern: `apps/frontend/src/pages/licenses/page/helpers.ts` — removed status math target.

  **Acceptance Criteria**:
  - [x] `pnpm --filter @botmox/frontend run typecheck` passes.
  - [x] `pnpm --filter @botmox/frontend run build` passes.
  - [x] Targeted e2e checks pass for finance fetch isolation, status rendering, and VM delete one-request invariant.
  - [x] Forbidden-pattern checks report zero matches in scoped business files.

  **QA Scenarios**:
  ```bash
  Scenario: Verification suite happy path
    Tool: Bash
    Steps: Run typecheck, build, targeted Playwright specs, and scoped grep guard commands; save all outputs.
    Expected: All commands exit 0 and produce evidence artifacts.
    Evidence: .sisyphus/evidence/task-11-verification-suite.txt

  Scenario: Regression detection edge case
    Tool: Bash
    Steps: Run guard checks first, then rerun after intentional stale-branch merge simulation.
    Expected: Guard commands fail fast on reintroduced local logic, preventing false completion.
    Evidence: .sisyphus/evidence/task-11-regression-detection.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: evidence artifacts only

- [x] 12. Final Scope-Fidelity and Negative-Delta Audit

  **What to do**: Perform final audit confirming sprint intent: backend SSOT achieved, over-fetch eliminated, local business logic removed, and net line delta is deletion-heavy. Publish concise audit report in evidence.
  **Must NOT do**: Do not include new feature work or deferred non-epic cleanups.

  **Recommended Agent Profile**:
  - Category: `deep` — Reason: final correctness/scope review across all domains.
  - Skills: `[]` — review-oriented.
  - Omitted: [`general`] — this is audit/compliance, not implementation.

  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [] | Blocked By: [11]

  **References**:
  - Pattern: `.sisyphus/plans/frontend-thin-client-cleanup.md` — source of truth checklist.
  - Pattern: `apps/frontend/src/entities/finance/lib/analytics.ts` — removed-file verification.
  - Pattern: `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts` — modal request behavior confirmation.
  - Pattern: `apps/frontend/src/pages/finance/index.tsx` — summary over-fetch elimination confirmation.

  **Acceptance Criteria**:
  - [x] Audit confirms all Definition of Done items with evidence references.
  - [x] Git diff statistics show net negative line delta for this epic scope.
  - [x] No unresolved decision-needed markers remain.

  **QA Scenarios**:
  ```bash
  Scenario: Scope fidelity happy path
    Tool: Bash
    Steps: Run `git diff --stat` and reconcile against plan DoD checklist and evidence files.
    Expected: Deletion-heavy change profile and full checklist coverage.
    Evidence: .sisyphus/evidence/task-12-scope-fidelity.txt

  Scenario: Scope creep edge case
    Tool: Bash
    Steps: Scan changed files for unrelated domains not listed in plan scope.
    Expected: Any out-of-scope files are flagged and removed before closure.
    Evidence: .sisyphus/evidence/task-12-scope-creep.txt
  ```

  **Commit**: NO | Message: `n/a` | Files: audit/evidence outputs only

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit — oracle
- [x] F2. Code Quality Review — unspecified-high
- [x] F3. Real Manual QA — unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check — deep

## Commit Strategy
- Atomic commits per completed task group (contract alignment, finance migration, status migration, VM deletion migration, cleanup/hardening).
- Commit message style: `refactor(frontend): ...` / `chore(frontend): ...` / `test(frontend): ...`.

## Success Criteria
- Frontend uses backend as SSOT for finance summaries, resource statuses, and delete-evaluation outcomes.
- Removed code volume exceeds added code volume.
- All quality gates and e2e assertions pass with evidence files generated.
