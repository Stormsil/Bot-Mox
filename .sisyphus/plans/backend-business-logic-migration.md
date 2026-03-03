# Backend Business Logic Migration (Frontend -> Backend)

## TL;DR
> **Summary**: Move the five frontend business-logic streams into backend services/controllers, expose ready ViewModel DTOs via `@botmox/api-contract`, and cut over frontend to API-driven rendering with phased fallback.
> **Deliverables**:
> - Backend-computed statuses, finance aggregates, VM delete evaluation, schedule generation, VM patching
> - Updated `packages/api-contract/src` + synced `docs/api/openapi.yaml`
> - Frontend cleanup removing migrated compute utilities
> - Parity evidence and rollback-safe feature-flag rollout
> **Effort**: XL
> **Parallel**: YES - 4 waves
> **Critical Path**: Baseline+contracts -> Backend stream implementations -> Frontend cutovers -> Fallback retirement

## Context
### Original Request
Migrate business logic and heavy calculations from frontend to backend for statuses, finance analytics, VM delete rules, schedule generation, and VM config patching.

### Interview Summary
- Rollout: phased + feature flags + temporary frontend fallback.
- VM delete API decision: `POST /api/v1/vms/evaluate-deletion`.
- Schedule decision: `seed` mode for deterministic tests/parity + random mode for production.
- Quality decision: tests are required, but plan also enforces residual-logic scans and code-quality checks.

### Metis Review (gaps addressed)
- Added additive-only contract guardrail until full migration complete.
- Added parity gates before deleting frontend logic.
- Added stream-level rollback policy.
- Added route/doc sync gate between contract and OpenAPI.

## Work Objectives
### Core Objective
Backend is the authoritative source of business computation for all five streams; frontend handles rendering/state only.

### Deliverables
- Contract updates in `packages/api-contract/src` for all new DTOs/routes.
- Backend implementation in `apps/backend/src/modules/{bots,resources,finance,infra,vm-ops,settings,vm}`.
- Frontend cutovers removing logic from:
  - `apps/frontend/src/entities/bot/lib/statuses.ts`
  - `apps/frontend/src/entities/finance/lib/analyticsCalculations.ts`
  - `apps/frontend/src/features/vm-management/lib/deleteVmRules.ts`
  - `apps/frontend/src/shared/lib/utils/schedule/generation.ts`
  - `apps/frontend/src/shared/lib/utils/vm/patcher.ts`

### Definition of Done (verifiable conditions with commands)
- `pnpm --filter @botmox/api-contract build`
- `pnpm --filter @botmox/backend test`
- `pnpm --filter @botmox/backend build`
- `pnpm --filter @botmox/frontend exec tsc -b --pretty false`
- `pnpm --filter @botmox/frontend build`

### Must Have
- Additive contract changes only during migration window.
- Stream-by-stream parity evidence before frontend deletion.
- Backend DTOs include display-ready computed fields.
- Seeded deterministic schedule generation path for test/parity.

### Must NOT Have (guardrails, AI slop patterns, scope boundaries)
- No new business logic added to frontend migrated utilities.
- No unrelated vm-ops reliability redesign.
- No breaking contract removals before cleanup wave.
- No acceptance criteria that require human/manual intervention.

## Verification Strategy
> ZERO HUMAN INTERVENTION - all verification is agent-executed.
- Test decision: tests-after + parity harness.
- QA policy: every task includes happy + failure scenarios with concrete evidence files.
- Evidence: `.sisyphus/evidence/task-{N}-{slug}.{ext}`

## Execution Strategy
### Parallel Execution Waves
Wave 1 (6 tasks): baseline, contract scaffolding, flags, parity harness, sync gate, callsite audit
Wave 2 (5 tasks): backend status/finance/vm-delete/schedule/vm-patch implementations
Wave 3 (5 tasks): frontend cutovers + utility removals
Wave 4 (1 task): fallback retirement + final cleanup

### Dependency Matrix (full, all tasks)
- T1 -> T2, T4
- T2 -> T7, T9, T11, T13, T15
- T3 -> T8, T10, T12, T14, T16, T17
- T4 -> T7, T9, T11, T13, T15
- T5 -> merge readiness for T2/T7/T9/T11/T13/T15
- T6 -> T8, T10, T12, T14, T16
- T7 -> T8
- T9 -> T10
- T11 -> T12
- T13 -> T14
- T15 -> T16
- T8/T10/T12/T14/T16 -> T17

