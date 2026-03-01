# Frontend FSD Strict Completion

## TL;DR

> **Quick Summary**: Finish the remaining frontend FSD migration by removing duplicate status logic and migrating all legacy root folders (`utils`, `hooks`, `types`, `providers`, `data`, `services`) into strict FSD layers without changing runtime behavior.
>
> **Deliverables**:
> - Single canonical status logic in `entities`
> - No legacy root folders under `apps/frontend/src`
> - Updated import graph with strict layer direction
> - Passing type/build/e2e verification
>
> **Estimated Effort**: Large
> **Parallel Execution**: YES - 4 waves
> **Critical Path**: 1 -> 2 -> 4 -> 7 -> 8

---

## Context

### Original Request
Finalize the migration that is currently ~85% complete: eliminate leftover duplicated business logic and remove architectural hybrid state by fully enforcing strict FSD structure at `apps/frontend/src`.

### Interview Summary
**Key Discussions**:
- Canonical target architecture is strict FSD root layers: `app`, `pages`, `widgets`, `features`, `entities`, `shared`.
- `src/services` migration target is **hybrid split**:
  - transport/API wrappers -> `src/shared/api/services`
  - domain orchestration -> `src/entities/*` and `src/features/*`
- Test strategy is **Tests-after** (not strict TDD), with mandatory automated verification gates.

**Research Findings**:
- Duplicate status logic exists in `apps/frontend/src/pages/datacenter/page-helpers.ts` and canonical logic already exists in `apps/frontend/src/entities/bot/lib/statuses.ts`.
- Legacy-root imports remain widespread for `utils`, `hooks`, `types`, `providers`, `data`, `services`.

### Metis Review (Applied)
**Identified Gaps Addressed in this Plan**:
- Added explicit guardrails against behavior drift and scope creep.
- Added wave-based migration with hard entry/exit criteria.
- Added boundary acceptance scans for forbidden directions.
- Added explicit criteria for physical removal of legacy folders.

---

## Work Objectives

### Core Objective
Complete strict FSD migration for frontend so architecture is no longer hybrid and all legacy root folders are removed while behavior remains unchanged.

### Concrete Deliverables
- `apps/frontend/src/pages/datacenter/page-helpers.ts` uses canonical status logic from `entities`.
- `apps/frontend/src/{utils,hooks,types,providers,data,services}` removed.
- New canonical locations populated under `apps/frontend/src/shared/*`, `apps/frontend/src/app/providers`, `apps/frontend/src/entities/*`, and `apps/frontend/src/features/*`.
- Import graph passes strict direction checks and compiles.

### Definition of Done
- [x] `pnpm --dir apps/frontend run typecheck` passes.
- [x] `pnpm --dir apps/frontend run build` passes.
- [x] `pnpm --dir apps/frontend run test:e2e -- e2e/fsd-boundaries-migration.spec.ts` passes.
- [x] `rg -n "components/|utils/|hooks/|types/|providers/|data/|services/" apps/frontend/src` returns only valid new-layer paths (no legacy root-path imports).
- [x] Legacy root folders no longer exist under `apps/frontend/src`.

### Must Have
- Behavior-preserving migration only.
- Canonical ownership of bot status logic in `entities`.
- Deterministic import rewiring with zero unresolved modules.

### Must NOT Have (Guardrails)
- No feature redesign, UI redesign, or business-rule changes.
- No temporary compatibility shims in legacy root folders after completion.
- No cross-layer forbidden dependencies (`entities -> features/widgets/pages`, `features -> widgets/pages`, `widgets -> pages`).

---

## Verification Strategy (MANDATORY)

### Test Decision
- **Infrastructure exists**: YES
- **User wants tests**: YES (Tests-after)
- **Framework**: TypeScript build checks + Playwright (`@playwright/test`)

### Tests-after Flow
After each migration wave:
1. `pnpm --dir apps/frontend run typecheck`
2. `pnpm --dir apps/frontend run build`
3. Boundary scans for forbidden imports

Final gate:
1. `pnpm --dir apps/frontend run test:e2e -- e2e/fsd-boundaries-migration.spec.ts`
2. Optional safety pass: `pnpm --dir apps/frontend run test:e2e -- e2e/smoke.spec.ts`

---

## Execution Strategy

### Parallel Execution Waves

