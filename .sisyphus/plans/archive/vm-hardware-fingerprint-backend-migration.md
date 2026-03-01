# VM Hardware Fingerprint Backend Migration

## TL;DR

> **Quick Summary**: Move SMBIOS/MAC/SSD generation from frontend utilities to NestJS VM module, expose a single backend endpoint, then switch preview + queue patching to consume server-generated values before deleting frontend generator datasets/files.
>
> **Deliverables**:
> - New backend hardware generator service and endpoint `GET /api/v1/vm/hardware-fingerprint`
> - Frontend preview and queue patch flow updated to fetch fingerprint data from backend
> - Frontend generator files and barrel exports removed
> - Contract and tests updated to lock compatibility
>
> **Estimated Effort**: Medium
> **Parallel Execution**: YES - 3 waves
> **Critical Path**: Contract -> Backend endpoint -> Queue integration -> Cleanup

---

## Context

### Original Request
Move VM hardware spoof generation (SMBIOS/MAC/SSD) from frontend to backend, expose isolated API endpoint, update preview + patching to request server data, then delete old frontend generator code.

### Interview Summary
**Key Discussions**:
- Scope is intentionally surgical: one isolated architectural cleanup, no broad refactor.
- Runtime usage is concentrated in two frontend points: preview and patcher flow.
- Endpoint should be isolated and VM-domain aligned.
- Test strategy selected: **TDD**.

**Research Findings**:
- Current preview generation is local and synchronous in `apps/frontend/src/components/vm/VMConfigPreview.tsx:14`.
- Queue patching calls synchronous `patchConfig` in `apps/frontend/src/hooks/vm/queue/configureVmItem.ts:123`.
- Patcher currently mixes hardware generation with IP/bridge/VNC derivation in `apps/frontend/src/utils/vm/patcher.ts:78`.
- Backend VM route style is zod `safeParse` + `{ success: true, data }` envelope in `apps/backend/src/modules/vm/vm.controller.ts:73`.
- API route contracts are declared in `packages/api-contract/src/contractRoutesVmRegistry.ts:9`.

### Metis Review
**Identified Gaps (addressed in this plan)**:
- Gap: Undefined failure/retry semantics for queue-time fingerprint fetch.
  - Resolution: Explicit bounded retries and fail-fast behavior for configure phase.
- Gap: Risk of scope creep into non-hardware patch logic (IP/VNC/bridge).
  - Resolution: Guardrail to keep IP/VNC/bridge derivation in existing patcher logic for this task.
- Gap: Potential hidden consumers of generator exports.
  - Resolution: Mandatory reference sweep (`lsp_find_references` + grep) before deleting files.
- Gap: Ambiguous `meta` structure.
  - Resolution: Explicit schema contract for `meta` keys and stable optional extensibility.

---

## Work Objectives

### Core Objective
Centralize hardware fingerprint generation (SMBIOS/MAC/SSD) on backend so frontend no longer ships hardware datasets or generation logic, while preserving current VM configure flow behavior.

### Concrete Deliverables
- Backend hardware generator module under `apps/backend/src/modules/vm/hardware-generator/`.
- New VM endpoint `GET /api/v1/vm/hardware-fingerprint` with contract-backed response.
- Frontend API integration for preview and configure queue flow.
- Deleted frontend generator files:
  - `apps/frontend/src/utils/vm/generateMac.ts`
  - `apps/frontend/src/utils/vm/generateSmbios.ts`
  - `apps/frontend/src/utils/vm/generateSsdSerial.ts`
  - `apps/frontend/src/utils/vm/smbiosPlatformGroups.ts`
  - `apps/frontend/src/utils/vm/smbiosRamDb.ts`
  - `apps/frontend/src/utils/vm/generators.ts`

### Definition of Done
- [x] `GET /api/v1/vm/hardware-fingerprint` returns `200` with envelope `{ success: true, data }` and required fields.
- [x] `VMConfigPreview` uses backend response (no local `generate*` calls).
- [x] Queue configure path fetches hardware fingerprint before patching config.
- [x] Frontend no longer imports removed generator files.
- [x] Backend + frontend tests pass for changed scope.