### Agent Dispatch Summary (wave -> task count -> categories)
- Wave 1 -> 6 -> deep, quick, unspecified-high, ultrabrain
- Wave 2 -> 5 -> deep, ultrabrain
- Wave 3 -> 5 -> general
- Wave 4 -> 1 -> unspecified-high

## TODOs
> Implementation + Test = ONE task. Never separate.
> EVERY task MUST have: Agent Profile + Parallelization + QA Scenarios.

- [x] 1. Baseline Fixtures and Payload Benchmark
  **What to do**: Capture baseline outputs and payload sizes for five streams; store fixture corpus and parity thresholds.
  **Must NOT do**: No runtime code changes.
  **Recommended Agent Profile**:
  - Category: `deep` - Reason: cross-stream canonical baseline.
  - Skills: `[]` - local repo data only.
  - Omitted: `[git-master]` - no git ops.
  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [2, 4] | Blocked By: []
  **References**:
  - `apps/frontend/src/entities/bot/lib/statuses.ts`
  - `apps/frontend/src/entities/finance/lib/analyticsCalculations.ts`
  - `apps/frontend/src/features/vm-management/lib/deleteVmRules.ts`
  - `apps/frontend/src/shared/lib/utils/schedule/generation.ts`
  - `apps/frontend/src/shared/lib/utils/vm/patcher.ts`
  **Acceptance Criteria**:
  - [ ] Baseline fixtures for all 5 streams stored in `.sisyphus/evidence/`.
  - [ ] Pre-migration payload byte sizes captured for dashboard + finance.
  **QA Scenarios**:
  ```text
  Scenario: Fixture generation succeeds
    Tool: Bash
    Steps: Run baseline capture command.
    Expected: All baseline fixture files exist and are non-empty.
    Evidence: .sisyphus/evidence/task-1-baseline.txt

  Scenario: Missing source detected
    Tool: Bash
    Steps: Run capture with invalid source path (dry-run).
    Expected: Non-zero exit with explicit missing-source error.
    Evidence: .sisyphus/evidence/task-1-baseline-error.txt
  ```
  **Commit**: YES | Message: `chore(migration): add baseline fixtures and payload benchmark` | Files: `.sisyphus/evidence/*`

- [x] 2. Additive API Contract Expansion for All Streams
  **What to do**: Extend `packages/api-contract/src` with new additive DTOs/routes for status fields, finance aggregate endpoints, VM deletion evaluation, schedule generation, VM patching.
  **Must NOT do**: No breaking schema/route changes.
  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: broad contract surface updates.
  - Skills: `[]`.
  - Omitted: `[openspec]` - not a spec bootstrap task.
  **Parallelization**: Can Parallel: NO | Wave 1 | Blocks: [7, 9, 11, 13, 15] | Blocked By: [1]
  **References**:
  - `packages/api-contract/src/contractRoutesFinance.ts`
  - `packages/api-contract/src/contractRoutesVmOps.ts`
  - `packages/api-contract/src/schemasWorkspaceFinance.ts`
  - `packages/api-contract/src/schemasBotsResources.ts`
  - `packages/api-contract/src/contractDefinitions.ts`
  **Acceptance Criteria**:
  - [ ] `pnpm --filter @botmox/api-contract build` exits 0.
  - [ ] Existing consumers compile without required-breaking changes.
  - [ ] `docs/api/openapi.yaml` updated for new DTOs/routes.
  **QA Scenarios**:
  ```text
  Scenario: Contract build passes
    Tool: Bash
    Steps: Run `pnpm --filter @botmox/api-contract build`.
    Expected: Exit code 0.
    Evidence: .sisyphus/evidence/task-2-contract-build.txt

  Scenario: Non-additive change is caught
    Tool: Bash
    Steps: Run consumer typecheck gate.
    Expected: Breakage fails with clear contract mismatch.
    Evidence: .sisyphus/evidence/task-2-contract-break.txt
  ```
  **Commit**: YES | Message: `feat(contract): add migration dto routes for backend-authoritative logic` | Files: `packages/api-contract/src/*`, `docs/api/openapi.yaml`

