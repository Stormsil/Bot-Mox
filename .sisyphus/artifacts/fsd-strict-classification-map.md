# FSD Strict Classification Map (Task 2)

- Generated at (UTC): 2026-02-28T08:22:15Z
- Scope roots: `utils`, `hooks`, `types`, `providers`, `data`, `services`
- Rule source: `.sisyphus/plans/fsd-strict-completion.md` deterministic classification section
- Method: exhaustive root file list + regex import scans + AST import checks for multiline coverage

## Validation Snapshot

- Static import scan run: `rg -n "from [\"\'][^\"\']*(utils|hooks|types|providers|data|services)/" apps/frontend/src`
- Dynamic import scan run: `rg -n "import\\(" apps/frontend/src`
- AST-assisted import checks run: `import($SOURCE)` and `import { $$$IMPORTS } from $SOURCE` in TypeScript/TSX
- Files classified: **98**
- Unclassified files: **0**
- Invalid target paths to `pages/*`/`widgets/*`: **0**

## Root Totals

| root | file_count | summed_consumer_count | primary_wave |
|---|---:|---:|---:|
| `utils` | 13 | 45 | 2 |
| `hooks` | 25 | 51 | 3 |
| `types` | 8 | 124 | 2 |
| `providers` | 31 | 54 | 2 |
| `data` | 12 | 16 | 3 |
| `services` | 9 | 19 | 3 |

## High-Fanout Modules

| source_path | consumer_count | risk_level | proposed_target |
|---|---:|---|---|
| `apps/frontend/src/types/index.ts` | 109 | `high` | `apps/frontend/src/shared/types/index.ts` |
| `apps/frontend/src/hooks/useVMLog.ts` | 10 | `high` | `apps/frontend/src/features/vm-management/model/useVMLog.ts` |
| `apps/frontend/src/utils/scheduleUtils.ts` | 10 | `high` | `apps/frontend/src/shared/lib/utils/scheduleUtils.ts` |
| `apps/frontend/src/hooks/vm/queue/utils.ts` | 8 | `high` | `apps/frontend/src/features/vm-management/model/vm/queue/utils.ts` |
| `apps/frontend/src/services/vmService/proxmoxOps.ts` | 8 | `high` | `apps/frontend/src/shared/api/services/vm/proxmoxOps.ts` |
| `apps/frontend/src/utils/accountGenerators.ts` | 8 | `high` | `apps/frontend/src/shared/lib/utils/accountGenerators.ts` |
| `apps/frontend/src/types/core.ts` | 7 | `high` | `apps/frontend/src/shared/types/core.ts` |
| `apps/frontend/src/providers/bot-contract-client.ts` | 6 | `high` | `apps/frontend/src/shared/api/providers/bot-contract-client.ts` |
| `apps/frontend/src/utils/proxyUtils.ts` | 6 | `high` | `apps/frontend/src/shared/lib/utils/proxyUtils.ts` |
| `apps/frontend/src/utils/schedule/types.ts` | 5 | `medium` | `apps/frontend/src/shared/lib/utils/schedule/types.ts` |
| `apps/frontend/src/data/windows-keyboards/types.ts` | 4 | `medium` | `apps/frontend/src/shared/config/data/windows-keyboards/types.ts` |
| `apps/frontend/src/hooks/vm/queue/phaseTypes.ts` | 4 | `medium` | `apps/frontend/src/features/vm-management/model/vm/queue/phaseTypes.ts` |
| `apps/frontend/src/providers/unattend-profile-client/types.ts` | 4 | `medium` | `apps/frontend/src/shared/api/providers/unattend-profile-client/types.ts` |
| `apps/frontend/src/services/vmOps/runtime.ts` | 4 | `high` | `apps/frontend/src/features/vm-management/model/vmOps/runtime.ts` |
| `apps/frontend/src/utils/schedule/core.ts` | 4 | `medium` | `apps/frontend/src/shared/lib/utils/schedule/core.ts` |

## High-Risk Modules