### Must Have
- Contract-first schema updates in `@botmox/api-contract`.
- DI-based backend service wiring via VM module.
- Deterministic response format with validated fields and zod-based parsing.
- Explicit error handling in preview and configure queue paths.

### Must NOT Have (Guardrails)
- No migration of IP/bridge/VNC generation logic in this task.
- No long-lived dual-path implementation after cleanup phase.
- No persistence/history subsystem for fingerprints.
- No vm-ops architecture rewrite.
- No exposure of hardware datasets via API payload.

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: TDD
- **Framework**:
  - Backend: Node test runner (`apps/backend/scripts/run-tests.cjs:50`)
  - Frontend E2E: Playwright (`apps/frontend/playwright.config.ts:9`)

### If TDD Enabled

Each implementation TODO follows RED-GREEN-REFACTOR:

1. **RED**: Add/adjust failing test for target behavior.
2. **GREEN**: Implement minimal code for passing test.
3. **REFACTOR**: Clean up while keeping tests green.

Test command baseline:
- Backend targeted: `pnpm --filter @botmox/backend test -- src/modules/vm/**/*.test.ts`
- Backend full: `pnpm run backend:test`
- Frontend e2e scoped: `pnpm --filter @botmox/frontend test:e2e`

---

## Execution Strategy

### Parallel Execution Waves