- [x] 3. Stream Feature Flags and Rollback Wiring
  **What to do**: Implement per-stream backend-authoritative flags and documented rollback behavior.
  **Must NOT do**: No deletion of frontend fallback paths in this task.
  **Recommended Agent Profile**:
  - Category: `deep` - Reason: migration safety and rollback control.
  - Skills: `[]`.
  - Omitted: `[test]` - not test-only work.
  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [8, 10, 12, 14, 16, 17] | Blocked By: []
  **References**:
  - `apps/frontend/src/pages/project/selectors.ts`
  - `apps/frontend/src/pages/finance/index.tsx`
  - `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts`
  **Acceptance Criteria**:
  - [ ] Five stream flags available with safe defaults.
  - [ ] Rollback doc defines exact toggle procedure per stream.
  **QA Scenarios**:
  ```text
  Scenario: Flags OFF fallback works
    Tool: Bash
    Steps: Run frontend typecheck/build with all stream flags OFF.
    Expected: Success via legacy paths.
    Evidence: .sisyphus/evidence/task-3-flags-off.txt

  Scenario: Missing flag defaults safely
    Tool: Bash
    Steps: Start app with one flag omitted.
    Expected: Deterministic fallback, no crash.
    Evidence: .sisyphus/evidence/task-3-flags-missing.txt
  ```
  **Commit**: YES | Message: `feat(migration): add per-stream backend-authoritative flags` | Files: `apps/frontend/src/**`, `apps/backend/src/**`, `docs/**`

- [x] 4. Shared Parity Harness (Frontend vs Backend)
  **What to do**: Build parity test harness using baseline fixtures for all streams; include deterministic seeded checks for schedule.
  **Must NOT do**: No fuzzy matching for booleans/statuses/reasons.
  **Recommended Agent Profile**:
  - Category: `ultrabrain` - Reason: deterministic cross-domain comparison.
  - Skills: `[]`.
  - Omitted: `[frontend-ui-ux]`.
  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [7, 9, 11, 13, 15] | Blocked By: [1]
  **References**:
  - `apps/backend/src/modules/finance/finance.service.test.ts`
  - `apps/backend/src/modules/provisioning/auth-provisioning-vmops.integration.test.ts`
  - `apps/backend/package.json`
  - `apps/frontend/src/shared/lib/utils/schedule/generation.ts`
  **Acceptance Criteria**:
  - [ ] Parity suites exist for all 5 streams.
  - [ ] Backend test command passes with parity suites.
  **QA Scenarios**:
  ```text
  Scenario: Parity suite passes
    Tool: Bash
    Steps: Run backend tests with parity filter.
    Expected: All parity tests green.
    Evidence: .sisyphus/evidence/task-4-parity-pass.txt

  Scenario: Fixture mismatch detected
    Tool: Bash
    Steps: Modify fixture in temp run.
    Expected: Test fails with explicit diff.
    Evidence: .sisyphus/evidence/task-4-parity-fail.txt
  ```
  **Commit**: YES | Message: `test(migration): add parity harness for frontend-backend logic` | Files: `apps/backend/src/modules/**/*.test.ts`, `.sisyphus/evidence/*`

- [x] 5. Contract/OpenAPI Sync Gate
  **What to do**: Add gate that blocks contract changes if `docs/api/openapi.yaml` is not updated.
  **Must NOT do**: No manual-only review requirement.
  **Recommended Agent Profile**:
  - Category: `quick` - Reason: focused CI guardrail.
  - Skills: `[]`.
  - Omitted: `[deep]`.
  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [merge readiness for 2/7/9/11/13/15] | Blocked By: []
  **References**:
  - `docs/api/openapi.yaml`
  - `CONTRIBUTING.md`
  - `packages/api-contract/src/contract.ts`
  **Acceptance Criteria**:
  - [ ] Drift fails check.
  - [ ] Synced state passes check.
  **QA Scenarios**:
  ```text
  Scenario: Synced files pass
    Tool: Bash
    Steps: Run sync gate command.
    Expected: Exit 0.
    Evidence: .sisyphus/evidence/task-5-sync-pass.txt

  Scenario: Drift fails
    Tool: Bash
    Steps: Change contract only, rerun gate.
    Expected: Non-zero exit with drift message.
    Evidence: .sisyphus/evidence/task-5-sync-fail.txt
  ```
  **Commit**: YES | Message: `chore(ci): enforce api-contract openapi sync` | Files: `scripts/**`, `package.json`