| source_path | consumer_count | wave | owner_reason |
|---|---:|---:|---|
| `apps/frontend/src/types/index.ts` | 109 | 2 | Global DTO/type contract is cross-domain and should be centralized in shared types. |
| `apps/frontend/src/hooks/useVMLog.ts` | 10 | 3 | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. |
| `apps/frontend/src/utils/scheduleUtils.ts` | 10 | 2 | Utility logic is domain-agnostic helper and belongs to shared reusable library. |
| `apps/frontend/src/hooks/vm/queue/utils.ts` | 8 | 3 | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. |
| `apps/frontend/src/services/vmService/proxmoxOps.ts` | 8 | 3 | VM service module is transport/API wrapper and maps to shared API services. |
| `apps/frontend/src/utils/accountGenerators.ts` | 8 | 2 | Utility logic is domain-agnostic helper and belongs to shared reusable library. |
| `apps/frontend/src/types/core.ts` | 7 | 2 | Global DTO/type contract is cross-domain and should be centralized in shared types. |
| `apps/frontend/src/providers/bot-contract-client.ts` | 6 | 2 | Contract/API provider is transport boundary code and belongs to shared API provider layer. |
| `apps/frontend/src/utils/proxyUtils.ts` | 6 | 2 | Utility logic is domain-agnostic helper and belongs to shared reusable library. |
| `apps/frontend/src/services/vmOps/runtime.ts` | 4 | 3 | VM ops runtime module orchestrates feature use-cases and belongs to vm-management feature model. |
| `apps/frontend/src/providers/auth-provider.ts` | 1 | 2 | Provider composes app bootstrap/runtime wiring and belongs to app layer composition root. |
| `apps/frontend/src/providers/data-provider.ts` | 1 | 2 | Provider composes app bootstrap/runtime wiring and belongs to app layer composition root. |

## Exhaustive Classification Table