```text
Wave 1 (Start Immediately):
├── Task 1: Contract + schema additions
└── Task 2: Backend hardware-generator service scaffold

Wave 2 (After Wave 1):
├── Task 3: Backend controller endpoint wiring
├── Task 4: Frontend API client + React Query hook additions
└── Task 5: Queue integration seam design (pre-patch fetch)

Wave 3 (After Wave 2):
├── Task 6: VMConfigPreview migration to backend call
├── Task 7: Queue configure + patcher migration
└── Task 8: Frontend generator cleanup + export pruning

Wave 4 (After Wave 3):
└── Task 9: Tests, verification, and API docs alignment

Critical Path: 1 -> 3 -> 7 -> 8 -> 9
Parallel Speedup: ~35% vs strict sequential
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|----------------------|
| 1 | None | 3,4 | 2 |
| 2 | None | 3 | 1 |
| 3 | 1,2 | 6,7 | 4,5 |
| 4 | 1 | 6,7 | 3,5 |
| 5 | 1 | 7 | 3,4 |
| 6 | 3,4 | 8,9 | 7 |
| 7 | 3,4,5 | 8,9 | 6 |
| 8 | 6,7 | 9 | None |
| 9 | 8 | None | None |

### Agent Dispatch Summary

| Wave | Tasks | Recommended Agents |
|------|-------|--------------------|
| 1 | 1,2 | `delegate_task(category="quick", load_skills=["git-master"], run_in_background=true)` |
| 2 | 3,4,5 | Dispatch parallel after Wave 1 complete |
| 3 | 6,7,8 | Dispatch parallel after Wave 2 complete |
| 4 | 9 | Single integration pass |

---

## TODOs

- [x] 1. Define API contract for hardware fingerprint endpoint

  **What to do**:
  - Add zod schemas for fingerprint response and optional query params in contract package.
  - Register `GET /api/v1/vm/hardware-fingerprint` route in VM registry contract with success/error envelopes.
  - Export schema in shared contract entrypoint if required by existing module pattern.
  - RED: add failing contract-level test/validation fixture (if project uses schema assertions).
  - GREEN: implement schema + route contract until contract validation passes.
  - REFACTOR: normalize naming and optional `meta` extensibility.

  **Must NOT do**:
  - Do not expose source datasets in API schema.
  - Do not introduce UUID/path dependency unless required by current endpoint requirement.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded schema/route metadata updates.
  - **Skills**: [`git-master`]
    - `git-master`: keep contract edits atomic and traceable.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: no UI work in this task.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 3, 4
  - **Blocked By**: None

  **References**:
  - `packages/api-contract/src/contractRoutesVmRegistry.ts:9` - Existing VM route contract anchor.
  - `packages/api-contract/src/contractRoutesVmRegistry.ts:12` - Existing `/api/v1/vm/:uuid/resolve` style.
  - `packages/api-contract/src/schemasAgentsVmOpsArtifacts.ts:261` - Existing VM path schema pattern.
  - `packages/api-contract/src/schemasAgentsVmOpsArtifacts.ts:265` - Existing VM record schema conventions.
  - `packages/api-contract/src/schemas.ts:2` - Export chain includes schema module.

  **Acceptance Criteria**:
  - [ ] Contract includes new route entry with method/path/headers/responses.
  - [ ] Fingerprint payload schema validates `mac`, `ssdSerial`, `smbiosArgs`, `meta`.
  - [ ] Schema compilation/type checks pass.

  **Manual Execution Verification**:
  - [ ] Run: `pnpm run check:all:mono`
  - [ ] Expected: contract/type checks pass without route schema errors.
  - [ ] Evidence: terminal output includes successful package checks.

  **Commit**: YES
  - Message: `feat(api-contract): add vm hardware fingerprint route schema`
  - Files: `packages/api-contract/src/contractRoutesVmRegistry.ts`, `packages/api-contract/src/schemasAgentsVmOpsArtifacts.ts`
  - Pre-commit: `pnpm run check:all:mono`

- [x] 2. Create backend hardware generator module/service in VM domain

  **What to do**:
  - Create `apps/backend/src/modules/vm/hardware-generator/`.
  - Move/copy generator logic + datasets from frontend utils into backend module.
  - Encapsulate generation in DI service (`VmHardwareService`) returning typed DTO.
  - RED: add failing service unit test for output format + required fields.
  - GREEN: implement service and pass tests.
  - REFACTOR: split pure helpers from service facade to keep testability.

  **Must NOT do**:
  - Do not add DB persistence layer for fingerprints.
  - Do not change existing VM repository behavior.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: logic migration with dataset integrity and typing.
  - **Skills**: [`git-master`]
    - `git-master`: preserve traceability during file moves and edits.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: no visual work.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 1)
  - **Blocks**: 3
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/utils/vm/generateSmbios.ts:191` - Current SMBIOS generation entry.
  - `apps/frontend/src/utils/vm/generateMac.ts:16` - Current MAC generation format.
  - `apps/frontend/src/utils/vm/generateSsdSerial.ts:8` - Current SSD serial generation format.
  - `apps/frontend/src/utils/vm/smbiosPlatformGroups.ts` - Platform dataset source.
  - `apps/frontend/src/utils/vm/smbiosRamDb.ts` - RAM dataset source.
  - `apps/backend/src/modules/vm/vm.module.ts:6` - VM module wiring style.

  **Acceptance Criteria**:
  - [ ] Backend module exists with service exposing one fingerprint generation method.
  - [ ] Service output contains required fields and valid string formats.
  - [ ] Unit tests pass for service output shape.

  **Manual Execution Verification**:
  - [ ] Run: `pnpm --filter @botmox/backend test -- src/modules/vm/**/*.test.ts`
  - [ ] Expected output contains passing tests for hardware service.

  **Commit**: YES
  - Message: `feat(backend-vm): add hardware fingerprint generator service`
  - Files: `apps/backend/src/modules/vm/hardware-generator/*`, `apps/backend/src/modules/vm/*`
  - Pre-commit: `pnpm --filter @botmox/backend test -- src/modules/vm/**/*.test.ts`

