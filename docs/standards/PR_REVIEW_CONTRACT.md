# PR Review Contract

Status: Active
Owner: Platform Architecture
Last Updated: 2026-02-19
Applies To: All pull requests
Non-goals: Team management rules
Related Checks: `check:all:mono`, `docs:check`

## Mandatory PR Sections

1. Scope and intent.
2. Architecture impact.
3. Documentation impact.
4. Risks and rollback.
5. Validation evidence (commands + outputs summary).
6. Documentation delta note (what was updated and why).

## Deterministic Checklist

1. Contract/schema changes handled in shared packages.
2. Layer boundaries preserved (frontend and backend).
3. Styling remains token/system aligned.
4. File-size budgets not regressed.
5. Active docs updated with owner/status/date.
6. No deprecated naming introduced in active files.
7. Docs change policy is satisfied for architecture/workflow impacting changes.
8. Hotspot policy respected for touched files (split completed or explicitly scheduled next).
9. PR is a single semantic slice (no mixed unrelated payload).

## PR Cadence Policy

1. Merge-ready work must be proposed as PR immediately after slice completion.
2. Long-running local branches without incremental PRs are non-compliant.
3. Large initiatives must be split into sequential PR waves with explicit wave goals.

## Merge Blockers

1. Any mandatory gate red.
2. Missing architecture/docs impact section.
3. Missing rollback notes for risky changes.

## RU Notes

1. PR без этих секций считается неполным.
2. Проверка должна быть воспроизводимой по командам.