```
Wave 1 (Foundation):
├── Task 1: Canonicalize status logic (datacenter dedupe)
└── Task 2: Build full legacy import inventory and ownership map

Wave 2 (Shared/App migrations):
├── Task 3: Move utils -> shared/lib/utils
├── Task 4: Move global types -> shared/types
└── Task 5: Move providers -> shared/api/providers + app/providers

Wave 3 (Domain migrations):
├── Task 6: Move hooks -> shared/lib/hooks + vm domain ownership
└── Task 7: Move services + data with hybrid split

Wave 4 (Hardening):
└── Task 8: Remove legacy roots, enforce scans, run final gates

Critical Path: 1 -> 2 -> 4 -> 7 -> 8
```

### Dependency Matrix

| Task | Depends On | Blocks | Can Parallelize With |
|------|------------|--------|---------------------|
| 1 | None | 8 | 2 |
| 2 | None | 3,4,5,6,7 | 1 |
| 3 | 2 | 8 | 4,5 |
| 4 | 2 | 8 | 3,5 |
| 5 | 2 | 8 | 3,4 |
| 6 | 2 | 8 | 7 |
| 7 | 2,4 | 8 | 6 |
| 8 | 1,3,4,5,6,7 | None | None |

---

### Deterministic Classification Rules (No Guesswork)

Use these rules for every file moved from legacy roots:

1. **`app/*` target**: file composes app bootstrap lifecycle (root providers, app wiring, runtime bootstrap orchestration).
2. **`shared/*` target**: file is domain-agnostic and reusable across multiple domains.
3. **`entities/*` target**: file represents domain model/state/read/write logic for a business noun.
4. **`features/*` target**: file orchestrates a user action/use-case on top of entities.
5. **Never target `pages/*` or `widgets/*`** for infrastructure utilities from legacy roots.

Required mapping examples (must be mirrored in Task 2 artifact):
- `apps/frontend/src/utils/scheduleUtils.ts` -> `apps/frontend/src/shared/lib/utils/scheduleUtils.ts`
- `apps/frontend/src/providers/auth-provider.ts` -> `apps/frontend/src/app/providers/auth-provider.ts`
- `apps/frontend/src/providers/bot-contract-client/*` -> `apps/frontend/src/shared/api/providers/bot-contract-client/*`
- `apps/frontend/src/services/vmService/proxmoxOps.ts` -> `apps/frontend/src/shared/api/services/vm/proxmoxOps.ts`
- `apps/frontend/src/hooks/useVMQueue.ts` -> `apps/frontend/src/features/vm-management/model/useVMQueue.ts` (if VM-action-specific)

---

## TODOs

