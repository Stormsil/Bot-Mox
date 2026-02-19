# AI Implementation Playbook

Status: Active
Owner: Platform Architecture
Last Updated: 2026-02-19
Applies To: AI-assisted implementation tasks
Non-goals: Product prioritization
Related Checks: `check:all:mono`, `docs:check`, `check:style:token-usage`, `check:fsd:boundaries`

## Mandatory Execution Pattern

1. Start from boundaries and contracts.
2. Split large tasks into modules/layers before coding.
3. Implement minimal coherent slices (not big-bang).
4. Validate after each slice with mandatory checks.
5. Update docs in the same change when architecture/workflow changes.
6. For bugfixes and reliability work, enforce agentic debugging loop (repro -> isolate -> guard -> fix -> verify).

## Forbidden Patterns

1. One-file “god implementation” for complex features.
2. Direct data-access in pure UI layer.
3. Ad-hoc styling detached from token system.
4. Framework drift or custom local architecture not aligned with canonical docs.

## Delivery Contract

Each AI-generated PR must include:
1. Layer split rationale.
2. Contract/schema impact.
3. Check results summary.
4. Follow-up debt (if any) with explicit remediation item.
5. Observability impact note (what is logged/traced and how failures are diagnosed).

## Reliability Guard

1. Any bugfix touching runtime logic must include at least one regression guard:
   - automated test, or
   - strengthened static check/contract check, or
   - documented invariant with executable validation command.
2. If no new guard is added, PR must explicitly justify why and add a dated follow-up item.

## Templates

1. Feature task template: `docs/standards/templates/FEATURE_TASK_TEMPLATE.md`
2. Refactor task template: `docs/standards/templates/REFACTOR_TASK_TEMPLATE.md`
3. Bugfix task template: `docs/standards/templates/BUGFIX_TASK_TEMPLATE.md`

## RU Notes

1. Любая крупная задача сначала декомпозируется по слоям.
2. Нельзя делать быстрые кустарные решения вне архитектуры.
