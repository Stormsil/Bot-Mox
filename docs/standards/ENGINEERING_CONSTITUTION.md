# Engineering Constitution

Status: Active
Owner: Platform Architecture
Last Updated: 2026-02-19
Applies To: Full monorepo
Non-goals: Product roadmap decisions
Related Checks: `check:all:mono`, `docs:check`, `check:style:token-usage`, `check:fsd:boundaries`, `check:file-size:budgets`

## MUST Rules

1. Use only approved stack: React 19 + Refine 5 + AntD 5 + Vite 7, NestJS 11, Electron agent.
2. Keep API contract-first: shared DTO/schemas from `@botmox/api-contract`.
3. Validate all system boundaries using Zod.
4. Keep Nest DI and thin controllers: orchestration in services/use-cases.
5. Keep UI deterministic: no direct transport logic in presentation components.
6. Keep styling token-driven: no ad-hoc raw color literals unless explicitly approved and baselined.
7. Keep architecture boundaries enforced by CI checks.
8. Keep documentation synchronized with architecture and workflow changes in the same PR.
9. Treat hotspot growth as an incident: when a file crosses warning threshold, schedule split in the same PR or immediate next PR.
10. Deliver continuously: each completed semantic slice must be shipped as a separate PR, not accumulated into weekly mega-batches.

## MUST NOT Rules

1. Do not introduce alternative frameworks without approved ADR.
2. Do not bypass contract package with duplicated ad-hoc types.
3. Do not reintroduce deprecated naming/runtime in active code or docs.
4. Do not add oversized files without split contract and remediation plan.
5. Do not merge when mandatory checks are red.
6. Do not keep “ready but unmerged” architectural changes locally for long periods.

## Continuous PR Cadence

1. A PR is required after any completed semantic slice:
   1. boundary refactor,
   2. completed feature sub-scope,
   3. completed bugfix slice,
   4. finished migration step.
2. Recommended PR size:
   1. one intent,
   2. reviewable diff,
   3. clear rollback.
3. If a task is large, split into sequenced PR waves with explicit acceptance per wave.

## Exception Policy

Any exception requires:
1. PR justification with explicit scope.
2. Sunset date and removal task.
3. Linked tracking item and owner.

## RU Notes

1. Это основной инженерный закон репозитория.
2. Любое отклонение допускается только как временное и явно зафиксированное.