- [x] 6. Frontend Callsite Audit for Planned Removals
  **What to do**: Produce exhaustive references/import report for all five frontend logic files to prevent missed cleanup.
  **Must NOT do**: Do not delete files in this task.
  **Recommended Agent Profile**:
  - Category: `quick` - Reason: deterministic inventory.
  - Skills: `[]`.
  - Omitted: `[ultrabrain]`.
  **Parallelization**: Can Parallel: YES | Wave 1 | Blocks: [8, 10, 12, 14, 16] | Blocked By: []
  **References**:
  - `apps/frontend/src/entities/bot/lib/statuses.ts`
  - `apps/frontend/src/entities/finance/lib/analyticsCalculations.ts`
  - `apps/frontend/src/features/vm-management/lib/deleteVmRules.ts`
  - `apps/frontend/src/shared/lib/utils/schedule/generation.ts`
  - `apps/frontend/src/shared/lib/utils/vm/patcher.ts`
  **Acceptance Criteria**:
  - [ ] Audit report lists all current imports/references.
  - [ ] Each stream has explicit deletion checklist.
  **QA Scenarios**:
  ```text
  Scenario: Full callsite report generated
    Tool: Bash
    Steps: Run grep/AST/LSP reference scan.
    Expected: Complete report with file paths.
    Evidence: .sisyphus/evidence/task-6-callsite.txt

  Scenario: Unexpected new import detected
    Tool: Bash
    Steps: Add temporary import in dry-run and rerun scan.
    Expected: Audit catches drift.
    Evidence: .sisyphus/evidence/task-6-callsite-drift.txt
  ```
  **Commit**: YES | Message: `chore(migration): add frontend callsite removal audit` | Files: `.sisyphus/evidence/*`

- [x] 7. Backend Status Computation (Bots/Resources)
  **What to do**: Compute and return `computed_status`, `days_remaining`, `is_expiring_soon` from backend list/get responses for bots/proxies/subscriptions/licenses.
  **Must NOT do**: No semantic changes to existing rules.
  **Recommended Agent Profile**:
  - Category: `deep` - Reason: multi-entity rule parity.
  - Skills: `[]`.
  - Omitted: `[frontend-ui-ux]`.
  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [8] | Blocked By: [2, 4]
  **References**:
  - `apps/frontend/src/entities/bot/lib/statuses.ts`
  - `apps/backend/src/modules/bots/bots.service.ts`
  - `apps/backend/src/modules/resources/resources.service.ts`
  **Acceptance Criteria**:
  - [ ] New computed status fields returned by backend.
  - [ ] Parity tests pass for status fixtures.
  **QA Scenarios**:
  ```text
  Scenario: Status fields returned correctly
    Tool: Bash
    Steps: Request bot/resource endpoints for fixture tenant.
    Expected: Computed fields present and correct.
    Evidence: .sisyphus/evidence/task-7-status.json

  Scenario: Null/invalid dates handled safely
    Tool: Bash
    Steps: Request records with malformed expiry fields.
    Expected: Stable fallback values, no crash.
    Evidence: .sisyphus/evidence/task-7-status-error.json
  ```
  **Commit**: YES | Message: `feat(backend): move entity status computation to backend` | Files: `apps/backend/src/modules/{bots,resources}/**`