- [x] 3. Add VM controller endpoint and DI integration

  **What to do**:
  - Add `@Get('hardware-fingerprint')` in VM controller.
  - Keep auth and envelope style aligned with existing VM controller methods.
  - Parse query params via contract zod schema and return `{ success: true, data }`.
  - Wire service in VM module (provider injection and constructor updates).
  - RED: add failing controller/service test for endpoint response envelope.
  - GREEN: implement endpoint.
  - REFACTOR: normalize error codes/messages to existing VM conventions.

  **Must NOT do**:
  - Do not add route under unrelated modules (`vm-ops`, `infra`) for this task.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: bounded controller/service wiring.
  - **Skills**: [`git-master`]
    - `git-master`: safe, minimal-churn backend edits.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: not applicable.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2 (with 4,5)
  - **Blocks**: 6,7
  - **Blocked By**: 1,2

  **References**:
  - `apps/backend/src/modules/vm/vm.controller.ts:18` - Current controller route base.
  - `apps/backend/src/modules/vm/vm.controller.ts:82` - `safeParse` + `BadRequestException` pattern.
  - `apps/backend/src/modules/vm/vm.controller.ts:99` - success envelope return pattern.
  - `apps/backend/src/modules/vm/vm.module.ts:7` - controller/provider registration.
  - `apps/backend/src/main.ts:85` - global `/api/v1` prefix.

  **Acceptance Criteria**:
  - [ ] Endpoint reachable at `GET /api/v1/vm/hardware-fingerprint`.
  - [ ] Invalid query/path input returns `400` with error envelope.
  - [ ] Valid call returns envelope with expected payload.

  **Manual Execution Verification**:
  - [ ] Request: `curl -X GET http://localhost:3002/api/v1/vm/hardware-fingerprint -H "Authorization: Bearer <token>"`
  - [ ] Status: `200`
  - [ ] Response includes: `{"success":true,"data":{"mac":...,"ssdSerial":...,"smbiosArgs":...,"meta":...}}`

  **Commit**: YES
  - Message: `feat(backend-vm): expose hardware fingerprint endpoint`
  - Files: `apps/backend/src/modules/vm/vm.controller.ts`, `apps/backend/src/modules/vm/vm.service.ts`, `apps/backend/src/modules/vm/vm.module.ts`
  - Pre-commit: `pnpm --filter @botmox/backend test -- src/modules/vm/**/*.test.ts`

- [x] 4. Add frontend VM API client + query primitives for fingerprint fetch

  **What to do**:
  - Add frontend API function in VM facade/provider layer for hardware fingerprint endpoint.
  - Extend `vmQueryKeys` with fingerprint key factory.
  - Add `useMutation`/or imperative query helper aligned with existing VM API patterns.
  - RED: add failing test for API parser/adapter (if existing unit harness) or type-level assertion.
  - GREEN: implement call + type-safe response mapping.
  - REFACTOR: normalize naming and exports.

  **Must NOT do**:
  - Do not bypass existing vm facade/provider abstraction with ad-hoc fetch in components.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: predictable frontend API plumbing.
  - **Skills**: [`git-master`]
    - `git-master`: preserve export graph consistency.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: no styling changes.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 6,7
  - **Blocked By**: 1

  **References**:
  - `apps/frontend/src/entities/vm/api/vmQueryKeys.ts:1` - VM query key convention.
  - `apps/frontend/src/entities/vm/api/useVmActionMutations.ts:40` - VM mutation hook style.
  - `apps/frontend/src/entities/vm/api/useVmQueries.ts:8` - VM query hook style.
  - `apps/frontend/src/providers/vm-read-client.ts:1` - provider export entrypoint pattern.
  - `apps/frontend/src/providers/vm-read-client/core.ts:69` - provider API method style.

  **Acceptance Criteria**:
  - [ ] New typed client function exists for hardware fingerprint endpoint.
  - [ ] Query key factory updated for fingerprint domain.
  - [ ] Hook/helper returns normalized typed data.

  **Manual Execution Verification**:
  - [ ] Run app and trigger client call in dev tools.
  - [ ] Verify request target is `/api/v1/vm/hardware-fingerprint`.
  - [ ] Verify response envelope unwrap logic matches existing patterns.

  **Commit**: YES
  - Message: `feat(frontend-vm): add hardware fingerprint api client hook`
  - Files: `apps/frontend/src/entities/vm/api/*`, `apps/frontend/src/providers/*`
  - Pre-commit: `pnpm --filter @botmox/frontend exec tsc -b --pretty false`

