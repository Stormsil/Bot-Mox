# Task 5 - AntD Direct Import Catalog (Baseline + Partition)

Scope: `apps/frontend/src/**` excluding `apps/frontend/src/shared/ui/**`.

Baseline category counts (symbol-level, direct `from 'antd'`):
- utility: 54
- visual: 6
- type-only: 41
- total symbol imports: 101

Top visual offenders:
1. `src/App.tsx` - 5 visual imports
2. `src/pages/settings/useSettingsPageViewModel.ts` - 1 visual import

Visual migration mapping (every visual import):

| file | import symbol(s) | category | migration target |
| --- | --- | --- | --- |
| src/App.tsx:4 | Button | visual | AppButton |
| src/App.tsx:4 | ConfigProvider | visual | AppConfigProvider (wrapper plan) |
| src/App.tsx:4 | Spin | visual | AppSpin |
| src/App.tsx:4 | Tag | visual | AppTag |
| src/App.tsx:4 | Typography | visual | AppTypography |
| src/pages/settings/useSettingsPageViewModel.ts:2 | Form | visual | AppForm |

Full categorized inventory:

| file | import symbol(s) | category | migration target |
| --- | --- | --- | --- |
| src/App.tsx | App as AntdApp | utility | allow direct import |
| src/App.tsx | Button, ConfigProvider, Spin, Tag, Typography | visual | AppButton; AppConfigProvider (wrapper plan); AppSpin; AppTag; AppTypography |
| src/entities/bot/api/useBotLifecycleMutations.ts | message | utility | allow direct import |
| src/entities/bot/api/useBotMutations.ts | message | utility | allow direct import |
| src/entities/notes/api/useNoteMutations.ts | message | utility | allow direct import |
| src/entities/settings/api/useSettingsMutations.ts | message | utility | allow direct import |
| src/entities/settings/api/useThemeMutations.ts | message | utility | allow direct import |
| src/entities/vm/api/useVmActionMutations.ts | message | utility | allow direct import |
| src/entities/workspace/api/useWorkspaceMutations.ts | message | utility | allow direct import |
| src/features/bot-account/account/use-account-generation-workflow.ts | message | utility | allow direct import |
| src/features/bot-account/account/use-account-generator-state.ts | message | utility | allow direct import |
| src/features/bot-account/account/use-bot-account-subscription.ts | message | utility | allow direct import |
| src/features/bot-account/BotAccount.tsx | message | utility | allow direct import |
| src/features/vm-management/model/useDeleteVmWorkflow.ts | message | utility | allow direct import |
| src/pages/billing/index.tsx | message | utility | allow direct import |
| src/pages/dashboard/index.tsx | TableColumnsType | type-only | keep type import from antd |
| src/pages/licenses/index.tsx | FormInstance | type-only | keep type import from antd |
| src/pages/licenses/index.tsx | message | utility | allow direct import |
| src/pages/licenses/page/LicenseColumns.tsx | TableColumnsType | type-only | keep type import from antd |
| src/pages/licenses/page/LicenseModals.tsx | FormInstance, FormProps, ModalProps | type-only | keep type import from antd |
| src/pages/licenses/page/modal-helpers.ts | FormInstance | type-only | keep type import from antd |
| src/pages/login/index.tsx | message | utility | allow direct import |
| src/pages/notes/index.tsx | message | utility | allow direct import |
| src/pages/proxies/ProxiesPage.tsx | message | utility | allow direct import |
| src/pages/proxies/ProxyCrudModal.tsx | FormInstance, FormProps, ModalProps | type-only | keep type import from antd |
| src/pages/proxies/ProxyCrudModal.tsx | message | utility | allow direct import |
| src/pages/settings/sections/ApiKeysCard.tsx | FormInstance | type-only | keep type import from antd |
| src/pages/settings/sections/NotificationsCard.tsx | FormInstance | type-only | keep type import from antd |
| src/pages/settings/sections/ProxyAndAlertsCards.tsx | FormInstance | type-only | keep type import from antd |
| src/pages/settings/sections/StoragePolicyCard.tsx | FormInstance | type-only | keep type import from antd |
| src/pages/settings/themePresetActions.ts | message | utility | allow direct import |
| src/pages/settings/useSettingsPageViewModel.ts | FormInstance | type-only | keep type import from antd |
| src/pages/settings/useSettingsPageViewModel.ts | Form | visual | AppForm |
| src/pages/settings/useThemeColorControls.ts | message | utility | allow direct import |
| src/pages/settings/useThemePresetControls.ts | message | utility | allow direct import |
| src/pages/subscriptions/index.tsx | TableProps | type-only | keep type import from antd |
| src/pages/subscriptions/index.tsx | message | utility | allow direct import |
| src/pages/subscriptions/subscription-columns.tsx | TableColumnsType | type-only | keep type import from antd |
| src/pages/vms/hooks/useVmOperationLogActions.ts | message | utility | allow direct import |
| src/pages/vms/hooks/useVmStartAndQueueActions.ts | message | utility | allow direct import |
| src/pages/vms/page/recreateVm.ts | message | utility | allow direct import |
| src/pages/vms/page/templateHardwareSync.ts | message | utility | allow direct import |
| src/pages/workspace/calendar/index.tsx | message | utility | allow direct import |
| src/pages/workspace/calendar/page/CalendarEventModal.tsx | FormInstance | type-only | keep type import from antd |
| src/pages/workspace/kanban/index.tsx | message | utility | allow direct import |
| src/shared/lib/query/queryClient.ts | message | utility | allow direct import |
| src/theme/themeRuntime.tsx | ConfigProviderProps | type-only | keep type import from antd |
| src/theme/themeRuntime.tsx | theme | utility | allow direct import |
| src/widgets/bot-profile/ui/BotCharacterWidget.tsx | message | utility | allow direct import |
| src/widgets/bot-profile/ui/BotLicense.tsx | FormInstance, MenuProps | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/BotLicense.tsx | message | utility | allow direct import |
| src/widgets/bot-profile/ui/BotLifeStagesWidget.tsx | message | utility | allow direct import |
| src/widgets/bot-profile/ui/BotPerson.tsx | message | utility | allow direct import |
| src/widgets/bot-profile/ui/BotProxy.tsx | FormInstance | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/BotProxy.tsx | App, message | utility | allow direct import |
| src/widgets/bot-profile/ui/BotSchedule.tsx | message | utility | allow direct import |
| src/widgets/bot-profile/ui/BotSubscription.tsx | App, message | utility | allow direct import |
| src/widgets/bot-profile/ui/BotSummaryWidget.tsx | message | utility | allow direct import |
| src/widgets/bot-profile/ui/character/CharacterEditForm.tsx | FormInstance | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/license/AssignLicenseModal.tsx | FormInstance | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/license/helpers.ts | MenuProps | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/license/LicenseFormModal.tsx | FormProps, ModalProps | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/license/LicenseViews.tsx | MenuProps | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/person/PersonFormFields.tsx | FormInstance | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/proxy/helpers.tsx | AlertProps | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/proxy/ProxyEditorModal.tsx | FormProps, ModalProps | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/subscription/SubscriptionModal.tsx | FormProps, ModalProps | type-only | keep type import from antd |
| src/widgets/bot-profile/ui/summary/types.ts | AlertProps | type-only | keep type import from antd |
| src/widgets/finance/TransactionForm.tsx | theme | utility | allow direct import |
| src/widgets/layout/ResourceTree.tsx | TreeDataNode | type-only | keep type import from antd |
| src/widgets/layout/resourceTree/tree-utils.tsx | TreeDataNode | type-only | keep type import from antd |
| src/widgets/notes-editor/NoteSidebar.tsx | message | utility | allow direct import |
| src/widgets/schedule/ScheduleGenerator.tsx | message | utility | allow direct import |
| src/widgets/schedule/SessionEditor.tsx | theme | utility | allow direct import |
| src/widgets/subscriptions/SubscriptionForm.tsx | FormProps | type-only | keep type import from antd |
| src/widgets/vm-workspace/ui/useVmTargetStripModel.ts | message | utility | allow direct import |
| src/widgets/vm/settingsForm/PlaybookTab.tsx | message | utility | allow direct import |
| src/widgets/vm/settingsForm/SecretField.tsx | message | utility | allow direct import |
| src/widgets/vm/settingsForm/UnattendTab.tsx | UploadProps | type-only | keep type import from antd |
| src/widgets/vm/settingsForm/UnattendTab.tsx | message | utility | allow direct import |
| src/widgets/vm/useVmListController.ts | message | utility | allow direct import |
| src/widgets/vm/useVMQueuePanelState.ts | UploadProps | type-only | keep type import from antd |
| src/widgets/vm/useVMQueuePanelState.ts | message | utility | allow direct import |
| src/widgets/vm/VMCommandPanel.tsx | message | utility | allow direct import |
| src/widgets/vm/VMOperationLog.tsx | message | utility | allow direct import |
| src/widgets/vm/VMQueueUnattendModal.tsx | UploadProps | type-only | keep type import from antd |
| src/widgets/vm/VMSettingsForm.tsx | message | utility | allow direct import |

Mixed import declarations (category split validated):
- `src/App.tsx:4` -> utility + visual
- `src/pages/proxies/ProxyCrudModal.tsx:2` -> type-only + utility
- `src/theme/themeRuntime.tsx:3` -> type-only + utility