- [x] 8. Frontend Status Cutover + Remove `statuses.ts`
  **What to do**: Switch status consumers to backend computed DTO fields; remove local status utility after parity gate.
  **Must NOT do**: No fallback removal before rollout gate.
  **Recommended Agent Profile**:
  - Category: `general` - Reason: consumer migration.
  - Skills: `[]`.
  - Omitted: `[ultrabrain]`.
  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [17] | Blocked By: [3, 6, 7]
  **References**:
  - `apps/frontend/src/pages/project/selectors.ts`
  - `apps/frontend/src/entities/bot/lib/statuses.ts`
  **Acceptance Criteria**:
  - [ ] No imports of `statuses.ts` remain.
  - [ ] Frontend typecheck/build passes.
  **QA Scenarios**:
  ```text
  Scenario: Status UI uses backend fields
    Tool: Bash
    Steps: Run frontend tests with DTO-driven status payloads.
    Expected: Correct status rendering without local compute.
    Evidence: .sisyphus/evidence/task-8-status-cutover.txt

  Scenario: Flag fallback path still valid pre-cleanup
    Tool: Bash
    Steps: Disable status backend flag and run checks.
    Expected: App remains functional.
    Evidence: .sisyphus/evidence/task-8-status-fallback.txt
  ```
  **Commit**: YES | Message: `refactor(frontend): consume backend status dto and remove local status util` | Files: `apps/frontend/src/pages/**`, `apps/frontend/src/entities/bot/lib/statuses.ts`

- [x] 9. Backend Finance Aggregate Endpoints
  **What to do**: Implement `GET /api/v1/finance/summary`, `GET /api/v1/finance/breakdown`, `GET /api/v1/finance/time-series` returning ready chart DTOs.
  **Must NOT do**: No endpoint requiring frontend full operation download for charting.
  **Recommended Agent Profile**:
  - Category: `deep` - Reason: aggregate correctness + performance.
  - Skills: `[]`.
  - Omitted: `[quick]`.
  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [10] | Blocked By: [2, 4]
  **References**:
  - `apps/frontend/src/entities/finance/lib/analyticsCalculations.ts`
  - `apps/backend/src/modules/finance/finance.service.ts`
  - `apps/backend/src/modules/finance/finance.controller.ts`
  - `packages/api-contract/src/contractRoutesFinance.ts`
  **Acceptance Criteria**:
  - [ ] Three aggregate endpoints available + documented.
  - [ ] Backend tests cover empty/invalid-date/normal ranges.
  - [ ] Payload reduction evidence captured.
  **QA Scenarios**:
  ```text
  Scenario: Aggregates returned as ready DTOs
    Tool: Bash
    Steps: Call summary/breakdown/time-series endpoints.
    Expected: Aggregated payload, no raw operation dump.
    Evidence: .sisyphus/evidence/task-9-finance.json

  Scenario: Invalid period rejected
    Tool: Bash
    Steps: Request malformed/inverted date range.
    Expected: 400 with stable error envelope.
    Evidence: .sisyphus/evidence/task-9-finance-error.json
  ```
  **Commit**: YES | Message: `feat(backend): add finance aggregate endpoints for dashboard and charts` | Files: `apps/backend/src/modules/finance/**`

- [x] 10. Frontend Finance Cutover + Remove `analyticsCalculations.ts`
  **What to do**: Switch finance page to aggregate DTO endpoints; remove local analytics utility after parity and payload-gain validation.
  **Must NOT do**: No dual local+backend math after cutover.
  **Recommended Agent Profile**:
  - Category: `general` - Reason: consumer cleanup.
  - Skills: `[]`.
  - Omitted: `[deep]`.
  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [17] | Blocked By: [3, 6, 9]
  **References**:
  - `apps/frontend/src/pages/finance/index.tsx`
  - `apps/frontend/src/entities/finance/lib/analyticsCalculations.ts`
  - `apps/frontend/src/shared/api/providers/finance-contract-client.ts`
  **Acceptance Criteria**:
  - [ ] Finance page reads aggregate endpoints only.
  - [ ] No imports of `analyticsCalculations.ts` remain.
  **QA Scenarios**:
  ```text
  Scenario: Finance UI renders from backend aggregates
    Tool: Bash
    Steps: Run frontend tests with aggregate endpoint mocks.
    Expected: Charts/summary render without local calculations.
    Evidence: .sisyphus/evidence/task-10-finance-cutover.txt

  Scenario: Endpoint failure handled
    Tool: Bash
    Steps: Mock 500 for summary endpoint in tests.
    Expected: Graceful UI error state.
    Evidence: .sisyphus/evidence/task-10-finance-error.txt
  ```
  **Commit**: YES | Message: `refactor(frontend): use backend finance dto and remove client analytics` | Files: `apps/frontend/src/pages/finance/**`, `apps/frontend/src/entities/finance/lib/analyticsCalculations.ts`