- [x] 1. Remove duplicated status logic from datacenter and use entities canonical implementation

  **What to do**:
  - Replace local `computeBotStatus` usage in `apps/frontend/src/pages/datacenter/page-helpers.ts` with import from `apps/frontend/src/entities/bot/lib/statuses.ts`.
  - Preserve datacenter semantics that currently depend on `currentTime` by adding/using an explicit canonical adapter in entities (e.g. `computeBotStatusAt(bot, currentTime)`) and routing both page and entities logic through the same canonical branch.
  - Keep `buildProjectStats` behavior unchanged.

  **Must NOT do**:
  - Do not change status semantics.

  **Recommended Agent Profile**:
  - **Category**: `quick`
    - Reason: constrained refactor with clear ownership.
  - **Skills**: `frontend-ui-ux`
    - `frontend-ui-ux`: safe TS import rewiring.

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1 (with Task 2)
  - **Blocks**: 8
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src/pages/datacenter/page-helpers.ts` - duplicate logic source to remove.
  - `apps/frontend/src/entities/bot/lib/statuses.ts` - canonical status implementation.
  - `apps/frontend/src/entities/bot/lib/statuses.types.ts` - canonical status-related types.

  **Acceptance Criteria**:
  - [ ] No local `computeBotStatus` function remains in `apps/frontend/src/pages/datacenter/page-helpers.ts`.
  - [ ] Datacenter helper imports canonical status logic from `entities`.
  - [ ] Status parity is verified for datacenter scenarios (same output before/after for active/offline/never-launched/banned inputs).
  - [ ] `pnpm --dir apps/frontend run typecheck` passes.

- [x] 2. Build exhaustive legacy-root import inventory and file ownership map

  **What to do**:
  - Generate exact lists of imports and files for `utils`, `hooks`, `types`, `providers`, `data`, `services`.
  - Assign each file target layer (`shared`, `app`, `entities`, `features`) before moving.
  - Write artifact: `.sisyphus/artifacts/fsd-strict-classification-map.md`.
  - Required artifact fields per file: `source_path`, `target_path`, `target_layer`, `owner_reason`, `consumer_count`, `risk_level`, `wave`.

  **Must NOT do**:
  - Do not migrate yet; this task is planning/inventory only.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
    - Reason: large dependency graph mapping.
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 1
  - **Blocks**: 3,4,5,6,7
  - **Blocked By**: None

  **References**:
  - `apps/frontend/src` - full source tree for import scan.
  - `apps/frontend/tsconfig*.json` - alias behavior during migration.

  **Acceptance Criteria**:
  - [ ] `.sisyphus/artifacts/fsd-strict-classification-map.md` exists with required fields.
  - [ ] Ownership map includes every file under the six legacy roots.
  - [ ] No unclassified files remain before move waves begin.

- [x] 3. Migrate `src/utils` to `src/shared/lib/utils`

  **What to do**:
  - Move utility modules to `apps/frontend/src/shared/lib/utils`.
  - Rewire all imports from `utils/*` to new shared paths.

  **Must NOT do**:
  - Do not alter utility function behavior.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 8
  - **Blocked By**: 2

  **References**:
  - `apps/frontend/src/utils/*` - migration source.
  - `apps/frontend/src/widgets/schedule/*` - heavy `scheduleUtils` consumers.
  - `apps/frontend/src/pages/proxies/*` - `proxyUtils` consumers.

  **Acceptance Criteria**:
  - [ ] `rg -n "from ['\"][^'\"]*(^|/)(utils)/" apps/frontend/src` returns zero matches.
  - [ ] `apps/frontend/src/utils` removed.
  - [ ] `pnpm --dir apps/frontend run typecheck` passes.

- [x] 4. Migrate global `src/types` to `src/shared/types`

  **What to do**:
  - Move global types into `apps/frontend/src/shared/types`.
  - Rewire type imports to shared location.

  **Must NOT do**:
  - Do not change type contracts.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 7,8
  - **Blocked By**: 2

  **References**:
  - `apps/frontend/src/types/*` - migration source.
  - `apps/frontend/src/entities/*` and `apps/frontend/src/pages/*` - frequent type consumers.

  **Acceptance Criteria**:
  - [ ] No imports from root `types/*` remain.
  - [ ] `apps/frontend/src/types` removed.
  - [ ] `pnpm --dir apps/frontend run typecheck` passes.

- [x] 5. Split `src/providers` into `src/shared/api/providers` and `src/app/providers`

  **What to do**:
  - Move API contract/provider clients to `apps/frontend/src/shared/api/providers`.
  - Move application composition providers to `apps/frontend/src/app/providers`.
  - Keep provider order in app bootstrap behavior-equivalent.

  **Must NOT do**:
  - Do not change auth/session behavior.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 2
  - **Blocks**: 8
  - **Blocked By**: 2

  **References**:
  - `apps/frontend/src/providers/*` - migration source.
  - `apps/frontend/src/App.tsx` - provider wiring and composition.
  - `apps/frontend/src/app/providers/*` - existing app-level provider pattern.

  **Acceptance Criteria**:
  - [ ] All provider imports resolve from `shared/api/providers` or `app/providers`.
  - [ ] No imports remain from root `providers/*`.
  - [ ] `pnpm --dir apps/frontend run build` passes.

- [x] 6. Migrate `src/hooks` with VM-domain exceptions

  **What to do**:
  - Move generic hooks to `apps/frontend/src/shared/lib/hooks`.
  - Move VM/Proxmox-specific hooks to `apps/frontend/src/features/vm-management/model` or `apps/frontend/src/entities/vm/lib` based on ownership.

  **Must NOT do**:
  - Do not move hooks to pages/widgets.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 8
  - **Blocked By**: 2

  **References**:
  - `apps/frontend/src/hooks/*` - migration source.
  - `apps/frontend/src/pages/vms/hooks/*` - VM-specific ownership cues.
  - `apps/frontend/src/widgets/vm/*` - hook consumers.

  **Acceptance Criteria**:
  - [ ] No imports remain from root `hooks/*`.
  - [ ] `apps/frontend/src/hooks` removed.
  - [ ] Boundary scans pass for moved hooks.

- [x] 7. Migrate `src/services` and `src/data` under strict ownership

  **What to do**:
  - Move transport/API wrappers from `services` to `apps/frontend/src/shared/api/services`.
  - Move domain orchestration from `services` into `entities/*` or `features/*` by bounded context.
  - Move `data` to `apps/frontend/src/shared/config/data` or entity-owned data modules.

  **Must NOT do**:
  - Do not merge unrelated domains into one shared service file.

  **Recommended Agent Profile**:
  - **Category**: `unspecified-high`
  - **Skills**: `frontend-ui-ux`

  **Parallelization**:
  - **Can Run In Parallel**: YES
  - **Parallel Group**: Wave 3
  - **Blocks**: 8
  - **Blocked By**: 2,4

  **References**:
  - `apps/frontend/src/services/*` - source set requiring hybrid split.
  - `apps/frontend/src/data/*` - source constants/data.
  - `apps/frontend/src/services/vmService/proxmoxOps.ts` - concrete transport/API service example.
  - `apps/frontend/src/services/vmOps/runtime.ts` - concrete orchestration/runtime split example.
  - `apps/frontend/src/entities/vm/api/*` - vm domain API placement pattern.
  - `apps/frontend/src/config/*` - existing config source to normalize under shared config.

  **Acceptance Criteria**:
  - [ ] No imports remain from root `services/*` and `data/*`.
  - [ ] `apps/frontend/src/services` and `apps/frontend/src/data` removed.
  - [ ] `pnpm --dir apps/frontend run typecheck` and build pass.

- [x] 8. Final boundary enforcement and regression gates

  **What to do**:
  - Physically remove any remaining empty legacy root folders.
  - Run strict boundary scans and required verification commands.

  **Must NOT do**:
  - Do not accept partial completion with temporary root-level re-export shims.

  **Recommended Agent Profile**:
  - **Category**: `quick`
  - **Skills**: `frontend-ui-ux`, `dev-browser`

  **Parallelization**:
  - **Can Run In Parallel**: NO
  - **Parallel Group**: Sequential final gate
  - **Blocks**: None
  - **Blocked By**: 1,3,4,5,6,7

  **References**:
  - `apps/frontend/src` - final structure verification.
  - `apps/frontend/e2e/fsd-boundaries-migration.spec.ts` - required migration regression spec.

  **Acceptance Criteria**:
  - [ ] `apps/frontend/src/{utils,hooks,types,providers,data,services}` do not exist.
  - [ ] `rg -n "from ['\"][^'\"]*pages/" apps/frontend/src/entities apps/frontend/src/features apps/frontend/src/widgets apps/frontend/src/shared` returns zero matches.
  - [ ] `rg -n "from ['\"][^'\"]*widgets/" apps/frontend/src/entities apps/frontend/src/features` returns zero matches.
  - [ ] `rg -n "from ['\"][^'\"]*features/" apps/frontend/src/entities` returns zero matches.
  - [ ] `pnpm --dir apps/frontend run typecheck` passes.
  - [ ] `pnpm --dir apps/frontend run build` passes.
  - [ ] `pnpm --dir apps/frontend run test:e2e -- e2e/fsd-boundaries-migration.spec.ts` passes.

---

## Commit Strategy

| After Task | Message | Files | Verification |
|------------|---------|-------|--------------|
| 1 | `refactor(frontend): dedupe datacenter status logic` | datacenter + entities status imports | typecheck |
| 3-5 | `refactor(frontend): migrate shared foundations to fsd layers` | utils/types/providers moves | typecheck + build |
| 6-7 | `refactor(frontend): migrate hooks services and data to fsd ownership` | hooks/services/data moves | typecheck + build |
| 8 | `test(frontend): finalize fsd boundary checks and migration gates` | boundary scans + e2e spec updates if needed | typecheck + build + e2e |

---

## Success Criteria

### Verification Commands
```bash
pnpm --dir apps/frontend run typecheck
pnpm --dir apps/frontend run build
pnpm --dir apps/frontend run test:e2e -- e2e/fsd-boundaries-migration.spec.ts
rg -n "from ['\"][^'\"]*(^|/)(utils|hooks|types|providers|data|services)/" apps/frontend/src
rg -n "from ['\"][^'\"]*pages/" apps/frontend/src/entities apps/frontend/src/features apps/frontend/src/widgets apps/frontend/src/shared
rg -n "from ['\"][^'\"]*widgets/" apps/frontend/src/entities apps/frontend/src/features
rg -n "from ['\"][^'\"]*features/" apps/frontend/src/entities
```

### Final Checklist
- [x] Duplicate status logic removed from datacenter helper.
- [x] Legacy root folders removed from `apps/frontend/src`.
- [x] Strict layer direction checks pass.
- [x] Regression checks pass with no behavior drift in migration-focused paths.
