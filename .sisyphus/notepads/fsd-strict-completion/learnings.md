## 2026-02-28T08:05:30.257Z Task: initialization
- Initialized notepad for plan `fsd-strict-completion`.

## 2026-02-28T08:20:16.440Z Task: plan item 1 status dedupe
- Datacenter `buildProjectStats` now uses canonical `computeBotStatusAt(bot, currentTime)` from `entities/bot/lib/statuses` and no longer keeps a local `computeBotStatus` duplicate.
- Canonical status API already exposes deterministic timestamp injection (`computeBotStatusAt`) and keeps `computeBotStatus(bot)` as runtime-time wrapper, preserving backend-migration TODO context.
- Post-change checks passed: required `rg` searches, LSP diagnostics clean on edited files, and `pnpm --dir apps/frontend run typecheck` success.

## 2026-02-28T08:22:15Z Task 2: exhaustive legacy-root classification map
- Classified 98 files across utils/hooks/types/providers/data/services with deterministic target layers and waves.
- Wave assignment fixed for migration planning: wave 2 (`utils`,`types`,`providers`), wave 3 (`hooks`,`data`,`services`).
- High-fanout/high-risk concentration: `types/index.ts`, `hooks/useVMLog.ts`, `utils/scheduleUtils.ts`, `services/vmService/proxmoxOps.ts`.
- Mapping guardrail validated: no infrastructure file mapped to pages/widgets.

## 2026-02-28T09:02:00Z Task 3: migrate src/utils -> src/shared/lib/utils
- Moved 13 utility modules from `apps/frontend/src/utils/**` into `apps/frontend/src/shared/lib/utils/**` preserving `schedule/*` and `vm/*` sub-structure.
- Rewired 30 frontend consumers from relative `utils/*` imports to `shared/lib/utils/*` equivalents; no behavior or signatures changed.
- Fixed moved-module relative imports to keep module resolution stable after relocation (`schedule/types.ts`, `supabase.ts`, `unattendXml.ts`).
- Verification passed: AST import checks (TS/TSX, including multiline import declarations), LSP diagnostics clean on all changed files, `pnpm --dir apps/frontend run typecheck` success, and legacy directory `apps/frontend/src/utils` removed.

## 2026-02-28T11:41:52+03:00 Task 4: migrate src/types -> src/shared/types
- Moved all 8 modules from `apps/frontend/src/types/*` to `apps/frontend/src/shared/types/*` with filenames preserved and kept `shared/types/index.ts` barrel behavior-equivalent (`export *` surface unchanged).
- Rewired high-fanout consumers exhaustively from legacy root `types` targets to `shared/types` using path-resolution-safe rewrites (107 import/export specifiers across 106 files) without changing type contracts.
- Verification: required `rg` scans (`legacy types` scan empty; `shared/types` scan populated), AST-aware checks for `import type`/re-exports/import-type nodes show `legacy-root-types-hits 0`, `apps/frontend/src/types` removed, and LSP diagnostics clean on directly edited migration files.

## 2026-02-28T11:57:45+03:00 Task 5: split src/providers -> shared/api/providers + app/providers
- Moved all contract/transport provider clients from `apps/frontend/src/providers/**` into `apps/frontend/src/shared/api/providers/**` and moved composition providers (`auth-provider`, `data-provider`, `data-provider/*`) into `apps/frontend/src/app/providers/**` per Task 2 classification.
- Preserved app bootstrap semantics: `App.tsx` still wires providers in the same runtime order (`ThemeRuntimeProvider` -> `QueryProvider` -> `Refine` with `authProvider` and `dataProvider`), with import sources updated to `app/providers`.
- Rewired all frontend consumers to canonical targets (`shared/api/providers` or `app/providers`), with post-move AST checks validating import/re-export declarations and corrected path depth in moved provider internals.
- Verification passed: required `rg` legacy-provider scan returns zero matches, target-path scan returns expected new imports, LSP diagnostics are clean on changed files, and `pnpm --dir apps/frontend run build` succeeds.

## 2026-02-28T12:11:16+03:00 Task 7: migrate src/services + src/data under strict ownership
- Moved mapped transport wrappers from `apps/frontend/src/services/vmService/*` to `apps/frontend/src/shared/api/services/vm/*` and moved orchestration from `apps/frontend/src/services/vmOps/*` to `apps/frontend/src/features/vm-management/model/vmOps/*`, including `startAndSendKey.ts` (still zero direct consumers, preserved as-is).
- Moved all mapped `apps/frontend/src/data/*` modules to `apps/frontend/src/shared/config/data/*` (including `windows-keyboards/*` and `default-unattend-template.xml`) and rewired all affected consumers.
- Corrected post-move relative-depth imports in migrated modules/consumers (`vmOps` runtime references, `proxmox/ssh` wrappers, VM queue modules, unattend data consumers) to keep behavior and contracts unchanged.
- Verification passed: required `rg` scans run before/after, AST checks for import/re-export/dynamic-import legacy `services|data` paths report no matches, `pnpm --dir apps/frontend run typecheck` and `pnpm --dir apps/frontend run build` succeed, and changed-file LSP diagnostics are clean.

## 2026-02-28T12:46:00+03:00 Task 6: migrate src/hooks with VM-domain ownership
- Migrated all legacy root hooks from `apps/frontend/src/hooks/**` into `apps/frontend/src/features/vm-management/model/**` per Task 2 ownership map (no hook required `shared/lib/hooks` or `entities/vm/lib` ownership in this wave).
- Rewired frontend consumers to feature model imports (`widgets/vm/VMList.tsx`, `pages/vms/hooks/useVmsPageViewModel.ts`) and removed legacy `apps/frontend/src/hooks` directory after move.
- Corrected relative-depth imports inside moved VM queue/log hook modules to keep strict FSD direction and module resolution stable from new `features/vm-management/model/**` location.
- Verification passed: required post-move scans and AST checks executed, boundary scans (`pages/widgets/features` direction guards) return zero violations, LSP diagnostics clean on all changed hook files, and `pnpm --dir apps/frontend run typecheck` succeeds.

## 2026-02-28T12:17:40+03:00 Task 8: final boundary enforcement and regression gates
- Removed final empty legacy remnants `apps/frontend/src/providers/data-provider` and `apps/frontend/src/providers`; all six legacy roots (`utils`,`hooks`,`types`,`providers`,`data`,`services`) are now absent under `apps/frontend/src`.
- Final boundary scans passed with zero matches for forbidden `pages` imports in `entities|features|widgets|shared`, forbidden `widgets` imports in `entities|features`, and forbidden `features` imports in `entities`.
- Final verification gates passed unchanged behavior: `pnpm --dir apps/frontend run typecheck`, `pnpm --dir apps/frontend run build`, and `pnpm --dir apps/frontend run test:e2e -- e2e/fsd-boundaries-migration.spec.ts`.

## 2026-02-28T13:00:00+03:00 Task: checklist synchronization
- Synchronized final bookkeeping in `.sisyphus/plans/fsd-strict-completion.md`: Definition of Done items, task headings 1..8, and Final Checklist markers are all set to `[x]` with no prose/content changes.
