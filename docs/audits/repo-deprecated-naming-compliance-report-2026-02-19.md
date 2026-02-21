# Repository Compatibility Compliance Report (2026-02-19)

Status: Active  
Owner: Platform Architecture  
Last Updated: 2026-02-19

## Compliance Controls

1. Deprecated naming scan (`check:deprecated:naming`) with active-file scope.
2. Docs checks (`docs:deprecated:check`, `docs:links:check`, `docs:lint`).
3. Architecture boundary checks (`check:ui:boundaries`, `check:entities:service-boundary`, `check:vm:provider-boundary`).

## Allowed Historical Zones

1. `docs/history/**`
2. Guardrail script internals where deprecated-name regex patterns are defined.

## Disallowed Active Zones

1. Active docs (`docs/**` excluding `docs/history/**`).
2. Active apps (`apps/frontend`, `apps/backend`, `apps/agent`).
3. Active package code/config/scripts.

## Verification Outcome

1. Active architecture is aligned to `frontend/backend/agent` naming.
2. Historical references are archived or explicitly excluded as generated artifacts.
3. CI now includes docs and naming checks as mandatory quality gates.

## Residual Risk

1. Transitional frontend folders still exist and require gradual grooming.
2. Large hotspot files remain and must be reduced by wave plan.

## Next Actions

1. Execute `docs/plans/codebase-grooming-wave-plan-2026Q1.md`.
2. Track file-size budget trend weekly.
3. Keep canonical docs synchronized with every architecture-affecting PR.

