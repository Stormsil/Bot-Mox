# Code Quality Constitution

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-19  
Applies To: Full monorepo  
Non-goals: Team process policy beyond engineering quality  
Related Checks: `check:all:mono`, `docs:check`, `check:no-any:mono`

## Constitution Rules (Must)

1. Monorepo tooling: `pnpm` + `turbo` only.
2. Type safety: strict TypeScript, no new `any` in guarded scopes.
3. Contract-first APIs: backend/frontend/agent align through `@botmox/api-contract`.
4. Validation: Zod on all system boundaries.
5. UI quality: AntD-token-first + CSS Modules, no style hacks.
6. Architecture boundaries are enforced by automated checks.
7. Active docs are canonical source of truth; historical docs are archive-only.
8. Legacy naming is forbidden outside approved archive zones.
9. Lockfile policy is pnpm-only (`pnpm-lock.yaml` in active tree).
10. Observability is mandatory for operational flows: structured logs + trace/correlation context.
11. Debuggability is a quality requirement: every non-trivial failure path must be diagnosable from logs/metrics.
12. Bugfixes must include regression protection (test, contract check, or documented invariant check).

## File Size Policy

Budgets (soft/hard):
1. Warn at 350 lines.
2. Fail at 500 lines.
3. Temporary grandfathered hotspots are capped to block growth until decomposition waves are done.

For exceptions, an explicit split plan must be added in the same PR.
Any new/modified file over 350 lines must include a split plan reference in PR metadata.

## Documentation Policy

1. Canonical docs are English.
2. RU notes may be added in dedicated subsections.
3. Architecture/workflow changes require doc updates in same PR.
4. `docs/history/**` contains deprecated/historical materials only.
5. Documentation is updated continuously per merged slice; deferred bulk updates are prohibited.
6. Large changes must update workflow + architecture docs in the same PR.

## PR Cadence Policy

1. Prefer small semantic PRs over weekly mega-PRs.
2. After a meaningful completed slice with green checks, open PR immediately.
3. “Meaningful slice” requires:
   - clear bounded scope,
   - passing mandatory checks,
   - explicit impact statement.
4. If a slice introduces temporary debt, the next PR must reduce or remove it.

## Exception Protocol

Any rule exception requires:
1. Explicit justification in PR.
2. Time-bounded remediation plan.
3. Linked tracking item.
