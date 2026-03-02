# Task 11 - Business-Layer AntD Import Migration to `shared/ui` (Final)

## Outcome
- Task 11 is complete.
- Direct visual component imports from `antd` were migrated out of business-layer TSX modules (`pages/widgets/features/entities`).
- Remaining `from 'antd'` imports are allowlisted non-visual/runtime (`message`, `theme`, `App`) or type-only imports.

## Lint blocker remediation
- Fixed exact previously blocking files:
  - `apps/frontend/src/pages/settings/SettingsPage.module.css` (removed empty blocks)
  - `apps/frontend/src/App.tsx` (formatted)
  - `apps/frontend/src/AppShell.module.css` (formatted)
  - `apps/frontend/src/shared/ui/LoadingState.module.css` (formatted)
  - `apps/frontend/src/styles/global.css` (formatted)
  - `apps/frontend/src/theme/themePalette.definitions.ts` (formatted)

## Final required verification
- `pnpm exec rg "from ['\"]antd['\"]" apps/frontend/src/pages apps/frontend/src/widgets apps/frontend/src/features apps/frontend/src/entities --glob "*.tsx"`
  - Pass (allowlisted/type-only results only).
- `pnpm --filter @botmox/frontend lint && pnpm --filter @botmox/frontend typecheck`
  - Pass.

## Notes
- Migration was performed via parser-safe AST rewrites (no regex bulk import rewriting).
- Shared alias exports in `apps/frontend/src/shared/ui/index.ts` preserve behavior while removing direct visual imports.