- [x] 5. Finalize queue integration contract and retry/cancel policy

  **What to do**:
  - Define where and how configure flow fetches fingerprint (before `patchConfig`).
  - Specify bounded retry policy for endpoint fetch in queue phase (e.g., 3 attempts with backoff).
  - Specify cancellation checks before/after fetch await.
  - RED: add failing tests/spec assertions around retry/cancel behavior if queue test harness exists.
  - GREEN: implement policy.
  - REFACTOR: centralize constants for timeout/retry.

  **Must NOT do**:
  - Do not move fetch inside render paths.
  - Do not make `patchConfig` perform network IO.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: queue semantics and failure policy are high-impact.
  - **Skills**: [`git-master`]
    - `git-master`: controlled changes in critical flow.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: no visual concern.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 7
  - **Blocked By**: 1

  **References**:
  - `apps/frontend/src/hooks/vm/queue/configureVmItem.ts:67` - existing read retry loop pattern.
  - `apps/frontend/src/hooks/vm/queue/configureVmItem.ts:123` - current patch injection seam.
  - `apps/frontend/src/hooks/vm/useVMQueue.ts:134` - queue processing lock/cancellation context.
  - `apps/frontend/src/hooks/vm/queue/processor.ts:138` - sequential phase order.

  **Acceptance Criteria**:
  - [ ] Queue fetch happens before config patch generation.
  - [ ] Retry/cancel behavior is deterministic and logged.
  - [ ] Failure mode is explicit (item marked error, no partial apply).

  **Manual Execution Verification**:
  - [ ] Simulate endpoint failure and run queue.
  - [ ] Verify queue item transitions to error with clear log.
  - [ ] Simulate success and verify configure continues normally.

  **Commit**: NO

- [x] 6. Migrate VM preview component to backend-driven generation

  **What to do**:
  - Replace local `generate*` calls in preview button handler with API mutation/helper call.
  - Map backend `data.meta` to brand/product/cpu UI fields.
  - Keep copy action on returned `smbiosArgs`.
  - Add loading/disabled/error UI states for preview request.
  - RED: add failing UI/component test for button-triggered server preview.
  - GREEN: implement component behavior.
  - REFACTOR: remove obsolete local generator type imports.

  **Must NOT do**:
  - Do not perform automatic fetch on every render.
  - Do not keep hidden fallback to local generators.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: isolated component logic change.
  - **Skills**: [`git-master`]
    - `git-master`: keeps component edit atomic.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: structure/styling unchanged.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 7)
  - **Blocks**: 8,9
  - **Blocked By**: 3,4

  **References**:
  - `apps/frontend/src/components/vm/VMConfigPreview.tsx:6` - local generator imports to remove.
  - `apps/frontend/src/components/vm/VMConfigPreview.tsx:14` - button trigger to migrate.
  - `apps/frontend/src/components/vm/VMConfigPreview.tsx:65` - displayed SMBIOS args output.
  - `apps/frontend/src/entities/vm/api/useVmActionMutations.ts:1` - mutation hook style.

  **Acceptance Criteria**:
  - [ ] Clicking `Generate Preview` sends backend request and renders response.
  - [ ] Loading and error states are visible and non-blocking.
  - [ ] No direct import of removed generator functions in component.

  **Manual Execution Verification**:
  - [ ] Using playwright/browser: open VM settings preview tab.
  - [ ] Click `Generate Preview`.
  - [ ] Verify MAC/Serial/SMBIOS values appear from server payload.
  - [ ] Verify `Copy Args` copies backend-sourced args string.

  **Commit**: YES
  - Message: `refactor(frontend-vm): use backend fingerprint in config preview`
  - Files: `apps/frontend/src/components/vm/VMConfigPreview.tsx`, `apps/frontend/src/entities/vm/api/*`
  - Pre-commit: `pnpm --filter @botmox/frontend exec tsc -b --pretty false`

