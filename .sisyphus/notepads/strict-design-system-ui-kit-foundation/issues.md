## Task 8 - Interactive wrappers
- Required ripgrep command uses `--glob "*App(Button|Input|Select|Switch)*.tsx"`; in ripgrep glob semantics this pattern behaves like a literal and may return zero matches despite valid wrapper files.

## Task 9 - CSS hardcode cleanup (hotspots)
- `lsp_diagnostics` for CSS modules is currently blocked in this environment (`biome` command missing), so verification had to rely on direct command gates.
- `node scripts/check-style-token-usage.js` fails on many non-hotspot files; this gate is not yet a clean repository-wide signal for incremental hotspot waves.

## Task 9 - CSS hardcode cleanup (final)
- No remaining Task 9 gate blockers after wave continuation; both required commands now pass.

## Task 10 - TSX inline cleanup
- Repository-wide inline-style grep gates still report many matches outside Task 10 hotspots; completion signals must be interpreted per scoped file set for this wave.
- CSS `lsp_diagnostics` remains unavailable in this environment due to missing `biome` binary in PATH.

## Task 11 - AntD import migration (attempt)
- Regex-based bulk rewrite corrupted multiline/mixed import declarations in business-layer TSX files; migration had to be rolled back to preserve compile safety.
- Required verification chain (`lint && typecheck`) is currently blocked by pre-existing lint issues in unrelated frontend CSS/format files.

## Task 11 - AntD import migration (completion wave)
- Repository lint gate still fails because of unrelated pre-existing frontend files (`App.tsx`, `AppShell.module.css`, `shared/ui/LoadingState.module.css`, `styles/global.css`, `theme/themePalette.definitions.ts`, and empty-block warnings in `pages/settings/SettingsPage.module.css`).
- Migration itself is now stable; remaining business-layer `antd` imports are constrained to allowlisted non-visual runtime utilities and type-only imports.

## Task 11 - Final gate status
- Previous lint blockers are resolved; no remaining Task 11 gate blockers.

## Task 12 - Domain styling bridge for WoW colors
- Required scoped HEX grep command includes the newly created palette source file and unrelated bot-profile modules, so raw output is noisy and cannot be used as a zero-match gate for WoW-only migration.

## Task 12 - strict acceptance follow-up
- No unresolved blockers remain after migrating residual bot-profile TS/TSX hex literals; acceptance grep now cleanly isolates expected domain palette literals.
