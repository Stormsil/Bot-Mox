# Repository Architecture + Compatibility Cutover Audit (2026-02-19)

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-19

## Scope

1. Repository structure and active runtime architecture.
2. Module inventory for frontend/backend/agent.
3. Compatibility cutover scan across code, scripts, docs, and DB tooling.
4. Identification of cleanup and hardening priorities.

## Architecture Snapshot

1. Active applications: `apps/frontend`, `apps/backend`, `apps/agent`.
2. Shared packages: `api-contract`, `database-schema`, `shared-types`, `ui-kit`, `utils`.
3. Backend runtime: NestJS modular monolith with `/api/v1/*` prefix.
4. Frontend runtime: React 19 + Refine 5 + AntD 5 + TanStack Query 5.
5. Agent runtime: Electron + TypeScript.

## Module Relationship Map

1. Frontend domain entities call API via contract-aware clients/hooks.
2. Backend modules implement domain APIs and validate boundaries.
3. Database schema and generated types flow from Supabase migrations into `packages/database-schema`.
4. Agent communicates with backend command/heartbeat/pairing APIs and reports results.

## Compatibility Findings Table

| Path | Type | Severity | Finding | Action |
|---|---|---|---|---|
| `docs/plans/*` (historical) | Documentation | Medium | Historical backend/path references | Moved to `docs/history/plans/*` |
| `docs/audits/*` (historical) | Documentation | Medium | Historical migration references | Moved to `docs/history/audits/*` |
| `docs/architecture/agent-ownership-policy.md` | Documentation | Medium | Referenced old backend path | Archived to history and replaced by canonical docs |
| `apps/frontend/test-results/playwright-report.json` | Generated artifact | Low | Contains historical path strings | Kept as generated artifact; excluded from active checks |
| `scripts/check-legacy-naming-cutover.js` | Guardrail script | Medium | Missing one deprecated-path blocking rule | Updated in this hardening wave |

## Key Cleanup Directions

1. Finish reducing frontend hotspot files according to grooming plan.
2. Continue migrating transitional folders toward strict FSD boundaries.
3. Keep docs as canonical source and enforce docs checks in CI.
4. Enforce no deprecated naming in active files through strict guardrails.

## Result

Hardening wave introduced canonical documentation, archive segregation, and stricter naming/boundary enforcement to prevent architecture drift.
