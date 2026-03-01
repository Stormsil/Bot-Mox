## 2026-02-28T08:05:30.257Z Task: initialization
- No blockers recorded yet.

## 2026-02-28T08:20:16.440Z Task: plan item 1 status dedupe
- No blockers encountered.
- Note: importing from `../../entities/bot` failed (no barrel export); resolved by importing canonical status helper from `../../entities/bot/lib/statuses`.

## 2026-02-28T08:22:15Z Task 2: inventory risks
- No blockers for classification completeness; all files mapped and no unclassified remainder.
- Main migration risk is fanout-heavy modules (`types/index.ts`, VM log/schedule/proxmox modules) and should be migrated with import rewiring safeguards.
- `services/vmService/startAndSendKey.ts` has zero direct import consumers; verify runtime/indirect usage before cleanup in move waves.

## 2026-02-28T09:02:00Z Task 3: migration notes
- No execution blockers; migration completed.
- Acceptance scan caveat: `rg -n "from ['\"][^'\"]*(^|/)utils/" apps/frontend/src` also matches canonical target paths containing `/shared/lib/utils/`, so post-migration output is non-zero despite no remaining root `src/utils/*` imports.

## 2026-02-28T11:41:52+03:00 Task 4: migration notes
- No blockers for move/rewire itself; `src/types` removal and import rewiring completed with AST-verified zero legacy-root type imports.
- Acceptance gap: `pnpm --dir apps/frontend run typecheck` fails due pre-existing unresolved module paths outside this task scope (notably `src/app/providers/**` and `src/shared/api/providers/**` imports like `../shared/api/apiClient`, plus existing strict-typing warnings). Task-specific `types -> shared/types` rewires resolve, but global typecheck remains red until those unrelated path issues are fixed.

## 2026-02-28T11:57:45+03:00 Task 5: migration notes
- No unresolved blockers after path-depth rewiring; provider split and import migration completed.
- Initial build attempt failed on moved provider internals due stale relative-depth paths (`entities/*`, `config/env`, `observability/uiLogger`, `shared/lib/utils/unattendXml`), then passed after deterministic depth corrections.
- Additional fix applied to `apps/frontend/src/shared/lib/utils/unattendXml.ts` (`default-unattend-template.xml?raw` path) to restore bundle resolution after previous utility relocation; no behavior changes introduced.

## 2026-02-28T12:11:16+03:00 Task 7: migration notes
- No blockers for Task 7 completion; services/data migration and import rewiring completed with passing typecheck/build.
- Required scan caveat persists: `rg -n "from ['\"][^'\"]*(\.\.?/)+(services|data)/|from ['\"](services|data)/" apps/frontend/src` still reports legitimate local imports under `widgets/bot-profile/ui/person/data.ts` (`./data/*`), which are not legacy root `src/data/*` imports.

## 2026-02-28T12:46:00+03:00 Task 6: migration notes
- No remaining blockers; hooks migration completed with deterministic rewires and path-depth corrections in moved VM model modules.
- First typecheck run failed due stale relative import depths in moved hook internals; resolved by rewriting imports to canonical `shared/*` and `entities/*` paths from new feature-model depth.
- Acceptance scan caveat: required regex `rg -n "from ['\"][^'\"]*(\.\.?/)+hooks/|from ['\"]hooks/" apps/frontend/src` still reports `./hooks/useVmsPageViewModel` (page-local folder), which is not a legacy root `src/hooks/*` import.

## 2026-02-28T12:17:40+03:00 Task 8: migration notes
- No blockers; final cleanup and gates completed.
- Regex caveat confirmed on required legacy-shape scan: matches are limited to non-legacy relative `../types` imports in local feature/shared folders (not root `src/types`), while direct bare legacy-root scan `from "(utils|hooks|types|providers|data|services)..."` returns zero.