- [x] 11. Backend VM Delete Evaluation Endpoint
  **What to do**: Add `POST /api/v1/vms/evaluate-deletion` returning backend-evaluated `{ vmid, can_delete, reason }` and related fields.
  **Must NOT do**: No client-authoritative deletion policy.
  **Recommended Agent Profile**:
  - Category: `deep` - Reason: safety-critical policy migration.
  - Skills: `[]`.
  - Omitted: `[quick]`.
  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [12] | Blocked By: [2, 4]
  **References**:
  - `apps/frontend/src/features/vm-management/lib/deleteVmRules.ts`
  - `apps/frontend/src/features/vm-management/lib/deleteVmWorkflowCandidates.ts`
  - `apps/backend/src/modules/infra/infra.service.ts`
  - `apps/backend/src/modules/vm-ops/vm-ops.service.ts`
  **Acceptance Criteria**:
  - [ ] Endpoint result parity with baseline reason/eligibility.
  - [ ] Tenant isolation validated.
  **QA Scenarios**:
  ```text
  Scenario: Mixed VM set evaluated correctly
    Tool: Bash
    Steps: POST fixture batch to evaluate-deletion endpoint.
    Expected: Deterministic can_delete + reason per row.
    Evidence: .sisyphus/evidence/task-11-vm-delete.json

  Scenario: Cross-tenant access prevented
    Tool: Bash
    Steps: Evaluate VM ids from different tenant context.
    Expected: No data leak; denied/not-found behavior.
    Evidence: .sisyphus/evidence/task-11-vm-delete-error.json
  ```
  **Commit**: YES | Message: `feat(backend): add vm deletion evaluation endpoint` | Files: `apps/backend/src/modules/{infra,vm-ops}/**`

- [x] 12. Frontend VM Delete Workflow Cutover
  **What to do**: Replace frontend local joins/rules with backend evaluation DTO rendering; remove local evaluator usage.
  **Must NOT do**: No duplicate policy engines post-cutover.
  **Recommended Agent Profile**:
  - Category: `general` - Reason: workflow simplification.
  - Skills: `[]`.
  - Omitted: `[ultrabrain]`.
  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [17] | Blocked By: [3, 6, 11]
  **References**:
  - `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts`
  - `apps/frontend/src/features/vm-management/lib/deleteVmRules.ts`
  - `apps/frontend/src/entities/vm/api/vmDeleteContextFacade.ts`
  **Acceptance Criteria**:
  - [ ] Workflow consumes backend `can_delete`/`reason` directly.
  - [ ] Local delete rule util has zero imports.
  **QA Scenarios**:
  ```text
  Scenario: UI displays backend reasons
    Tool: Bash
    Steps: Run UI tests with evaluate-deletion payload.
    Expected: Reasons shown from API DTO only.
    Evidence: .sisyphus/evidence/task-12-vm-delete-cutover.txt

  Scenario: Evaluator timeout handled
    Tool: Bash
    Steps: Simulate timeout/error from endpoint.
    Expected: Stable fallback/error behavior, no crash.
    Evidence: .sisyphus/evidence/task-12-vm-delete-error.txt
  ```
  **Commit**: YES | Message: `refactor(frontend): use backend vm deletion decisions` | Files: `apps/frontend/src/features/vm-management/**`

- [x] 13. Backend Schedule Generation Endpoint (Seed + Random)
  **What to do**: Move schedule generation to backend endpoint and support optional `seed` deterministic mode.
  **Must NOT do**: No uncontrolled random behavior in parity tests.
  **Recommended Agent Profile**:
  - Category: `ultrabrain` - Reason: algorithm parity + deterministic mode.
  - Skills: `[]`.
  - Omitted: `[quick]`.
  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [14] | Blocked By: [2, 4]
  **References**:
  - `apps/frontend/src/shared/lib/utils/schedule/generation.ts`
  - `apps/backend/src/modules/settings/settings.controller.ts`
  - `apps/backend/src/modules/bots/bots.service.ts`
  **Acceptance Criteria**:
  - [ ] Endpoint returns week schedule DTO from params.
  - [ ] Same seed + params -> identical result.
  - [ ] Validation parity with existing rules.
  **QA Scenarios**:
  ```text
  Scenario: Seeded requests are deterministic
    Tool: Bash
    Steps: Send identical request twice with same seed.
    Expected: Response payloads identical.
    Evidence: .sisyphus/evidence/task-13-schedule-seed.json

  Scenario: Invalid windows rejected
    Tool: Bash
    Steps: Submit overlapping windows/invalid durations.
    Expected: 400 validation envelope.
    Evidence: .sisyphus/evidence/task-13-schedule-error.json
  ```
  **Commit**: YES | Message: `feat(backend): add schedule generation endpoint with seed mode` | Files: `apps/backend/src/modules/{settings,bots}/**`

