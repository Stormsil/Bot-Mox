# Architecture Decision Records (ADR Lite)

Status: Active
Owner: Platform Architecture
Last Updated: 2026-02-19
Applies To: Architecture-affecting changes
Non-goals: Feature-level implementation notes
Related Checks: `docs:check`

## When ADR Is Required

Create ADR-lite record when changing:
1. Core technology stack.
2. Cross-layer boundaries.
3. API contract strategy.
4. Persistence/validation strategy.
5. CI enforcement rules.

## ADR-lite Template

1. Context
2. Decision
3. Alternatives considered
4. Consequences
5. Rollback strategy
6. Sunset/review date (if temporary)

## Storage Convention

1. Place ADR files under `docs/standards/adr/`.
2. Filename format: `ADR-YYYYMMDD-short-title.md`.
3. Update related canonical docs in the same PR.

## RU Notes

1. ADR нужен для всех значимых архитектурных решений, чтобы не было хаотичных изменений.