| source_path | target_path | target_layer | owner_reason | consumer_count | risk_level | wave |
|---|---|---|---|---:|---|---:|
| `apps/frontend/src/data/default-playbook.ts` | `apps/frontend/src/shared/config/data/default-playbook.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/default-unattend-template.xml` | `apps/frontend/src/shared/config/data/default-unattend-template.xml` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/windows-bloatware.ts` | `apps/frontend/src/shared/config/data/windows-bloatware.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/windows-geolocations.ts` | `apps/frontend/src/shared/config/data/windows-geolocations.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/windows-keyboards.ts` | `apps/frontend/src/shared/config/data/windows-keyboards.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/windows-keyboards/groups-part1.ts` | `apps/frontend/src/shared/config/data/windows-keyboards/groups-part1.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/windows-keyboards/groups-part2.ts` | `apps/frontend/src/shared/config/data/windows-keyboards/groups-part2.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/windows-keyboards/groups-part3.ts` | `apps/frontend/src/shared/config/data/windows-keyboards/groups-part3.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/windows-keyboards/types.ts` | `apps/frontend/src/shared/config/data/windows-keyboards/types.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 4 | `medium` | 3 |
| `apps/frontend/src/data/windows-languages.ts` | `apps/frontend/src/shared/config/data/windows-languages.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/windows-timezones.ts` | `apps/frontend/src/shared/config/data/windows-timezones.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 1 | `low` | 3 |
| `apps/frontend/src/data/windows-visual-effects.ts` | `apps/frontend/src/shared/config/data/windows-visual-effects.ts` | `shared` | Static configuration/data constants are infra configuration assets shared across consumers. | 2 | `medium` | 3 |
| `apps/frontend/src/hooks/useProxmox.ts` | `apps/frontend/src/features/vm-management/model/useProxmox.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 2 | `medium` | 3 |
| `apps/frontend/src/hooks/useVMKeyboardShortcuts.ts` | `apps/frontend/src/features/vm-management/model/useVMKeyboardShortcuts.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/useVMLog.ts` | `apps/frontend/src/features/vm-management/model/useVMLog.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 10 | `high` | 3 |
| `apps/frontend/src/hooks/useVMQueue.ts` | `apps/frontend/src/features/vm-management/model/useVMQueue.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/clonePhase.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/clonePhase.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/configurePhase.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/configurePhase.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/configureResourcesPhase.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/configureResourcesPhase.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/configureVmFinalization.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/configureVmFinalization.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/configureVmItem.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/configureVmItem.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/constants.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/constants.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 3 | `medium` | 3 |
| `apps/frontend/src/hooks/vm/queue/deletePhase.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/deletePhase.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/hardwareFingerprint.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/hardwareFingerprint.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/phaseTypes.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/phaseTypes.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 4 | `medium` | 3 |
| `apps/frontend/src/hooks/vm/queue/processor.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/processor.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/provisioningPhase.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/provisioningPhase.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/queueUiState.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/queueUiState.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/storageAssignments.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/storageAssignments.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/storageHeuristics.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/storageHeuristics.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 2 | `medium` | 3 |
| `apps/frontend/src/hooks/vm/queue/templateResources.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/templateResources.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vm/queue/types.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/types.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 2 | `medium` | 3 |
| `apps/frontend/src/hooks/vm/queue/utils.ts` | `apps/frontend/src/features/vm-management/model/vm/queue/utils.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 8 | `high` | 3 |
| `apps/frontend/src/hooks/vm/useVMQueue.ts` | `apps/frontend/src/features/vm-management/model/vm/useVMQueue.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vmLogUtils.ts` | `apps/frontend/src/features/vm-management/model/vmLogUtils.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 3 | `medium` | 3 |
| `apps/frontend/src/hooks/vmLogWriters.ts` | `apps/frontend/src/features/vm-management/model/vmLogWriters.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/hooks/vmTaskHistoryPersistence.ts` | `apps/frontend/src/features/vm-management/model/vmTaskHistoryPersistence.ts` | `features` | Hook orchestrates VM user-flow/use-case behavior, so ownership belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/providers/auth-provider.ts` | `apps/frontend/src/app/providers/auth-provider.ts` | `app` | Provider composes app bootstrap/runtime wiring and belongs to app layer composition root. | 1 | `high` | 2 |
| `apps/frontend/src/providers/bot-contract-client.ts` | `apps/frontend/src/shared/api/providers/bot-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 6 | `high` | 2 |
| `apps/frontend/src/providers/bot-contract-client/crud.ts` | `apps/frontend/src/shared/api/providers/bot-contract-client/crud.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/bot-contract-client/lifecycle.ts` | `apps/frontend/src/shared/api/providers/bot-contract-client/lifecycle.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/bot-contract-client/runtime.ts` | `apps/frontend/src/shared/api/providers/bot-contract-client/runtime.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 2 | `medium` | 2 |
| `apps/frontend/src/providers/bot-contract-client/types.ts` | `apps/frontend/src/shared/api/providers/bot-contract-client/types.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 3 | `medium` | 2 |
| `apps/frontend/src/providers/data-provider.ts` | `apps/frontend/src/app/providers/data-provider.ts` | `app` | Provider composes app bootstrap/runtime wiring and belongs to app layer composition root. | 1 | `high` | 2 |
| `apps/frontend/src/providers/data-provider/httpFallback.ts` | `apps/frontend/src/app/providers/data-provider/httpFallback.ts` | `app` | Provider composes app bootstrap/runtime wiring and belongs to app layer composition root. | 1 | `low` | 2 |
| `apps/frontend/src/providers/data-provider/utils.ts` | `apps/frontend/src/app/providers/data-provider/utils.ts` | `app` | Provider composes app bootstrap/runtime wiring and belongs to app layer composition root. | 1 | `low` | 2 |
| `apps/frontend/src/providers/finance-contract-client.ts` | `apps/frontend/src/shared/api/providers/finance-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 3 | `medium` | 2 |
| `apps/frontend/src/providers/ipqs-contract-client.ts` | `apps/frontend/src/shared/api/providers/ipqs-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/playbook-contract-client.ts` | `apps/frontend/src/shared/api/providers/playbook-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/resource-contract-client.ts` | `apps/frontend/src/shared/api/providers/resource-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 3 | `medium` | 2 |
| `apps/frontend/src/providers/settings-contract-client.ts` | `apps/frontend/src/shared/api/providers/settings-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/theme-assets-contract-client.ts` | `apps/frontend/src/shared/api/providers/theme-assets-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 2 | `medium` | 2 |
| `apps/frontend/src/providers/unattend-profile-client.ts` | `apps/frontend/src/shared/api/providers/unattend-profile-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/unattend-profile-client/api.ts` | `apps/frontend/src/shared/api/providers/unattend-profile-client/api.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/unattend-profile-client/defaults.ts` | `apps/frontend/src/shared/api/providers/unattend-profile-client/defaults.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 2 | `medium` | 2 |
| `apps/frontend/src/providers/unattend-profile-client/migration.ts` | `apps/frontend/src/shared/api/providers/unattend-profile-client/migration.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/unattend-profile-client/types.ts` | `apps/frontend/src/shared/api/providers/unattend-profile-client/types.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 4 | `medium` | 2 |
| `apps/frontend/src/providers/vm-hardware-fingerprint-client.ts` | `apps/frontend/src/shared/api/providers/vm-hardware-fingerprint-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/vm-ops-events-client.ts` | `apps/frontend/src/shared/api/providers/vm-ops-events-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 2 | `medium` | 2 |
| `apps/frontend/src/providers/vm-read-client.ts` | `apps/frontend/src/shared/api/providers/vm-read-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/vm-read-client/core.ts` | `apps/frontend/src/shared/api/providers/vm-read-client/core.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 2 | `medium` | 2 |
| `apps/frontend/src/providers/vm-read-client/startAndSendKey.ts` | `apps/frontend/src/shared/api/providers/vm-read-client/startAndSendKey.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/vm-read-client/types.ts` | `apps/frontend/src/shared/api/providers/vm-read-client/types.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 3 | `medium` | 2 |
| `apps/frontend/src/providers/vm-secrets-client.ts` | `apps/frontend/src/shared/api/providers/vm-secrets-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/vm-settings-client.ts` | `apps/frontend/src/shared/api/providers/vm-settings-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/providers/vmops-contract-client.ts` | `apps/frontend/src/shared/api/providers/vmops-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 2 | `medium` | 2 |
| `apps/frontend/src/providers/workspace-contract-client.ts` | `apps/frontend/src/shared/api/providers/workspace-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 2 | `medium` | 2 |
| `apps/frontend/src/providers/wow-names-contract-client.ts` | `apps/frontend/src/shared/api/providers/wow-names-contract-client.ts` | `shared` | Contract/API provider is transport boundary code and belongs to shared API provider layer. | 1 | `low` | 2 |
| `apps/frontend/src/services/vmOps/commandExecution.ts` | `apps/frontend/src/features/vm-management/model/vmOps/commandExecution.ts` | `features` | VM ops runtime module orchestrates feature use-cases and belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/services/vmOps/parsers.ts` | `apps/frontend/src/features/vm-management/model/vmOps/parsers.ts` | `features` | VM ops runtime module orchestrates feature use-cases and belongs to vm-management feature model. | 2 | `medium` | 3 |
| `apps/frontend/src/services/vmOps/runtime.ts` | `apps/frontend/src/features/vm-management/model/vmOps/runtime.ts` | `features` | VM ops runtime module orchestrates feature use-cases and belongs to vm-management feature model. | 4 | `high` | 3 |
| `apps/frontend/src/services/vmOps/targetStorage.ts` | `apps/frontend/src/features/vm-management/model/vmOps/targetStorage.ts` | `features` | VM ops runtime module orchestrates feature use-cases and belongs to vm-management feature model. | 1 | `low` | 3 |
| `apps/frontend/src/services/vmService/proxmoxOps.ts` | `apps/frontend/src/shared/api/services/vm/proxmoxOps.ts` | `shared` | VM service module is transport/API wrapper and maps to shared API services. | 8 | `high` | 3 |
| `apps/frontend/src/services/vmService/proxmoxUtils.ts` | `apps/frontend/src/shared/api/services/vm/proxmoxUtils.ts` | `shared` | VM service module is transport/API wrapper and maps to shared API services. | 1 | `low` | 3 |
| `apps/frontend/src/services/vmService/resourceRegistry.ts` | `apps/frontend/src/shared/api/services/vm/resourceRegistry.ts` | `shared` | VM service module is transport/API wrapper and maps to shared API services. | 1 | `low` | 3 |
| `apps/frontend/src/services/vmService/sshOps.ts` | `apps/frontend/src/shared/api/services/vm/sshOps.ts` | `shared` | VM service module is transport/API wrapper and maps to shared API services. | 1 | `low` | 3 |
| `apps/frontend/src/services/vmService/startAndSendKey.ts` | `apps/frontend/src/shared/api/services/vm/startAndSendKey.ts` | `shared` | VM service module is transport/API wrapper and maps to shared API services. | 0 | `low` | 3 |
| `apps/frontend/src/types/appSettings.ts` | `apps/frontend/src/shared/types/appSettings.ts` | `shared` | Global DTO/type contract is cross-domain and should be centralized in shared types. | 1 | `low` | 2 |
| `apps/frontend/src/types/botLifecycle.ts` | `apps/frontend/src/shared/types/botLifecycle.ts` | `shared` | Global DTO/type contract is cross-domain and should be centralized in shared types. | 2 | `medium` | 2 |
| `apps/frontend/src/types/core.ts` | `apps/frontend/src/shared/types/core.ts` | `shared` | Global DTO/type contract is cross-domain and should be centralized in shared types. | 7 | `high` | 2 |
| `apps/frontend/src/types/finance.ts` | `apps/frontend/src/shared/types/finance.ts` | `shared` | Global DTO/type contract is cross-domain and should be centralized in shared types. | 1 | `low` | 2 |
| `apps/frontend/src/types/index.ts` | `apps/frontend/src/shared/types/index.ts` | `shared` | Global DTO/type contract is cross-domain and should be centralized in shared types. | 109 | `high` | 2 |
| `apps/frontend/src/types/resources.ts` | `apps/frontend/src/shared/types/resources.ts` | `shared` | Global DTO/type contract is cross-domain and should be centralized in shared types. | 1 | `low` | 2 |
| `apps/frontend/src/types/secrets.ts` | `apps/frontend/src/shared/types/secrets.ts` | `shared` | Global DTO/type contract is cross-domain and should be centralized in shared types. | 2 | `medium` | 2 |
| `apps/frontend/src/types/vm.ts` | `apps/frontend/src/shared/types/vm.ts` | `shared` | Global DTO/type contract is cross-domain and should be centralized in shared types. | 1 | `low` | 2 |
| `apps/frontend/src/utils/accountGenerators.ts` | `apps/frontend/src/shared/lib/utils/accountGenerators.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 8 | `high` | 2 |
| `apps/frontend/src/utils/proxyUtils.ts` | `apps/frontend/src/shared/lib/utils/proxyUtils.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 6 | `high` | 2 |
| `apps/frontend/src/utils/schedule/core.ts` | `apps/frontend/src/shared/lib/utils/schedule/core.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 4 | `medium` | 2 |
| `apps/frontend/src/utils/schedule/date.ts` | `apps/frontend/src/shared/lib/utils/schedule/date.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 2 | `medium` | 2 |
| `apps/frontend/src/utils/schedule/generation.ts` | `apps/frontend/src/shared/lib/utils/schedule/generation.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 1 | `low` | 2 |
| `apps/frontend/src/utils/schedule/launcher.ts` | `apps/frontend/src/shared/lib/utils/schedule/launcher.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 1 | `low` | 2 |
| `apps/frontend/src/utils/schedule/migration.ts` | `apps/frontend/src/shared/lib/utils/schedule/migration.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 1 | `low` | 2 |
| `apps/frontend/src/utils/schedule/types.ts` | `apps/frontend/src/shared/lib/utils/schedule/types.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 5 | `medium` | 2 |
| `apps/frontend/src/utils/scheduleUtils.ts` | `apps/frontend/src/shared/lib/utils/scheduleUtils.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 10 | `high` | 2 |
| `apps/frontend/src/utils/supabase.ts` | `apps/frontend/src/shared/api/supabase.ts` | `shared` | Supabase client bootstrap is infra API utility reused by auth/data boundaries. | 1 | `low` | 2 |
| `apps/frontend/src/utils/unattendXml.ts` | `apps/frontend/src/shared/lib/utils/unattendXml.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 4 | `medium` | 2 |
| `apps/frontend/src/utils/vm/index.ts` | `apps/frontend/src/shared/lib/utils/vm/index.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 1 | `low` | 2 |
| `apps/frontend/src/utils/vm/patcher.ts` | `apps/frontend/src/shared/lib/utils/vm/patcher.ts` | `shared` | Utility logic is domain-agnostic helper and belongs to shared reusable library. | 1 | `low` | 2 |

## Deterministic Rule Application

- `app`: only root composition providers (`auth-provider`, `data-provider`, plus `data-provider/*`).
- `shared`: domain-agnostic utilities/types/config and API transport providers/services.
- `features`: VM action orchestration hooks and VM ops runtime orchestration modules.
- `entities`: not selected for this source set after deterministic split.
- Guardrail check passed: no mapped target under `pages/*` or `widgets/*`.

## Completion Check

- Every file under six roots classified: **YES (98/98)**
- Unclassified files remain: **NO (0)**
- Classification map ready to unblock migration Tasks 3-7 (waves 2/3).