- [x] 7. Migrate queue patch flow to consume fetched hardware data

  **What to do**:
  - Update configure flow to fetch fingerprint once per VM configure attempt.
  - Adjust `patchConfig` signature (or wrapper) to accept pre-generated values instead of generating internally.
  - Preserve existing IP/bridge/VNC derivation and mutable patch generation behavior.
  - Ensure logs still emit generated values and patch delta context.
  - RED: add failing tests for patching with injected values.
  - GREEN: implement new flow and make tests pass.
  - REFACTOR: isolate payload adapter from patch logic.

  **Must NOT do**:
  - Do not remove queue ordering guarantees.
  - Do not keep any runtime calls to `generateSmbios/generateMac/generateSsdSerial`.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: core queue mutation path with potential side effects.
  - **Skills**: [`git-master`]
    - `git-master`: safer evolution of high-risk flow.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: not relevant.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3 (with 6)
  - **Blocks**: 8,9
  - **Blocked By**: 3,4,5

  **References**:
  - `apps/frontend/src/hooks/vm/queue/configureVmItem.ts:123` - current patch callsite.
  - `apps/frontend/src/hooks/vm/queue/configureVmItem.ts:182` - config apply side effect boundary.
  - `apps/frontend/src/utils/vm/patcher.ts:78` - current patcher API and generation coupling.
  - `apps/frontend/src/utils/vm/patcher.ts:148` - patch change reporting contract.
  - `apps/frontend/src/hooks/vm/queue/utils.ts` - mutable patch extraction remains unchanged.

  **Acceptance Criteria**:
  - [ ] Configure flow fetches backend hardware values prior to patching.
  - [ ] `patchConfig` no longer imports local generator files.
  - [ ] Generated values logged and applied correctly.

  **Manual Execution Verification**:
  - [ ] Run queue for at least one VM.
  - [ ] Verify log line still contains generated IP/MAC/serial/vnc context.
  - [ ] Verify Proxmox mutable patch contains updated args/net/sata values.

  **Commit**: YES
  - Message: `refactor(vm-queue): inject backend hardware fingerprint into patcher`
  - Files: `apps/frontend/src/hooks/vm/queue/configureVmItem.ts`, `apps/frontend/src/utils/vm/patcher.ts`
  - Pre-commit: `pnpm --filter @botmox/frontend exec tsc -b --pretty false`

- [x] 8. Remove frontend hardware generator files and prune exports/imports

  **What to do**:
  - Remove generator and dataset files from frontend utils/vm.
  - Update barrel exports in `utils/vm/index.ts` and any dependent imports.
  - Run reference sweep to ensure zero usage before deletion.
  - RED: fail build/type-check due to lingering imports.
  - GREEN: fix all imports and pass checks.
  - REFACTOR: remove no-longer-needed types from public surface.

  **Must NOT do**:
  - Do not delete files before callsites are migrated.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: cleanup + import graph normalization.
  - **Skills**: [`git-master`]
    - `git-master`: safe deletion/rename discipline.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: no UI styling work.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential (after 6,7)
  - **Blocks**: 9
  - **Blocked By**: 6,7

  **References**:
  - `apps/frontend/src/utils/vm/generators.ts:1` - generator export fan-out.
  - `apps/frontend/src/utils/vm/index.ts:1` - public vm utils surface.
  - `apps/frontend/src/components/vm/VMConfigPreview.tsx:6` - import to remove.
  - `apps/frontend/src/utils/vm/patcher.ts:4` - imports to remove.

  **Acceptance Criteria**:
  - [ ] All listed generator files deleted from frontend.
  - [ ] `grep`/`lsp_find_references` confirms no references remain.
  - [ ] Frontend type-check passes.

  **Manual Execution Verification**:
  - [ ] Run `grep` for `generateSmbios|generateMac|generateSsdSerial` in `apps/frontend/src`.
  - [ ] Expected: zero runtime matches.
  - [ ] Run `pnpm --filter @botmox/frontend exec tsc -b --pretty false` -> success.

  **Commit**: YES
  - Message: `chore(frontend-vm): remove local hardware generator assets`
  - Files: `apps/frontend/src/utils/vm/*`, dependent import files
  - Pre-commit: `pnpm --filter @botmox/frontend exec tsc -b --pretty false`