- [x] 14. Frontend Schedule Cutover + Remove `generation.ts`
  **What to do**: Update schedule UI to call backend generation endpoint; remove local generator after parity gate.
  **Must NOT do**: No dual generation paths post-cutover.
  **Recommended Agent Profile**:
  - Category: `general` - Reason: UI consumer migration.
  - Skills: `[]`.
  - Omitted: `[ultrabrain]`.
  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [17] | Blocked By: [3, 6, 13]
  **References**:
  - `apps/frontend/src/widgets/schedule/ScheduleGenerator.tsx`
  - `apps/frontend/src/widgets/bot-profile/ui/BotSchedule.tsx`
  - `apps/frontend/src/shared/lib/utils/schedule/generation.ts`
  **Acceptance Criteria**:
  - [ ] Frontend schedule generation uses backend endpoint only.
  - [ ] Local generation util has zero imports and is removed.
  **QA Scenarios**:
  ```text
  Scenario: Backend-generated schedule displayed
    Tool: Bash
    Steps: Run UI tests with generation endpoint mocks.
    Expected: Schedule render works without local generator.
    Evidence: .sisyphus/evidence/task-14-schedule-cutover.txt

  Scenario: Backend validation error handled
    Tool: Bash
    Steps: Mock 400 from schedule endpoint.
    Expected: Clear user-facing error state.
    Evidence: .sisyphus/evidence/task-14-schedule-error.txt
  ```
  **Commit**: YES | Message: `refactor(frontend): use backend schedule generation` | Files: `apps/frontend/src/widgets/**`, `apps/frontend/src/shared/lib/utils/schedule/generation.ts`

- [x] 15. Backend VM Config Patching Migration
  **What to do**: Port VM patch logic to backend (vm/infra/vm-ops path), including hardware fingerprint generation and config patch/apply flow.
  **Must NOT do**: No frontend-authoritative regex patching.
  **Recommended Agent Profile**:
  - Category: `deep` - Reason: high-risk config mutation parity.
  - Skills: `[]`.
  - Omitted: `[quick]`.
  **Parallelization**: Can Parallel: YES | Wave 2 | Blocks: [16] | Blocked By: [2, 4]
  **References**:
  - `apps/frontend/src/shared/lib/utils/vm/patcher.ts`
  - `apps/frontend/src/features/vm-management/model/vm/queue/configureVmItem.ts`
  - `apps/backend/src/modules/vm/vm.controller.ts`
  - `apps/backend/src/modules/infra/infra.service.ts`
  - `apps/backend/src/modules/vm-ops/vm-ops.service.ts`
  **Acceptance Criteria**:
  - [ ] Backend patch output matches baseline (MAC/serial/bridge/VNC/IP semantics).
  - [ ] Validation + tenant isolation enforced.
  **QA Scenarios**:
  ```text
  Scenario: Patch plan/apply success
    Tool: Bash
    Steps: Submit patch intent with fixture profile/template.
    Expected: Correct patched output metadata.
    Evidence: .sisyphus/evidence/task-15-vm-patch.json

  Scenario: Malformed config rejected
    Tool: Bash
    Steps: Submit invalid config input.
    Expected: 400 without partial mutation.
    Evidence: .sisyphus/evidence/task-15-vm-patch-error.json
  ```
  **Commit**: YES | Message: `feat(backend): move vm patching to backend services` | Files: `apps/backend/src/modules/{vm,infra,vm-ops}/**`

