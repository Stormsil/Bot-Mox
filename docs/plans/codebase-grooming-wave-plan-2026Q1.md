# Codebase Grooming Wave Plan (2026Q1)

Status: Active  
Owner: Frontend + Backend Platform  
Last Updated: 2026-02-19

## Objective

Reduce transitional deprecated-shape patterns in frontend/backend code while preserving behavior and contract compatibility.

## Wave A (Frontend Hotspots)

1. `apps/frontend/src/hooks/vm/queue/processor.ts`
- split into `model/queue-processor-core.ts`, `model/queue-processor-scheduler.ts`, `model/queue-processor-metrics.ts`
- acceptance: no single file over 700 lines in queue processor slice.

2. `apps/frontend/src/components/vm/VMQueuePanel.tsx`
- split container/view/actions sections into `widgets` and `features/vm-queue`.
- acceptance: UI-only component has no direct service imports.

3. `apps/frontend/src/pages/vms/VMsPage.tsx`
- move orchestration logic into feature model hooks.
- acceptance: page stays composition-focused.

Acceptance:
1. target files reduced to <= 700 lines at wave completion.
2. each extracted module has clear `model/api/ui` ownership.
3. UI-only files have no transport logic.

Progress snapshot (2026-02-19):
1. `apps/frontend/src/hooks/vm/queue/processor.ts` reduced to 184 lines.
2. `apps/frontend/src/hooks/vm/queue/configurePhase.ts` introduced for phase orchestration.
3. `apps/frontend/src/hooks/vm/queue/configureVmItem.ts` reduced to 230 lines (orchestration-only).
4. `apps/frontend/src/hooks/vm/queue/configureResourcesPhase.ts` introduced for disk/resources apply+verify.
5. `apps/frontend/src/hooks/vm/queue/configureVmFinalization.ts` introduced for verification + registry finalization.
6. `apps/frontend/src/components/vm/VMQueuePanel.tsx` reduced to 375 lines with extracted subcomponents.
7. `apps/frontend/src/pages/vms/VMsPage.tsx` reduced to 481 lines with extracted page modules.
8. Wave A acceptance is met for <=700 and the previous `configureVmItem.ts` warning is closed.

## Wave B (Service/Transport Hotspots)

1. `apps/frontend/src/services/apiClient.ts`
2. `apps/frontend/src/services/vmService.ts`
3. `apps/frontend/src/services/vmOpsService.ts`
4. `apps/frontend/src/utils/scheduleUtils.ts`

Actions:
1. carve domain clients into `entities/*/api` hooks and facades.
2. isolate transport concerns from UI orchestration.
3. preserve API behavior and response envelopes.

Acceptance:
1. no file in this wave above 600 lines.
2. call-sites migrate from broad service clients to domain facades/hooks.

Progress snapshot (2026-02-19):
1. `apps/frontend/src/utils/scheduleUtils.ts` decomposed into modular structure:
- `apps/frontend/src/utils/schedule/types.ts`
- `apps/frontend/src/utils/schedule/core.ts`
- `apps/frontend/src/utils/schedule/date.ts`
- `apps/frontend/src/utils/schedule/launcher.ts`
- `apps/frontend/src/utils/schedule/generation.ts`
- `apps/frontend/src/utils/schedule/migration.ts`
2. `apps/frontend/src/utils/scheduleUtils.ts` converted to compatibility barrel (46 lines) to preserve existing imports.
3. `apps/frontend/src/services/apiClient.ts` reduced from 649 to 375 lines by extracting polling subsystem to `apps/frontend/src/services/apiClient/polling.ts`.
4. `apps/frontend/src/services/vmOpsService.ts` reduced from 626 to 268 lines:
- parsers moved to `apps/frontend/src/services/vmOps/parsers.ts`
- target storage moved to `apps/frontend/src/services/vmOps/targetStorage.ts`
- command dispatch/poll moved to `apps/frontend/src/services/vmOps/commandExecution.ts`
5. `apps/frontend/src/services/vmService.ts` reduced from 672 to 445 lines:
- start/send-key flow moved to `apps/frontend/src/services/vmService/startAndSendKey.ts`
- SSH ops moved to `apps/frontend/src/services/vmService/sshOps.ts`
6. Wave B target set is completed (`apiClient.ts`, `vmService.ts`, `vmOpsService.ts`, `scheduleUtils.ts` all below 600 lines).
7. Additional cleanup beyond Wave B target:
- `apps/frontend/src/services/notesService.ts` reduced from 546 to 475 lines by moving note domain types to `apps/frontend/src/services/notes/types.ts`.

## Wave C (Settings/Theme Hotspots)

1. `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx`
2. `apps/frontend/src/pages/settings/useThemeSettings.ts`

Actions:
1. split settings orchestration into focused hooks.
2. keep AntD token-first styling paths intact.
3. remove mixed responsibility blocks from page layer.

Acceptance:
1. files reduced to <= 550 lines.
2. page-level files remain composition-focused.

Progress snapshot (2026-02-19):
1. `apps/frontend/src/pages/settings/useThemeSettings.ts` reduced from 576 to 543 lines.
2. `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx` reduced from 602 to 539 lines.
3. Supporting modules extracted:
- `apps/frontend/src/pages/settings/themeSettings.types.ts`
- `apps/frontend/src/pages/settings/themeSettings.helpers.ts`
- `apps/frontend/src/pages/settings/ThemeSettingsPanel.types.ts`
- `apps/frontend/src/pages/settings/ThemeQuickCard.tsx`
- `apps/frontend/src/pages/settings/themePanel.helpers.ts`
4. Wave C acceptance target (<=550 for both target files) is met.
5. Additional Wave C follow-up:
- `apps/frontend/src/pages/settings/useThemeSettings.ts` further reduced to 511 lines by extracting:
  - `apps/frontend/src/pages/settings/themePresetActions.ts`
  - `apps/frontend/src/pages/settings/useThemeSettingsSync.ts`