- [x] 9. Verification, regression tests, and docs sync

  **What to do**:
  - Add/adjust backend tests for endpoint schema and generation invariants.
  - Add/adjust frontend e2e scenario to verify preview button and queue patch behavior.
  - Update API docs (`openapi`) if this repository requires manual path updates.
  - RED: ensure tests fail before implementation updates.
  - GREEN: pass backend and e2e checks.
  - REFACTOR: stabilize flaky assertions by asserting structure, not exact random values.

  **Must NOT do**:
  - Do not assert exact random values for non-deterministic fields.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: integration and regression confidence step.
  - **Skills**: [`git-master`]
    - `git-master`: clean test/docs change set.
  - **Skills Evaluated but Omitted**:
    - `frontend-ui-ux`: no design changes.

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Final wave
  - **Blocks**: None
  - **Blocked By**: 8

  **References**:
  - `apps/backend/scripts/run-tests.cjs:15` - backend test file discovery pattern.
  - `apps/frontend/playwright.config.ts:10` - frontend e2e test harness.
  - `apps/backend/src/modules/vm/vm.controller.ts:73` - endpoint test structure target.
  - `docs/api/openapi.yaml` - API documentation source.

  **Acceptance Criteria**:
  - [ ] Backend VM tests pass.
  - [ ] Frontend e2e scenario for preview and queue passes.
  - [ ] API docs include new endpoint (if docs are contract-required).

  **Manual Execution Verification**:
  - [ ] Run: `pnpm run backend:test` -> all pass.
  - [ ] Run: `pnpm --filter @botmox/frontend test:e2e` -> preview scenario passes.
  - [ ] Run quick API smoke with `curl` and verify response envelope.

  **Commit**: YES
  - Message: `test(vm): cover backend fingerprint and frontend integration flow`
  - Files: backend vm tests, frontend e2e specs, optional API docs
  - Pre-commit: `pnpm run backend:test && pnpm --filter @botmox/frontend test:e2e`

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `feat(api-contract): add vm hardware fingerprint route schema` | contract route/schema files | `pnpm run check:all:mono` |
| 2-3 | `feat(backend-vm): add hardware fingerprint endpoint and service` | backend vm module files | `pnpm --filter @botmox/backend test -- src/modules/vm/**/*.test.ts` |
| 4,6,7 | `refactor(frontend-vm): consume backend hardware fingerprint` | frontend vm api/component/queue/patch files | `pnpm --filter @botmox/frontend exec tsc -b --pretty false` |
| 8 | `chore(frontend-vm): remove local hardware generator assets` | frontend utils/vm deletions + import updates | `pnpm --filter @botmox/frontend exec tsc -b --pretty false` |
| 9 | `test(vm): add migration regression coverage` | backend tests + frontend e2e + docs | `pnpm run backend:test && pnpm --filter @botmox/frontend test:e2e` |

---

## Success Criteria

### Verification Commands
```bash
pnpm run backend:test
pnpm --filter @botmox/frontend exec tsc -b --pretty false
pnpm --filter @botmox/frontend test:e2e
curl -X GET http://localhost:3002/api/v1/vm/hardware-fingerprint -H "Authorization: Bearer <token>"
```

### Final Checklist
- [x] Backend endpoint returns valid envelope and payload structure.
- [x] Preview uses backend-generated values.
- [x] Queue configure fetches fingerprint and applies patch correctly.
- [x] Frontend hardware dataset/generator files are removed.
- [x] Tests and verification commands pass.