- [x] 16. Frontend VM Queue Cutover + Remove `patcher.ts`
  **What to do**: Convert queue flow to send intent only; backend performs patching. Remove frontend patcher after parity gate.
  **Must NOT do**: No dual patching paths.
  **Recommended Agent Profile**:
  - Category: `general` - Reason: queue orchestration simplification.
  - Skills: `[]`.
  - Omitted: `[ultrabrain]`.
  **Parallelization**: Can Parallel: NO | Wave 3 | Blocks: [17] | Blocked By: [3, 6, 15]
  **References**:
  - `apps/frontend/src/features/vm-management/model/vm/queue/configureVmItem.ts`
  - `apps/frontend/src/shared/lib/utils/vm/patcher.ts`
  - `apps/frontend/src/shared/lib/utils/vm/index.ts`
  **Acceptance Criteria**:
  - [ ] Queue uses backend patch endpoint only.
  - [ ] `patcher.ts` has zero imports and is removed.
  **QA Scenarios**:
  ```text
  Scenario: Queue works with backend patch responses
    Tool: Bash
    Steps: Run queue tests with successful endpoint mock.
    Expected: Item flow succeeds without local patch logic.
    Evidence: .sisyphus/evidence/task-16-vm-queue-cutover.txt

  Scenario: Endpoint failure handled
    Tool: Bash
    Steps: Mock backend patch failure.
    Expected: Queue item transitions to explicit error state.
    Evidence: .sisyphus/evidence/task-16-vm-queue-error.txt
  ```
  **Commit**: YES | Message: `refactor(frontend): delegate vm patching to backend` | Files: `apps/frontend/src/features/vm-management/**`, `apps/frontend/src/shared/lib/utils/vm/**`

- [x] 17. Final Cleanup: Remove Fallbacks and Deprecated Paths
  **What to do**: After all streams pass parity + rollout gates, remove fallback branches/flags and finalize migration cleanup.
  **Must NOT do**: No fallback removal before all stream gates pass.
  **Recommended Agent Profile**:
  - Category: `unspecified-high` - Reason: cross-stream hardening cleanup.
  - Skills: `[]`.
  - Omitted: `[quick]`.
  **Parallelization**: Can Parallel: NO | Wave 4 | Blocks: [] | Blocked By: [3, 8, 10, 12, 14, 16]
  **References**:
  - `apps/frontend/src/pages/project/selectors.ts`
  - `apps/frontend/src/pages/finance/index.tsx`
  - `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts`
  - `apps/frontend/src/widgets/schedule/ScheduleGenerator.tsx`
  - `apps/frontend/src/features/vm-management/model/vm/queue/configureVmItem.ts`
  **Acceptance Criteria**:
  - [ ] No migrated frontend compute utilities remain.
  - [ ] Full build/test gates pass across contract/backend/frontend.
  **QA Scenarios**:
  ```text
  Scenario: Full quality gate run passes
    Tool: Bash
    Steps: Run contract build + backend test/build + frontend typecheck/build.
    Expected: All commands exit 0.
    Evidence: .sisyphus/evidence/task-17-final-gates.txt

  Scenario: Residual legacy logic scan clean
    Tool: Bash
    Steps: Scan for imports of removed utilities.
    Expected: Zero matches.
    Evidence: .sisyphus/evidence/task-17-legacy-scan.txt
  ```
  **Commit**: YES | Message: `chore(cleanup): remove migration fallbacks and deprecated frontend compute` | Files: `apps/frontend/src/**`, `apps/backend/src/**`, `docs/**`

## Final Verification Wave (4 parallel agents, ALL must APPROVE)
- [x] F1. Plan Compliance Audit - oracle
- [x] F2. Code Quality Review - unspecified-high
- [x] F3. Real Manual QA - unspecified-high (+ playwright if UI)
- [x] F4. Scope Fidelity Check - deep

## Commit Strategy
- Commit by stream milestone.
- Suggested sequence:
  - `feat(contract): add migration dto routes`
  - `feat(backend): migrate <stream> logic from frontend`
  - `refactor(frontend): consume backend <stream> dto`
  - `chore(openapi): sync docs with contract`
  - `chore(cleanup): remove fallback and deprecated frontend compute`

## Success Criteria
- Frontend no longer performs migrated business computations.
- Backend returns ready-to-render DTOs for all five streams.
- Payload size for dashboard/finance is reduced versus baseline capture.
- Parity checks and rollback paths are validated.
- Backend/frontend/contract quality gates remain green.
