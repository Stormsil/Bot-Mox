# Lockfile And Hotspot Baseline (2026-02-19)

Status: Active  
Owner: Platform + DX  
Last Updated: 2026-02-19  
Applies To: Monorepo hygiene hardening wave

## Scope

This baseline captures repository weight before hotspot decomposition waves and after lockfile policy cutover to pnpm-only.

## Lockfile Inventory

Allowed lockfiles in active tree:

1. `pnpm-lock.yaml`

Forbidden lockfiles removed from active tree:

1. `package-lock.json`
2. `apps/frontend/package-lock.json`
3. `apps/agent/package-lock.json`
4. `scripts/package-lock.json`

## Largest Tracked Files (bytes)

1. `pnpm-lock.yaml` - 476157
2. `packages/api-contract/src/contract.ts` - 52942
3. `apps/frontend/src/data/default-unattend-template.xml` - 52090
4. `apps/frontend/src/hooks/vm/queue/processor.ts` - 50800
5. `docs/api/openapi.yaml` - 49261
6. `packages/api-contract/src/schemas.ts` - 40042

## Current Hotspots (lines)

1. `packages/api-contract/src/contract.ts` - 1824
2. `apps/frontend/src/hooks/vm/queue/processor.ts` - 1383
3. `packages/api-contract/src/schemas.ts` - 1250
4. `apps/frontend/src/utils/scheduleUtils.ts` - 904
5. `apps/frontend/src/components/vm/VMQueuePanel.tsx` - 890
6. `apps/frontend/src/services/apiClient.ts` - 750
7. `apps/frontend/src/services/vmService.ts` - 748
8. `apps/frontend/src/services/vmOpsService.ts` - 706
9. `apps/frontend/src/pages/vms/VMsPage.tsx` - 696
10. `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx` - 637
11. `apps/frontend/src/pages/settings/useThemeSettings.ts` - 620

## Generated Artifacts

1. `docs/_generated/repo-map.txt`
2. `docs/_generated/hotspots.csv`
3. `docs/_generated/llm-ingest-exclude.txt`

## Next Actions

1. Execute decomposition Wave A (`processor.ts`, `VMQueuePanel.tsx`, `VMsPage.tsx`).
2. Execute decomposition Wave B (`apiClient.ts`, `vmService.ts`, `vmOpsService.ts`, `scheduleUtils.ts`).
3. Execute decomposition Wave C (`ThemeSettingsPanel.tsx`, `useThemeSettings.ts`).
4. Lower grandfathered caps incrementally until all hotspots are <= 500 lines.