6. Theme foundation split finalized:
- `apps/frontend/src/theme/themePalette.ts` reduced to 273 lines with static definitions moved to `apps/frontend/src/theme/themePalette.definitions.ts`.
7. Settings/theme decomposition continuation:
- `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx` reduced from 539 to 83 lines by extracting sections to `apps/frontend/src/pages/settings/ThemeSettingsSections.tsx` (319 lines).
- `apps/frontend/src/pages/settings/useThemeSettings.ts` reduced from 543 to 491 lines via extraction of:
  - `apps/frontend/src/pages/settings/themePresetActions.ts`
  - `apps/frontend/src/pages/settings/useThemeSettingsSync.ts`
8. Additional layout hotspot reduction:
- `apps/frontend/src/components/layout/ResourceTree.tsx` reduced from 507 to 492 lines (below the 500 fail threshold).
9. VM utility hotspot reduction:
- `apps/frontend/src/utils/vm/generateSmbios.ts` reduced from 615 to 261 lines by extracting:
  - `apps/frontend/src/utils/vm/smbiosPlatformGroups.ts` (293 lines)
  - `apps/frontend/src/utils/vm/smbiosRamDb.ts` (61 lines)
10. VM log hook hotspot reduction:
- `apps/frontend/src/hooks/useVMLog.ts` reduced from 549 to 393 lines by extracting `apps/frontend/src/hooks/vmLogUtils.ts` (130 lines).
11. API contract hotspot decomposition:
- `packages/api-contract/src/contract.ts` reduced from 1824 to 8 lines via modular assembly.
 - Contract routes are now grouped by domain (not by line chunks):
   - `packages/api-contract/src/contractRoutesCore.ts`
   - `packages/api-contract/src/contractRoutesAuth.ts`
   - `packages/api-contract/src/contractRoutesLicense.ts`
   - `packages/api-contract/src/contractRoutesProvisioning.ts`
   - `packages/api-contract/src/contractRoutesBots.ts`
   - `packages/api-contract/src/contractRoutesResources.ts`
   - `packages/api-contract/src/contractRoutesSettingsTheme.ts`
   - `packages/api-contract/src/contractRoutesWorkspace.ts`
   - `packages/api-contract/src/contractRoutesFinance.ts`
   - `packages/api-contract/src/contractRoutesPlaybooks.ts`
   - `packages/api-contract/src/contractRoutesIpqs.ts`
   - `packages/api-contract/src/contractRoutesWowNames.ts`
   - `packages/api-contract/src/contractRoutesAgents.ts`
   - `packages/api-contract/src/contractRoutesVmRegistry.ts`
   - `packages/api-contract/src/contractRoutesSecrets.ts`
   - `packages/api-contract/src/contractRoutesArtifacts.ts`
   - `packages/api-contract/src/contractRoutesInfra.ts`
   - `packages/api-contract/src/contractRoutesVmOps.ts`
 - `packages/api-contract/src/contractDefinitions.ts` composes semantic route modules via spread and preserves the public `apiContract` surface.
12. Schema hotspot decomposition (`schemas.ts`):
- `packages/api-contract/src/schemas.ts` reduced from 1250 to 8 lines (barrel re-export).
- Domain schema modules introduced:
  - `packages/api-contract/src/schemasCommon.ts`
  - `packages/api-contract/src/schemasCore.ts`
  - `packages/api-contract/src/schemasBotsResources.ts`
  - `packages/api-contract/src/schemasWorkspaceFinance.ts`
  - `packages/api-contract/src/schemasPlaybooksSettings.ts`
  - `packages/api-contract/src/schemasAgentsVmOpsArtifacts.ts`
  - `packages/api-contract/src/schemasSecretsInfra.ts`
  - `packages/api-contract/src/schemasLicenseProvisioning.ts`
13. Infra route domain refinement:
- `packages/api-contract/src/contractRoutesInfra.ts` is now a semantic composer over:
  - `packages/api-contract/src/contractRoutesInfraProxmox.ts`
  - `packages/api-contract/src/contractRoutesInfraSsh.ts`

## Wave D (Backend Hotspots)

1. `apps/backend/src/modules/infra/infra.controller.ts`
2. `apps/backend/src/modules/infra/infra.service.ts`
3. `apps/backend/src/modules/vm-ops/vm-ops.controller.ts`

Actions:
1. extract use-case services.
2. isolate transport mapping and domain logic.
3. keep contract/Zod boundaries explicit.

Acceptance:
1. controller methods remain thin.
2. logic paths testable at service layer.

## Wave E (Contract Hotspots)

1. `packages/api-contract/src/contract.ts`
2. `packages/api-contract/src/schemas.ts`

Actions:
1. split by domain contracts and schema groups.
2. maintain existing exports for compatibility.

Acceptance:
1. `contract.ts` and `schemas.ts` replaced with domain-scoped modules.
2. each module <= 500 lines.

## Enforced Budgets

1. Warn threshold: 350 lines.
2. Fail threshold: 500 lines for non-grandfathered files.
3. Grandfathered hotspots are capped to block growth until migration closes.
4. New/modified file over 350 lines requires split-plan note in PR.

## Delivery Rules

1. Each wave ships as small PR slices.
2. Every slice updates relevant docs and passes `check:all:mono`.
3. No behavior changes unless separately specified and tested.
