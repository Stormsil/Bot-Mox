# Engineering Hygiene Baseline

Status: Active
Owner: Platform Architecture
Last Updated: 2026-02-19
Applies To: Full monorepo

## Snapshot

1. Active markdown docs (non-history): 28
2. CSS Modules scanned: 67
3. Raw color literal occurrences in CSS Modules: 149

## FSD Distribution (frontend)

- app: 1
- pages: 69
- widgets: 0
- features: 1
- entities: 65
- shared: 1
- components: 144
- services: 28
- hooks: 11
- utils: 11
- providers: 17

## Frontend Top Files By Size

| File | Lines |
|---|---:|
| `apps/frontend/src/hooks/vm/queue/processor.ts` | 1383 |
| `apps/frontend/src/utils/scheduleUtils.ts` | 904 |
| `apps/frontend/src/components/vm/VMQueuePanel.tsx` | 890 |
| `apps/frontend/src/services/apiClient.ts` | 750 |
| `apps/frontend/src/services/vmService.ts` | 748 |
| `apps/frontend/src/services/vmOpsService.ts` | 706 |
| `apps/frontend/src/pages/vms/VMsPage.tsx` | 696 |
| `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx` | 637 |
| `apps/frontend/src/services/notesService.ts` | 628 |
| `apps/frontend/src/pages/settings/useThemeSettings.ts` | 620 |
| `apps/frontend/src/utils/vm/generateSmbios.ts` | 615 |
| `apps/frontend/src/hooks/useVMLog.ts` | 549 |
| `apps/frontend/src/components/layout/ResourceTree.tsx` | 507 |
| `apps/frontend/src/pages/settings/SettingsSections.tsx` | 484 |
| `apps/frontend/src/components/bot/lifeStages/StagePanels.tsx` | 453 |

## Backend Top Files By Size

| File | Lines |
|---|---:|
| `apps/backend/src/modules/infra/infra.controller.ts` | 485 |
| `apps/backend/src/modules/infra/infra.service.ts` | 365 |
| `apps/backend/src/modules/bots/bots.service.ts` | 340 |
| `apps/backend/src/modules/vm-ops/vm-ops.controller.ts` | 324 |
| `apps/backend/src/modules/bots/bots.controller.ts` | 297 |
| `apps/backend/src/modules/infra-gateway/infra-gateway.service.ts` | 295 |
| `apps/backend/src/modules/vm-ops/vm-ops.service.ts` | 283 |
| `apps/backend/src/modules/artifacts/artifacts.service.ts` | 249 |
| `apps/backend/src/modules/provisioning/provisioning.controller.ts` | 242 |
| `apps/backend/src/modules/provisioning/provisioning.service.ts` | 239 |
| `apps/backend/src/modules/finance/finance.service.ts` | 210 |
| `apps/backend/src/modules/playbooks/playbooks.controller.ts` | 207 |
| `apps/backend/src/modules/secrets/secrets.service.ts` | 194 |
| `apps/backend/src/modules/resources/resources.controller.ts` | 189 |
| `apps/backend/src/modules/workspace/workspace.controller.ts` | 187 |

## CSS Raw Literal Hotspots

| File | Raw Color Literals |
|---|---:|
| `apps/frontend/src/components/schedule/TimelineVisualizer.module.css` | 34 |
| `apps/frontend/src/pages/datacenter/DatacenterPage.module.css` | 21 |
| `apps/frontend/src/components/schedule/DayTabs.module.css` | 14 |
| `apps/frontend/src/pages/subscriptions/SubscriptionsPage.module.css` | 10 |
| `apps/frontend/src/components/schedule/ScheduleGenerator.module.css` | 7 |
| `apps/frontend/src/components/schedule/WeekOverview.module.css` | 7 |
| `apps/frontend/src/components/finance/GoldPriceChart.module.css` | 6 |
| `apps/frontend/src/pages/login/LoginPage.module.css` | 5 |
| `apps/frontend/src/components/bot/BotSchedule.module.css` | 4 |
| `apps/frontend/src/pages/project/ProjectPage.module.css` | 4 |
| `apps/frontend/src/pages/proxies/ProxiesPage.module.css` | 4 |
| `apps/frontend/src/components/bot/BotSummary.module.css` | 3 |
| `apps/frontend/src/pages/licenses/LicensesPage.module.css` | 3 |
| `apps/frontend/src/components/bot/account/account.module.css` | 2 |
| `apps/frontend/src/components/bot/lifeStages/lifeStages.module.css` | 2 |

## Notes

1. This is a baseline snapshot for enforcing non-regression gates.
2. Use grooming waves to reduce hotspot sizes and raw color literals.
