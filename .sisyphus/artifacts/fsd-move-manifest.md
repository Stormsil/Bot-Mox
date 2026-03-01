# FSD Move Manifest (Task 0)

Behavior lock: this epic is strictly move/rename/import rewiring only. No business logic changes.

| Old Path | New Path | Target Layer | Rename? | Import Consumers | Notes |
| --- | --- | --- | --- | --- | --- |
| `apps/frontend/src/pages/project/utils.ts::computeBotStatus` | `apps/frontend/src/entities/bot/lib/statuses.ts::computeBotStatus` | entities | No | `apps/frontend/src/pages/project/selectors.ts` | Add `// TODO: @backend-migration` above function. |
| `apps/frontend/src/pages/project/utils.ts::computeProxyStatus` | `apps/frontend/src/entities/bot/lib/statuses.ts::computeProxyStatus` | entities | No | `apps/frontend/src/pages/project/selectors.ts` | Keep return contract unchanged. |
| `apps/frontend/src/pages/project/utils.ts::computeSubscriptionStatus` | `apps/frontend/src/entities/bot/lib/statuses.ts::computeSubscriptionStatus` | entities | No | `apps/frontend/src/pages/project/selectors.ts` | Keep status labels/sort unchanged. |
| `apps/frontend/src/pages/project/utils.ts::computeLicenseStatus` | `apps/frontend/src/entities/bot/lib/statuses.ts::computeLicenseStatus` | entities | No | `apps/frontend/src/pages/project/selectors.ts` | Keep days calculations unchanged. |
| `apps/frontend/src/pages/project/types.ts::BotRecord` | `apps/frontend/src/entities/bot/lib/statuses.types.ts::BotRecord` | entities | No | `apps/frontend/src/entities/bot/lib/statuses.ts` | Extract ownership for status helpers. |
| `apps/frontend/src/pages/project/types.ts::ProxyLike` | `apps/frontend/src/entities/bot/lib/statuses.types.ts::ProxyLike` | entities | No | `apps/frontend/src/entities/bot/lib/statuses.ts` | Extract ownership for status helpers. |
| `apps/frontend/src/pages/project/types.ts::ProxyStatus` | `apps/frontend/src/entities/bot/lib/statuses.types.ts::ProxyStatus` | entities | No | `apps/frontend/src/pages/project/types.ts` | Re-export from new owner if needed. |
| `apps/frontend/src/pages/project/types.ts::SubscriptionStatus` | `apps/frontend/src/entities/bot/lib/statuses.types.ts::SubscriptionStatus` | entities | No | `apps/frontend/src/pages/project/types.ts` | Re-export from new owner if needed. |
| `apps/frontend/src/pages/project/types.ts::OFFLINE_THRESHOLD_MS` | `apps/frontend/src/entities/bot/lib/statuses.types.ts::OFFLINE_THRESHOLD_MS` | entities | No | `apps/frontend/src/entities/bot/lib/statuses.ts` | Keep constant value unchanged. |
| `apps/frontend/src/pages/vms/deleteVmRules.ts` | `apps/frontend/src/features/vm-management/lib/deleteVmRules.ts` | features | No | `apps/frontend/src/pages/vms/hooks/*`, `apps/frontend/src/pages/vms/page/*` | Add TODO on `evaluateDeleteBot`. |
| `apps/frontend/src/pages/vms/hooks/deleteVmWorkflowCandidates.ts` | `apps/frontend/src/features/vm-management/lib/deleteVmWorkflowCandidates.ts` | features | No | `apps/frontend/src/pages/vms/hooks/useDeleteVmWorkflow.ts` | Preserve candidate sorting/filtering. |
| `apps/frontend/src/pages/vms/hooks/useDeleteVmWorkflow.ts` | `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts` | features | No | `apps/frontend/src/pages/vms/hooks/useVmsPageViewModel.ts` | Keep modal state API parity. |
| `apps/frontend/src/pages/vms/hooks/deleteVmWorkflow.types.ts` | `apps/frontend/src/features/vm-management/model/deleteVmWorkflow.types.ts` | features | No | `apps/frontend/src/features/vm-management/model/useDeleteVmWorkflow.ts` | Remove page-level dependencies. |
| `apps/frontend/src/pages/vms/DeleteVmModal.tsx` | `apps/frontend/src/features/vm-management/ui/DeleteVmModal.tsx` | features | No | `apps/frontend/src/pages/vms/page/VMPageModals.tsx` | Needed for widgets->pages decoupling task 5.5. |
| `N/A` | `apps/frontend/src/features/vm-management/index.ts` | features | New file | `apps/frontend/src/pages/vms/*`, `apps/frontend/src/widgets/vm-workspace/ui/VMWorkspace.tsx` | Public API export surface for feature. |
| `N/A` | `apps/frontend/src/features/vm-management/lib/index.ts` | features | New file | `apps/frontend/src/features/vm-management/index.ts` | Internal re-export barrel. |
| `N/A` | `apps/frontend/src/features/vm-management/model/index.ts` | features | New file | `apps/frontend/src/features/vm-management/index.ts` | Internal re-export barrel. |
| `apps/frontend/src/components/bot/BotSummary.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotSummaryWidget.tsx` | widgets | Yes | `apps/frontend/src/pages/bot/page/sections.tsx`, `apps/frontend/src/components/bot/index.ts` | Move nested `summary/` with adjusted imports. |
| `apps/frontend/src/components/bot/summary/` | `apps/frontend/src/widgets/bot-profile/ui/summary/` | widgets | No | `BotSummaryWidget.tsx` | Keep helper contracts unchanged. |
| `apps/frontend/src/components/bot/BotCharacter.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotCharacterWidget.tsx` | widgets | Yes | `apps/frontend/src/pages/bot/page/sections.tsx`, `summary/*` | Move nested `character/` too. |
| `apps/frontend/src/components/bot/character/` | `apps/frontend/src/widgets/bot-profile/ui/character/` | widgets | No | `BotCharacterWidget.tsx` | Preserve type exports. |
| `apps/frontend/src/components/bot/BotFinance.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotFinanceWidget.tsx` | widgets | Yes | `apps/frontend/src/components/bot/index.ts` | Keep data/format behavior unchanged. |
| `apps/frontend/src/components/bot/botFinanceData.ts` | `apps/frontend/src/widgets/bot-profile/ui/botFinanceData.ts` | widgets | No | `BotFinanceWidget.tsx` | Pure move. |
| `apps/frontend/src/components/bot/BotLeveling.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotLevelingWidget.tsx` | widgets | Yes | `apps/frontend/src/components/bot/index.ts` | Pure rename/move. |
| `apps/frontend/src/components/bot/BotLogs.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotLogsWidget.tsx` | widgets | Yes | `apps/frontend/src/components/bot/index.ts` | Pure rename/move. |
| `apps/frontend/src/components/bot/BotProfession.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotProfessionWidget.tsx` | widgets | Yes | `apps/frontend/src/pages/bot/page/sections.tsx` | Pure rename/move. |
| `apps/frontend/src/components/bot/BotLifeStages.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotLifeStagesWidget.tsx` | widgets | Yes | `apps/frontend/src/pages/bot/page/sections.tsx` | Move nested `lifeStages/` too. |
| `apps/frontend/src/components/bot/lifeStages/` | `apps/frontend/src/widgets/bot-profile/ui/lifeStages/` | widgets | No | `BotLifeStagesWidget.tsx` | Pure move. |
| `apps/frontend/src/components/bot/BotLicense.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotLicenseWidget.tsx` | widgets | Yes | `apps/frontend/src/components/bot/index.ts` | Task 3.5 residual bot modules. |
| `apps/frontend/src/components/bot/BotPerson.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotPersonWidget.tsx` | widgets | Yes | `apps/frontend/src/components/bot/index.ts` | Task 3.5 residual bot modules. |
| `apps/frontend/src/components/bot/BotProxy.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotProxyWidget.tsx` | widgets | Yes | `apps/frontend/src/components/bot/index.ts` | Task 3.5 residual bot modules. |
| `apps/frontend/src/components/bot/BotSchedule.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotScheduleWidget.tsx` | widgets | Yes | `apps/frontend/src/components/bot/index.ts` | Task 3.5 residual bot modules. |
| `apps/frontend/src/components/bot/BotScheduleActions.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotScheduleActionsWidget.tsx` | widgets | Yes | `BotScheduleWidget.tsx` | Keep event wiring same. |
| `apps/frontend/src/components/bot/BotScheduleContent.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotScheduleContentWidget.tsx` | widgets | Yes | `BotScheduleWidget.tsx` | Keep view behavior same. |
| `apps/frontend/src/components/bot/BotSubscription.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotSubscriptionWidget.tsx` | widgets | Yes | `apps/frontend/src/components/bot/index.ts` | Task 3.5 residual bot modules. |
| `apps/frontend/src/components/bot/BotVMInfo.tsx` | `apps/frontend/src/widgets/bot-profile/ui/BotVMInfoWidget.tsx` | widgets | Yes | `apps/frontend/src/components/bot/index.ts` | Task 3.5 residual bot modules. |
| `apps/frontend/src/components/bot/license/` | `apps/frontend/src/widgets/bot-profile/ui/license/` | widgets | No | `BotLicenseWidget.tsx` | Pure move. |
| `apps/frontend/src/components/bot/person/` | `apps/frontend/src/widgets/bot-profile/ui/person/` | widgets | No | `BotPersonWidget.tsx` | Pure move. |
| `apps/frontend/src/components/bot/proxy/` | `apps/frontend/src/widgets/bot-profile/ui/proxy/` | widgets | No | `BotProxyWidget.tsx` | Pure move. |
| `apps/frontend/src/components/bot/subscription/` | `apps/frontend/src/widgets/bot-profile/ui/subscription/` | widgets | No | `BotSubscriptionWidget.tsx` | Pure move. |
| `apps/frontend/src/components/ui/ErrorBoundary.tsx` | `apps/frontend/src/shared/ui/ErrorBoundary.tsx` | shared | No | multiple pages/features via `components/ui/*` | Task 4 atom migration. |
| `apps/frontend/src/components/ui/LoadingState.tsx` | `apps/frontend/src/shared/ui/LoadingState.tsx` | shared | No | multiple pages/features via `components/ui/*` | Include css module move. |
| `apps/frontend/src/components/ui/LoadingState.module.css` | `apps/frontend/src/shared/ui/LoadingState.module.css` | shared | No | `LoadingState.tsx` | Task 4 atom migration. |
| `apps/frontend/src/components/ui/MetricCard.tsx` | `apps/frontend/src/shared/ui/MetricCard.tsx` | shared | No | `pages/dashboard/index.tsx`, `pages/subscriptions/SubscriptionsStats.tsx`, `pages/licenses/page/LicensesStats.tsx` | Task 4 atom migration. |
| `apps/frontend/src/components/ui/StatusBadge.tsx` | `apps/frontend/src/shared/ui/StatusBadge.tsx` | shared | No | `pages/dashboard/index.tsx`, `pages/project/columns.tsx` | Task 4 atom migration. |
| `apps/frontend/src/components/ui/StatusBadge.module.css` | `apps/frontend/src/shared/ui/StatusBadge.module.css` | shared | No | `StatusBadge.tsx` | Task 4 atom migration. |
| `apps/frontend/src/components/ui/TableActionButton.tsx` | `apps/frontend/src/shared/ui/TableActionButton.tsx` | shared | No | workspace, licenses, project, proxies, settings, features/bot-account | Task 4 atom migration. |
| `apps/frontend/src/components/ui/TableActionButton.module.css` | `apps/frontend/src/shared/ui/TableActionButton.module.css` | shared | No | `TableActionButton.tsx` | Task 4 atom migration. |
| `apps/frontend/src/components/finance/` | `apps/frontend/src/widgets/finance/` | widgets | No | `apps/frontend/src/pages/finance/index.tsx` | Task 5 domain migration. |
| `apps/frontend/src/components/layout/` | `apps/frontend/src/widgets/layout/` | widgets | No | `apps/frontend/src/App.tsx`, `pages/project/index.tsx`, `pages/datacenter/index.tsx`, `pages/bot/ui/BotPagePresenter.tsx` | Task 5 domain migration. |
| `apps/frontend/src/components/notes/` | `apps/frontend/src/widgets/notes-editor/` | widgets | Yes (dir) | `apps/frontend/src/pages/notes/index.tsx` | Canonical notes destination from plan. |
| `apps/frontend/src/components/schedule/` | `apps/frontend/src/widgets/schedule/` | widgets | No | Bot profile consumers | Task 5 domain migration. |
| `apps/frontend/src/components/subscriptions/` | `apps/frontend/src/widgets/subscriptions/` | widgets | No | `apps/frontend/src/pages/subscriptions/index.tsx` | Task 5 domain migration. |
| `apps/frontend/src/components/vm/` | `apps/frontend/src/widgets/vm/` | widgets | No | `widgets/vm-workspace/ui/VMWorkspace.tsx`, `pages/vms/VMListPage.tsx`, `pages/vms/page/VMPageModals.tsx` | Task 5 domain migration. |
| `apps/frontend/src/pages/vms/page/cx.ts` | `apps/frontend/src/widgets/vm-workspace/ui/cx.ts` | widgets | No | `widgets/vm-workspace/ui/VMWorkspace.tsx` | Task 5.5 decoupling. |
| `apps/frontend/src/pages/vms/page/VmTargetStrip.tsx` | `apps/frontend/src/widgets/vm-workspace/ui/VmTargetStrip.tsx` | widgets | No | `widgets/vm-workspace/ui/VMWorkspace.tsx` | Task 5.5 decoupling. |
| `apps/frontend/src/pages/vms/page/VMPageModals.tsx` | `apps/frontend/src/widgets/vm-workspace/ui/VMPageModals.tsx` | widgets | No | `widgets/vm-workspace/ui/VMWorkspace.tsx` | Task 5.5 decoupling. |
| `apps/frontend/src/pages/vms/DeleteVmModal.tsx` | `apps/frontend/src/features/vm-management/ui/DeleteVmModal.tsx` | features | No | `widgets/vm-workspace/ui/VMPageModals.tsx` | Task 5.5 explicit destination. |
| `apps/frontend/src/pages/datacenter/page-helpers.ts` | `DEFERRED` | pages | N/A | N/A | Deferred (out of scope). Keep untouched in this epic. |
