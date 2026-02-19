# Frontend Refactor Audit (Evergreen)

Last updated (UTC): **2026-02-19T03:27:57Z**
Owner: Frontend/Platform
Source roadmap: `docs/plans/frontend-refactor-roadmap.md`
Platform migration audit: `docs/audits/enterprise-migration-2026-audit.md`

## Objective

Track refactor progress with measurable checkpoints, so we always know:
1. what is implemented,
2. what is in progress,
3. what is blocked,
4. what is still not started.

## Status Legend

- `TODO`: not started
- `WIP`: in progress
- `GREEN`: implemented and verified
- `BLOCKED`: waiting for dependency/decision

## Green Definition

A task can be marked `GREEN` only if all items are true:
1. Code is merged.
2. Relevant checks are green.
3. Manual QA for impacted pages is done.
4. Audit doc is updated with evidence.

## Baseline Snapshot (Before Refactor)

Date: 2026-02-16

1. CSS files in frontend (`bot-mox/src/**/*.css`): **66**
2. TSX files in frontend (`bot-mox/src/**/*.tsx`): **151**
3. `!important` count in frontend: **242**
4. CSS import statements in frontend: **70**
5. CSS var usage count (`--boxmox/--proxmox/--font/--text/--spacing/--radius`): **1772**
6. Global ant overrides present in `bot-mox/src/styles/global.css`: **YES**

## Current Snapshot (After This Batch)

Date: 2026-02-18

1. `!important` count in frontend: **0**
2. Global `.ant-*` selectors in `bot-mox/src/styles/global.css`: **NO**
3. Theme runtime provider introduced and wired into app shell: **YES**
4. Theme visual background API + UI + shell layers: **YES**
5. Theme typography + shape (radius) persisted + applied: **YES**
6. VM domain components migrated to CSS Modules: **20** (`VMQueuePanel`, `VMOperationLog`, `VMSettingsForm`, `ProxmoxTab`, `ProjectResourcesSection`, `UnattendTab`, `PlaybookTab`, `ProxmoxSection`, `SshSection`, `ServiceUrlsSection`, `SecretField`, `SettingsActions`, `VMList`, `VMStatusBar`, `VMConfigPreview`, `VMServicesPanel`, `VMCommandPanel`, `VMListPage`, `VMsPage`, `VMServicePage`)
7. Remaining `.ant-*` selectors in CSS Modules: **0** (across **0** files)
8. Finance operations/stats/history network path migrated to typed contract runtime client: **YES**
9. Bot lifecycle network path migrated to typed contract runtime client: **YES**
10. Playbooks network path migrated to typed contract runtime client: **YES**
11. WoW names network path migrated to typed contract runtime client: **YES**
12. IPQS backend network path migrated to typed contract runtime client: **YES**
13. Settings backend (`api_keys/proxy/notifications/events`) network path migrated to typed contract runtime client: **YES**

## Target KPIs

1. `!important` count < 60 for first stabilization, < 20 final.
2. Zero broad global `.ant-*` overrides in shared global styles.
3. 100% of pages receive theme updates consistently via provider/tokens.
4. Background image mode can be enabled/disabled without UI breakage.
5. No regressions in light/dark readability on core workflows.

## Phase Board

## Phase 0 — Guardrails and Baseline

- [x] `GREEN` Add style debt guard checks (new global `.ant-*`, new `!important`).
- [x] `GREEN` Capture page-level visual baseline screenshots.
- [x] `GREEN` Create roadmap and evergreen audit docs.

Evidence:
1. `docs/plans/frontend-refactor-roadmap.md`
2. `docs/audits/frontend-refactor-audit.md`
3. `scripts/check-style-guardrails.js`
4. `package.json` (`check:styles:guardrails`, `check:all`)
5. `bot-mox/e2e/capture-baseline.mjs`
6. `docs/audits/artifacts/frontend-baseline-2026-02-17/*.png` (light/dark for `/`, `/finance`, `/settings`, `/notes`, `/workspace/calendar`, `/workspace/kanban`, `/licenses`, `/proxies`, `/subscriptions`, `/vms`)

## Phase 1 — Theme Core Consolidation

- [x] `GREEN` Introduce unified ThemeProvider for app-wide state.
- [x] `GREEN` Centralize token mapping for `ConfigProvider`.
- [x] `GREEN` Keep compatibility bridge for legacy CSS vars.
- [x] `GREEN` Add typography + shape (radius) settings to theme runtime and settings persistence.
- [x] `GREEN` Validate theme propagation on all pages.

Evidence:
1. `bot-mox/src/theme/themeRuntime.tsx`
2. `bot-mox/src/App.tsx`
3. `bot-mox/src/theme/themePalette.ts`
4. `bot-mox/src/services/themeService.ts`
5. `bot-mox/src/pages/settings/useThemeSettings.ts`
6. `bot-mox/src/pages/settings/ThemeSettingsPanel.tsx`
7. `proxy-server/src/contracts/schemas.js`
8. `docs/audits/artifacts/frontend-baseline-2026-02-17/theme-propagation-report.json` (`panel` and `text` token values switch consistently between light/dark on all key routes)

## Phase 2 — De-globalize Ant Overrides

- [x] `GREEN` Strip broad `.ant-*` component skinning from `global.css`.
- [x] `GREEN` Move base visuals to antd `token/components` config.
- [x] `GREEN` Re-scope unavoidable exceptions locally.

Evidence:
1. `bot-mox/src/styles/global.css`
2. `bot-mox/src/theme/themeRuntime.tsx`
3. `bot-mox/src/components/layout/Sidebar.tsx` (menu visuals via tokens + label wrappers; no `.ant-*` CSS)
4. `bot-mox/src/components/layout/Sidebar.module.css` (no `.ant-*` overrides)
5. `bot-mox/src/components/layout/Header.tsx` (theme switch visuals via props; no `.ant-*` CSS)
6. `bot-mox/src/components/layout/Header.module.css` (no `.ant-*` overrides)
7. `bot-mox/src/pages/settings/SettingsPage.module.css` (no `.ant-*` overrides; token-first)
8. `bot-mox/src/pages/finance/FinancePage.module.css` (no `.ant-*` overrides; token-first)
9. `bot-mox/src/pages/vms/VMsPage.module.css` (no `.ant-*` overrides; token-first)
10. `bot-mox/src/pages/vms/DeleteVmModal.tsx` (Modal/Popover styles via props; no mask/root overrides)
11. `bot-mox/src/pages/vms/page/VMPageModals.tsx` (Modal styles via props)
12. `bot-mox/src/components/vm/VMQueuePanel.module.css` (no `.ant-*` overrides; token-first)
13. `bot-mox/src/components/vm/VMList.module.css` (no `.ant-*` overrides)
14. `bot-mox/src/components/vm/settingsForm/ProxmoxTab.module.css` (no `.ant-*` overrides)
15. `bot-mox/src/components/vm/settingsForm/ProjectResourcesSection.module.css` (no `.ant-*` overrides)
16. `bot-mox/src/pages/proxies/ProxiesPage.module.css` (no `.ant-*` overrides)
17. `bot-mox/src/pages/proxies/proxyColumns.tsx` (cell layouts via local classes; no `.ant-*` CSS)
18. `bot-mox/src/components/bot/account/account.module.css` (no `.ant-*` overrides)
19. `bot-mox/src/components/bot/account/state-sections.tsx` (Alert/Card visuals via props; no `.ant-*` CSS)
20. `bot-mox/src/components/bot/account/modals.tsx` (Modal visuals via props; no `.ant-*` CSS)
21. `bot-mox/src/components/bot/character/character.module.css` (no `.ant-*` overrides)
22. `bot-mox/src/components/bot/BotCharacter.tsx` (Card header + incomplete indicator via local markup)
23. `bot-mox/src/components/bot/character/CharacterEditForm.tsx` (Alert visuals via props; responsive cols)
24. `bot-mox/src/components/subscriptions/SubscriptionForm.module.css` (no `.ant-*` overrides)
25. `bot-mox/src/components/subscriptions/SubscriptionForm.tsx` (Select option content via local markup; no `.ant-*` CSS)
26. `bot-mox/src/components/ui/TableActionButton.module.css` (no `.ant-*` overrides)
27. `bot-mox/src/components/schedule/SessionEditor.tsx` (Modal visuals via tokens/props; no `.ant-*` CSS)
28. `bot-mox/src/components/finance/TransactionForm.tsx` (Modal + form visuals via tokens/props; no `.ant-*` CSS)
29. `bot-mox/src/components/ui/LoadingState.module.css` (removed local Skeleton `.ant-*` overrides; token-first defaults)
30. `bot-mox/src/pages/dashboard/index.tsx` + `bot-mox/src/pages/dashboard/Dashboard.module.css` (Card/Table styles via component props + local classes; removed `.ant-*`/`!important`)
31. `bot-mox/src/pages/subscriptions/index.tsx` + `bot-mox/src/pages/subscriptions/subscription-columns.tsx` + `bot-mox/src/pages/subscriptions/SubscriptionsPage.module.css` + `bot-mox/src/pages/subscriptions/ExpiringSubscriptionsAlert.tsx` + `bot-mox/src/pages/subscriptions/SubscriptionsStats.tsx` (removed page-level `.ant-*` overrides; table/alert/typography styling moved to props + local classes)
32. `bot-mox/src/components/bot/license/license.module.css` + `bot-mox/src/components/bot/license/LicenseViews.tsx` + `bot-mox/src/components/bot/license/LicenseFormModal.tsx` + `bot-mox/src/components/bot/license/AssignLicenseModal.tsx` (removed all local `.ant-*` overrides from license domain; card/modal theming moved to component `styles`/local classes)
33. `bot-mox/src/components/bot/BotFinance.module.css` + `bot-mox/src/components/bot/BotFinance.tsx` (removed all local `.ant-*` overrides from bot finance module; Statistic/Table/Card styling moved to component props + local classes)
34. `bot-mox/src/components/notes/NotesComponents.module.css` + `bot-mox/src/components/notes/NoteEditor.tsx` + `bot-mox/src/components/notes/NoteSidebar.tsx` + `bot-mox/src/components/notes/CheckboxBlock.tsx` (removed all `.ant-*` selectors from notes styling; editor mode/sidebar/checkbox styling moved to local classes and component props)
35. `bot-mox/src/components/bot/person/person.module.css` + `bot-mox/src/components/bot/BotPerson.tsx` + `bot-mox/src/components/bot/person/PersonCardStates.tsx` + `bot-mox/src/components/bot/person/PersonFormFields.tsx` (removed all `.ant-*` selectors from person module; card/alert/input/select styling moved to local classes + component props)
36. `bot-mox/src/components/bot/BotSummary.module.css` + `bot-mox/src/components/bot/summary/sections-overview.tsx` + `bot-mox/src/components/bot/summary/sections-details.tsx` (removed all `.ant-*` selectors from bot summary module; Card/Tag styles moved to component props; dead unused summary CSS blocks removed)
37. `bot-mox/src/pages/datacenter/DatacenterPage.module.css` + `bot-mox/src/pages/datacenter/content-map-sections.tsx` + `bot-mox/src/pages/datacenter/content-map-sections-secondary.tsx` (removed all `.ant-*` selectors from datacenter page styles; deleted unused legacy datacenter block; map-card body spacing moved to `Card.styles`)
38. `bot-mox/src/components/bot/BotSchedule.module.css` + `bot-mox/src/components/bot/BotSchedule.tsx` (removed all `.ant-*` selectors from bot schedule module; card header/button/alert visuals moved to component `styles` + local classes)
39. `bot-mox/src/components/bot/lifeStages/lifeStages.module.css` + `bot-mox/src/components/bot/BotLifeStages.tsx` + `bot-mox/src/components/bot/lifeStages/StagePanels.tsx` + `bot-mox/src/components/bot/lifeStages/StageTimeline.tsx` (removed all `.ant-*` selectors from life stages module; Card/Statistic/Timeline/button styling moved to component props + local classes; responsive width hack replaced by responsive `Col` props)
40. `bot-mox/src/pages/project/ProjectPage.module.css` + `bot-mox/src/pages/project/index.tsx` + `bot-mox/src/pages/project/columns.tsx` (removed all `.ant-*` selectors from project page; table header/body styling moved to column/table classes, filter controls moved to local classes, status tags styled via explicit class)
41. `bot-mox/src/pages/licenses/LicensesPage.module.css` + `bot-mox/src/pages/licenses/index.tsx` + `bot-mox/src/pages/licenses/page/LicenseColumns.tsx` (removed all `.ant-*` selectors from licenses page; table styles moved to column/table classes, filter/header/tag styles moved to local classes)
42. `bot-mox/src/components/finance/FinanceTransactions.module.css` + `bot-mox/src/components/finance/FinanceTransactions.tsx` (removed all `.ant-*` selectors from finance transactions module; table header/body styling moved to column/table classes, card body spacing moved to `Card.styles`, filter controls moved to local classes)
43. `bot-mox/src/components/bot/proxy/proxy.module.css` + `bot-mox/src/components/bot/proxy/ProxyDetailsCard.tsx` + `bot-mox/src/components/bot/proxy/ProxyEmptyCard.tsx` + `bot-mox/src/components/bot/proxy/ProxyEditorModal.tsx` (removed all `.ant-*` selectors from bot proxy module; Card/Modal header visuals moved to component `styles`, dead/unused proxy CSS overrides removed)
44. `bot-mox/src/components/bot/subscription/subscription.module.css` + `bot-mox/src/components/bot/BotSubscription.tsx` + `bot-mox/src/components/bot/subscription/SubscriptionAlerts.tsx` (removed all `.ant-*` selectors from bot subscription module; Card body/header and list item visuals moved to `Card.styles` + local classes; dead subscription help CSS removed)
45. `bot-mox/src/pages/workspace/calendar/WorkspaceCalendarPage.module.css` + `bot-mox/src/pages/workspace/calendar/index.tsx` + `bot-mox/src/pages/workspace/calendar/page/CalendarMainPanel.tsx` + `bot-mox/src/pages/workspace/calendar/page/CalendarEventList.tsx` (removed all `.ant-*` selectors from workspace calendar page; calendar month cells moved to local `fullCellRender`, Card/list/divider visuals moved to component props + local classes)
46. `bot-mox/src/components/bot/BotLeveling.module.css` + `bot-mox/src/components/bot/BotLeveling.tsx` (removed all `.ant-*` selectors from bot leveling module; Statistic title/content and Card header/body visuals moved to local classes + component props)
47. `bot-mox/src/components/finance/FinanceSummary.module.css` + `bot-mox/src/components/finance/FinanceSummary.tsx` + `bot-mox/src/components/finance/ProjectPerformanceTable.tsx` (removed all `.ant-*` selectors from finance summary module; metric/table visuals moved to local classes + component props)
48. `bot-mox/src/components/bot/BotFarm.module.css` + `bot-mox/src/components/bot/BotFarm.tsx` (removed all `.ant-*` selectors from bot farm module; Statistic title/content and Inventory Card header/body visuals moved to local classes + component props)
49. `bot-mox/src/components/schedule/ScheduleGenerator.module.css` + `bot-mox/src/components/schedule/ScheduleGenerator.tsx` (removed all `.ant-*` selectors from schedule generator module; Form/List/Button visuals moved to local classes + component props; removed local `!important` overrides)
50. `bot-mox/src/components/schedule/SessionList.module.css` + `bot-mox/src/components/schedule/SessionList.tsx` (removed all `.ant-*` selectors from session list module; switch/button visuals moved to component props + local classes)
51. `bot-mox/src/components/schedule/WeekOverview.module.css` (removed unused `week-overview-actions` block and all local `.ant-*` overrides)
52. `bot-mox/src/components/finance/UniversalChart.module.css` + `bot-mox/src/components/finance/UniversalChart.tsx` (removed local `.ant-*` overrides from chart card extra button; moved to local class on the settings button)
53. `bot-mox/src/pages/notes/NotesPage.module.css` (removed local `.ant-empty-description` override; empty-state color moved to local description wrapper class)
54. `bot-mox/src/pages/bot/BotPage.module.css` + `bot-mox/src/pages/bot/page/sections.tsx` (removed all `.ant-collapse*` selectors from bot page styles; collapse panel visuals moved to item-level `styles` + local item classes)
55. `bot-mox/src/components/bot/BotProfession.module.css` + `bot-mox/src/components/bot/BotProfession.tsx` (removed all `.ant-*` selectors from bot profession module; Card header/body and typography visuals moved to local classes + `Card.styles`)
56. `bot-mox/src/components/ui/MetricCard.module.css` + `bot-mox/src/components/ui/MetricCard.tsx` (removed all `.ant-*` selectors and local `!important` overrides; Card/Progress visuals moved to component props)
57. `bot-mox/src/pages/workspace/kanban/WorkspaceKanbanPage.module.css` + `bot-mox/src/pages/workspace/kanban/index.tsx` (removed all `.ant-*` selectors and local `!important` overrides; card body/title icon visuals moved to component props + local wrappers)
58. `bot-mox/src/components/bot/BotLogs.module.css` + `bot-mox/src/components/bot/BotLogs.tsx` + `bot-mox/src/components/bot/BotVMInfo.module.css` + `bot-mox/src/components/bot/BotVMInfo.tsx` (removed all `.ant-*` selectors from bot logs/vm-info modules; Card header/title visuals moved to component props + local classes)
59. `bot-mox/src/components/notes/NotesComponents.module.css` (removed remaining local `!important` overrides in notes module)
60. `bot-mox/src/pages/datacenter/DatacenterPage.module.css` (removed local `!important` overrides in content map title/toggle styles)
61. `bot-mox/src/components/finance/FinanceCommon.module.css` + `bot-mox/src/components/vm/VMOperationLog.module.css` + `bot-mox/src/components/vm/settingsForm/UnattendTab.module.css` + `bot-mox/src/pages/vms/VMsPage.module.css` (removed remaining local `!important` overrides in VM/Finance shared styles)
62. `bot-mox/src/components/bot/BotFinance.tsx` + `bot-mox/src/components/bot/lifeStages/StagePanels.tsx` + `bot-mox/src/components/bot/person/PersonCardStates.tsx` + `bot-mox/src/pages/subscriptions/ExpiringSubscriptionsAlert.tsx` (fixed antd API compatibility after refactor: replaced unsupported `Statistic.titleStyle`/`Alert.styles` usage with supported props/markup)

## Phase 3 — CSS Modules Migration (Domain by Domain)

- [x] `GREEN` Layout domain migration.
- [x] `GREEN` VM domain migration.
- [x] `GREEN` Resources domain migration.
- [x] `GREEN` Workspace domain migration.
- [x] `GREEN` Bot + Finance domain migration.

Evidence (Layout):
1. `bot-mox/src/components/layout/Header.tsx`
2. `bot-mox/src/components/layout/Header.module.css`
3. `bot-mox/src/components/layout/Sidebar.tsx`
4. `bot-mox/src/components/layout/Sidebar.module.css`
5. `bot-mox/src/components/layout/ContentPanel.tsx`
6. `bot-mox/src/components/layout/ContentPanel.module.css`
7. `bot-mox/src/components/layout/ResourceTree.tsx`
8. `bot-mox/src/components/layout/ResourceTree.module.css`
9. `bot-mox/src/components/layout/resourceTree/parts.tsx`
10. `bot-mox/src/pages/login/index.tsx`
11. `bot-mox/src/pages/login/LoginPage.module.css`
12. `bot-mox/src/pages/settings/SettingsPage.tsx`
13. `bot-mox/src/pages/settings/SettingsPage.module.css`
14. `bot-mox/src/pages/settings/SettingsSections.tsx`
15. `bot-mox/src/pages/settings/ThemeSettingsPanel.tsx`
16. `bot-mox/src/pages/dashboard/index.tsx`
17. `bot-mox/src/pages/dashboard/Dashboard.module.css`
18. `bot-mox/src/pages/datacenter/index.tsx`
19. `bot-mox/src/pages/datacenter/DatacenterPage.module.css`
20. `bot-mox/src/pages/datacenter/content-map.tsx`
21. `bot-mox/src/pages/datacenter/content-map-sections.tsx`
22. `bot-mox/src/pages/datacenter/content-map-sections-secondary.tsx`

Evidence (VM):
1. `bot-mox/src/pages/vms/VMsPage.tsx`
2. `bot-mox/src/pages/vms/VMsPage.module.css`
3. `bot-mox/src/pages/vms/page/VMPageModals.tsx`
4. `bot-mox/src/pages/vms/DeleteVmModal.tsx`
5. `bot-mox/src/components/vm/VMQueuePanel.tsx`
6. `bot-mox/src/components/vm/VMQueuePanel.module.css`
7. `bot-mox/src/components/vm/VMOperationLog.tsx`
8. `bot-mox/src/components/vm/VMOperationLog.module.css`
9. `bot-mox/src/components/vm/VMSettingsForm.tsx`
10. `bot-mox/src/components/vm/VMSettingsForm.module.css`
11. `bot-mox/src/components/vm/settingsForm/ProxmoxTab.tsx`
12. `bot-mox/src/components/vm/settingsForm/ProxmoxTab.module.css`
13. `bot-mox/src/components/vm/settingsForm/ProjectResourcesSection.tsx`
14. `bot-mox/src/components/vm/settingsForm/ProjectResourcesSection.module.css`
15. `bot-mox/src/components/vm/settingsForm/UnattendTab.tsx`
16. `bot-mox/src/components/vm/settingsForm/UnattendTab.module.css`
17. `bot-mox/src/components/vm/settingsForm/PlaybookTab.tsx`
18. `bot-mox/src/components/vm/settingsForm/PlaybookTab.module.css`
19. `bot-mox/src/components/vm/settingsForm/SettingsSectionLayout.module.css`
20. `bot-mox/src/components/vm/settingsForm/ProxmoxSection.tsx`
21. `bot-mox/src/components/vm/settingsForm/SshSection.tsx`
22. `bot-mox/src/components/vm/settingsForm/ServiceUrlsSection.tsx`
23. `bot-mox/src/components/vm/settingsForm/SecretField.tsx`
24. `bot-mox/src/components/vm/settingsForm/SettingsActions.tsx`
25. `bot-mox/src/components/vm/VMList.tsx`
26. `bot-mox/src/components/vm/VMList.module.css`
27. `bot-mox/src/components/vm/VMStatusBar.tsx`
28. `bot-mox/src/components/vm/VMStatusBar.module.css`
29. `bot-mox/src/components/vm/VMConfigPreview.tsx`
30. `bot-mox/src/components/vm/VMConfigPreview.module.css`
31. `bot-mox/src/components/vm/VMServicesPanel.tsx`
32. `bot-mox/src/components/vm/VMServicesPanel.module.css`
33. `bot-mox/src/components/vm/VMCommandPanel.tsx`
34. `bot-mox/src/components/vm/VMCommandPanel.module.css`
35. `bot-mox/src/pages/vms/VMListPage.tsx`
36. `bot-mox/src/pages/vms/VMListPage.module.css`
37. `bot-mox/src/pages/vms/VMServicePage.tsx`
38. `bot-mox/src/pages/vms/VMServicePage.module.css`

Evidence (Bot + Finance + Project):
1. `bot-mox/src/pages/bot/index.tsx`
2. `bot-mox/src/pages/bot/BotPage.module.css`
3. `bot-mox/src/pages/bot/page/sections.tsx`
4. `bot-mox/src/pages/bot/page/states.tsx`
5. `bot-mox/src/pages/finance/index.tsx`
6. `bot-mox/src/pages/finance/FinancePage.module.css`
7. `bot-mox/src/pages/project/index.tsx`
8. `bot-mox/src/pages/project/columns.tsx`
9. `bot-mox/src/pages/project/ProjectPage.module.css`
10. `bot-mox/src/components/bot/BotSchedule.tsx`
11. `bot-mox/src/components/bot/BotSchedule.module.css`
12. `bot-mox/src/components/bot/BotSummary.tsx`
13. `bot-mox/src/components/bot/BotSummary.module.css`
14. `bot-mox/src/components/bot/summary/sections-overview.tsx`
15. `bot-mox/src/components/bot/summary/sections-details.tsx`
16. `bot-mox/src/components/bot/summary/stat-item.tsx`
17. `bot-mox/src/components/bot/BotVMInfo.tsx`
18. `bot-mox/src/components/bot/BotVMInfo.module.css`
19. `bot-mox/src/components/bot/BotLogs.tsx`
20. `bot-mox/src/components/bot/BotLogs.module.css`
21. `bot-mox/src/components/bot/BotFinance.tsx`
22. `bot-mox/src/components/bot/BotFinance.module.css`
23. `bot-mox/src/components/bot/BotProxy.tsx`
24. `bot-mox/src/components/bot/proxy/proxy.module.css`
25. `bot-mox/src/components/bot/proxy/ProxyDetailsCard.tsx`
26. `bot-mox/src/components/bot/proxy/ProxyEditorModal.tsx`
27. `bot-mox/src/components/bot/proxy/ProxyEmptyCard.tsx`
28. `bot-mox/src/components/bot/proxy/ProxyIpqsResults.tsx`
29. `bot-mox/src/components/bot/proxy/ProxyStatusAlert.tsx`
30. `bot-mox/src/components/bot/BotLicense.tsx`
31. `bot-mox/src/components/bot/license/license.module.css`
32. `bot-mox/src/components/bot/license/LicenseViews.tsx`
33. `bot-mox/src/components/bot/BotSubscription.tsx`
34. `bot-mox/src/components/bot/subscription/subscription.module.css`
35. `bot-mox/src/components/bot/subscription/SubscriptionAlerts.tsx`
36. `bot-mox/src/components/bot/subscription/SubscriptionListItem.tsx`
37. `bot-mox/src/components/bot/BotPerson.tsx`
38. `bot-mox/src/components/bot/person/person.module.css`
39. `bot-mox/src/components/bot/person/PersonCardStates.tsx`
40. `bot-mox/src/components/bot/person/PersonFormFields.tsx`
41. `bot-mox/src/components/bot/BotProfession.tsx`
42. `bot-mox/src/components/bot/BotProfession.module.css`
43. `bot-mox/src/components/bot/BotLeveling.tsx`
44. `bot-mox/src/components/bot/BotLeveling.module.css`
45. `bot-mox/src/components/bot/BotFarm.tsx`
46. `bot-mox/src/components/bot/BotFarm.module.css`
47. `bot-mox/src/components/bot/BotLifeStages.tsx`
48. `bot-mox/src/components/bot/lifeStages/lifeStages.module.css`
49. `bot-mox/src/components/bot/lifeStages/StagePanels.tsx`
50. `bot-mox/src/components/bot/lifeStages/StageTimeline.tsx`
51. `bot-mox/src/components/bot/lifeStages/SimpleBarChart.tsx`
52. `bot-mox/src/components/bot/BotCharacter.tsx`
53. `bot-mox/src/components/bot/character/character.module.css`
54. `bot-mox/src/components/bot/character/CharacterEditForm.tsx`

Evidence (Workspace - Notes):
1. `bot-mox/src/components/notes/NotesComponents.module.css`
2. `bot-mox/src/components/notes/NoteEditor.tsx`
3. `bot-mox/src/components/notes/NoteSidebar.tsx`
4. `bot-mox/src/components/notes/BlockEditor.tsx`
5. `bot-mox/src/components/notes/SlashCommandMenu.tsx`
6. `bot-mox/src/components/notes/ListBlock.tsx`
7. `bot-mox/src/components/notes/CheckboxBlock.tsx`

Evidence (Theme Consistency - Typography Tokens):
1. `bot-mox/src/theme/themeRuntime.tsx`

Evidence (Hardening - Lint Warnings Removed):
1. `bot-mox/src/pages/vms/VMsPage.tsx`
2. `bot-mox/src/services/vmOpsEventsService.ts`
55. `bot-mox/src/components/bot/character/CharacterViewMode.tsx`
56. `bot-mox/src/components/bot/character/CharacterStateCards.tsx`
57. `bot-mox/src/components/bot/BotAccount.tsx`
58. `bot-mox/src/components/bot/account/account.module.css`
59. `bot-mox/src/components/bot/account/state-sections.tsx`
60. `bot-mox/src/components/bot/account/credentials-sections.tsx`
61. `bot-mox/src/components/bot/account/generator-sections.tsx`
62. `bot-mox/src/components/bot/account/modals.tsx`

Evidence (Resources + Workspace pages):
1. `bot-mox/src/pages/licenses/index.tsx`
2. `bot-mox/src/pages/licenses/LicensesPage.module.css`
3. `bot-mox/src/pages/licenses/page/LicensesStats.tsx`
4. `bot-mox/src/pages/licenses/page/LicenseColumns.tsx`
5. `bot-mox/src/pages/subscriptions/index.tsx`
6. `bot-mox/src/pages/subscriptions/SubscriptionsPage.module.css`
7. `bot-mox/src/pages/subscriptions/ExpiringSubscriptionsAlert.tsx`
8. `bot-mox/src/pages/subscriptions/SubscriptionsStats.tsx`
9. `bot-mox/src/pages/proxies/ProxiesPage.tsx`
10. `bot-mox/src/pages/proxies/ProxiesPage.module.css`
11. `bot-mox/src/pages/proxies/proxyColumns.tsx`
12. `bot-mox/src/pages/notes/index.tsx`
13. `bot-mox/src/pages/notes/NotesPage.module.css`
14. `bot-mox/src/pages/workspace/calendar/index.tsx`
15. `bot-mox/src/pages/workspace/calendar/WorkspaceCalendarPage.module.css`
16. `bot-mox/src/pages/workspace/calendar/page/CalendarMainPanel.tsx`
17. `bot-mox/src/pages/workspace/calendar/page/CalendarEventList.tsx`
18. `bot-mox/src/pages/workspace/kanban/index.tsx`
19. `bot-mox/src/pages/workspace/kanban/WorkspaceKanbanPage.module.css`
20. `bot-mox/src/components/subscriptions/SubscriptionForm.tsx`
21. `bot-mox/src/components/subscriptions/SubscriptionForm.module.css`

Evidence (UI components):
1. `bot-mox/src/components/ui/LoadingState.tsx`
2. `bot-mox/src/components/ui/LoadingState.module.css`
3. `bot-mox/src/components/ui/MetricCard.tsx`
4. `bot-mox/src/components/ui/MetricCard.module.css`
5. `bot-mox/src/components/ui/StatusBadge.tsx`
6. `bot-mox/src/components/ui/StatusBadge.module.css`
7. `bot-mox/src/components/ui/TableActionButton.tsx`
8. `bot-mox/src/components/ui/TableActionButton.module.css`

Evidence (Schedule components):
1. `bot-mox/src/components/schedule/ScheduleGenerator.tsx`
2. `bot-mox/src/components/schedule/ScheduleGenerator.module.css`
3. `bot-mox/src/components/schedule/TimelineVisualizer.tsx`
4. `bot-mox/src/components/schedule/TimelineVisualizer.module.css`
5. `bot-mox/src/components/schedule/timeline/TimelineHeader.tsx`
6. `bot-mox/src/components/schedule/timeline/TimelineScale.tsx`
7. `bot-mox/src/components/schedule/WeekOverview.tsx`
8. `bot-mox/src/components/schedule/WeekOverview.module.css`
9. `bot-mox/src/components/schedule/WeekPanel.tsx`
10. `bot-mox/src/components/schedule/WeekPanel.module.css`
11. `bot-mox/src/components/schedule/SessionList.tsx`
12. `bot-mox/src/components/schedule/SessionList.module.css`
13. `bot-mox/src/components/schedule/SessionEditor.tsx`
14. `bot-mox/src/components/schedule/SessionEditor.module.css`
15. `bot-mox/src/components/schedule/DayTabs.tsx`
16. `bot-mox/src/components/schedule/DayTabs.module.css`
17. `bot-mox/src/components/schedule/DayStats.tsx`
18. `bot-mox/src/components/schedule/DayStats.module.css`

Evidence (Finance components):
1. `bot-mox/src/components/finance/FinanceCommon.module.css`
2. `bot-mox/src/components/finance/FinanceSummary.tsx`
3. `bot-mox/src/components/finance/FinanceSummary.module.css`
4. `bot-mox/src/components/finance/ProjectPerformanceTable.tsx`
5. `bot-mox/src/components/finance/CostAnalysis.tsx`
6. `bot-mox/src/components/finance/FinanceTransactions.tsx`
7. `bot-mox/src/components/finance/FinanceTransactions.module.css`
8. `bot-mox/src/components/finance/UniversalChart.tsx`
9. `bot-mox/src/components/finance/UniversalChart.module.css`
10. `bot-mox/src/components/finance/GoldPriceChart.tsx`
11. `bot-mox/src/components/finance/GoldPriceChart.module.css`
12. `bot-mox/src/components/finance/TransactionForm.tsx`
13. `bot-mox/src/components/finance/TransactionForm.module.css`

Checks run (this batch):
1. `npm --prefix bot-mox run lint` (pass with known warnings only)
2. `npm --prefix bot-mox run build` (pass)
3. `npm run check:styles:guardrails` (pass)
4. `npm run stack:dev:up` (pass)
5. `npm run smoke:prodlike` (pass; includes `doctor` + Playwright smoke)
6. `node bot-mox/e2e/capture-baseline.mjs` (pass; baseline screenshots + theme propagation report)
7. `cd bot-mox; npx eslint src/pages/dashboard/index.tsx` (pass)
8. `npm run check:styles:guardrails` (pass; `!important=99`)
9. `cd bot-mox; npx eslint src/pages/subscriptions/index.tsx src/pages/subscriptions/subscription-columns.tsx src/pages/subscriptions/ExpiringSubscriptionsAlert.tsx src/pages/subscriptions/SubscriptionsStats.tsx` (pass)
10. `npm run check:styles:guardrails` (pass; `!important=96`)
11. `npm run smoke:prodlike` (pass)
12. `cd bot-mox; npx eslint src/components/bot/BotLicense.tsx src/components/bot/license/LicenseViews.tsx src/components/bot/license/LicenseFormModal.tsx src/components/bot/license/AssignLicenseModal.tsx` (pass)
13. `npm run check:styles:guardrails` (pass; `!important=87`)
14. `npm run smoke:prodlike` (pass)
15. `cd bot-mox; npx eslint src/components/bot/BotFinance.tsx` (pass)
16. `npm run check:styles:guardrails` (pass; `!important=85`)
17. `npm run smoke:prodlike` (pass)
18. `cd bot-mox; npx eslint src/components/notes/NoteEditor.tsx src/components/notes/NoteSidebar.tsx src/components/notes/CheckboxBlock.tsx` (pass)
19. `npm run check:styles:guardrails` (pass; `!important=83`)
20. `npm run smoke:prodlike` (pass)
21. `cd bot-mox; npx eslint src/components/bot/BotPerson.tsx src/components/bot/person/PersonCardStates.tsx src/components/bot/person/PersonFormFields.tsx` (pass)
22. `npm run check:styles:guardrails` (pass; `!important=72`)
23. `npm run smoke:prodlike` (pass)
24. `cd bot-mox; npx eslint src/components/bot/BotSummary.tsx src/components/bot/summary/sections-overview.tsx src/components/bot/summary/sections-details.tsx` (pass)
25. `npm run check:styles:guardrails` (pass; `!important=71`)
26. `npm run smoke:prodlike` (pass)
27. `cd bot-mox; npx eslint src/pages/datacenter/index.tsx src/pages/datacenter/content-map.tsx src/pages/datacenter/content-map-sections.tsx src/pages/datacenter/content-map-sections-secondary.tsx` (pass)
28. `npm run check:styles:guardrails` (pass; `!important=69`)
29. `npm run smoke:prodlike` (pass)
30. `cd bot-mox; npx eslint src/components/bot/BotSchedule.tsx` (pass)
31. `npm run check:styles:guardrails` (pass; `!important=69`)
32. `npm run smoke:prodlike` (pass)
33. `cd bot-mox; npx eslint src/components/bot/BotLifeStages.tsx src/components/bot/lifeStages/StagePanels.tsx src/components/bot/lifeStages/StageTimeline.tsx` (pass)
34. `npm run check:styles:guardrails` (pass; `!important=65`)
35. `npm run smoke:prodlike` (pass)
36. `cd bot-mox; npx eslint src/pages/project/index.tsx src/pages/project/columns.tsx` (pass)
37. `npm run check:styles:guardrails` (pass; `!important=61`)
38. `npm run smoke:prodlike` (pass)
39. `cd bot-mox; npx eslint src/pages/licenses/index.tsx src/pages/licenses/page/LicenseColumns.tsx` (pass)
40. `npm run check:styles:guardrails` (pass; `!important=58`)
41. `npm run smoke:prodlike` (pass)
42. `cd bot-mox; npx eslint src/components/finance/FinanceTransactions.tsx` (pass)
43. `npm run check:styles:guardrails` (pass; `!important=53`)
44. `npm run smoke:prodlike` (pass)
45. `cd bot-mox; npx eslint src/components/bot/proxy/ProxyDetailsCard.tsx src/components/bot/proxy/ProxyEmptyCard.tsx src/components/bot/proxy/ProxyEditorModal.tsx` (pass)
46. `npm run check:styles:guardrails` (pass; `!important=53`)
47. `npm run smoke:prodlike` (pass)
48. `cd bot-mox; npx eslint src/components/bot/BotSubscription.tsx src/components/bot/subscription/SubscriptionAlerts.tsx src/components/bot/subscription/SubscriptionListItem.tsx` (pass)
49. `npm run check:styles:guardrails` (pass; `!important=53`)
50. `npm run smoke:prodlike` (pass)
51. `cd bot-mox; npx eslint src/pages/workspace/calendar/index.tsx src/pages/workspace/calendar/page/CalendarMainPanel.tsx src/pages/workspace/calendar/page/CalendarEventList.tsx` (pass)
52. `npm run check:styles:guardrails` (pass; `!important=48`)
53. `npm run smoke:prodlike` (pass)
54. `cd bot-mox; npx eslint src/components/bot/BotLeveling.tsx` (pass)
55. `npm run check:styles:guardrails` (pass; `!important=48`)
56. `npm run smoke:prodlike` (pass)
57. `cd bot-mox; npx eslint src/components/finance/FinanceSummary.tsx src/components/finance/ProjectPerformanceTable.tsx src/components/finance/CostAnalysis.tsx` (pass)
58. `npm run check:styles:guardrails` (pass; `!important=48`)
59. `npm run smoke:prodlike` (pass)
60. `cd bot-mox; npx eslint src/components/bot/BotFarm.tsx` (pass)
61. `npm run check:styles:guardrails` (pass; `!important=48`)
62. `npm run smoke:prodlike` (pass)
63. `cd bot-mox; npx eslint src/components/schedule/ScheduleGenerator.tsx` (pass)
64. `npm run check:styles:guardrails` (pass; `!important=41`)
65. `npm run smoke:prodlike` (pass)
66. `cd bot-mox; npx eslint src/components/schedule/SessionList.tsx` (pass)
67. `npm run check:styles:guardrails` (pass; `!important=41`)
68. `npm run smoke:prodlike` (pass)
69. `npm run check:styles:guardrails` (pass; `!important=41`)
70. `npm run smoke:prodlike` (pass)
71. `cd bot-mox; npx eslint src/components/finance/UniversalChart.tsx` (pass)
72. `npm run check:styles:guardrails` (pass; `!important=41`)
73. `npm run smoke:prodlike` (pass)
74. `npm run check:styles:guardrails` (pass; `!important=41`)
75. `npm run smoke:prodlike` (pass)
76. `cd bot-mox; npx eslint src/pages/bot/page/sections.tsx` (pass)
77. `npm run check:styles:guardrails` (pass; `!important=41`)
78. `npm run smoke:prodlike` (pass)
79. `cd bot-mox; npx eslint src/components/bot/BotProfession.tsx src/components/ui/MetricCard.tsx src/pages/workspace/kanban/index.tsx src/components/bot/BotLogs.tsx src/components/bot/BotVMInfo.tsx` (pass)
80. `npm run check:styles:guardrails` (pass; `!important=34`)
81. `npm run smoke:prodlike` (pass)
82. `npm run check:styles:guardrails` (pass; `!important=0`)
83. `npm run smoke:prodlike` (pass)
84. `npm run check:theme:contrast` (pass; report generated at `docs/audits/artifacts/theme-contrast/theme-contrast-report-2026-02-18.json`)
85. `npm run check:styles:guardrails` (pass; `!important=0`)
86. `npm run smoke:prodlike` (pass)
87. `npm run check:types` (pass)
88. `npm run check:all` (pass)
89. `cd bot-mox; npm run lint -- src/entities/bot/api/botQueryKeys.ts src/entities/bot/api/useBotQueries.ts src/pages/bot/index.tsx src/components/bot/BotPerson.tsx src/components/bot/BotCharacter.tsx src/components/bot/BotSchedule.tsx src/components/bot/BotLifeStages.tsx src/components/bot/account/use-bot-account-subscription.ts src/components/bot/BotSubscription.tsx src/components/layout/Header.tsx` (pass)
90. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (fails on pre-existing `src/services/unattendProfileService.ts` typing issues unrelated to this batch)
91. `cd bot-mox; npm run lint -- src/services/botsApiService.ts src/entities/bot/api/botQueryKeys.ts src/entities/bot/api/useBotQueries.ts src/entities/bot/api/useBotMutations.ts src/entities/bot/api/useBotReferenceDataQuery.ts src/components/bot/BotAccount.tsx src/components/bot/BotPerson.tsx src/components/bot/BotCharacter.tsx src/components/bot/BotSchedule.tsx` (pass)
92. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
93. `cd bot-mox; npm run lint -- src/components/bot src/pages/bot src/components/layout/Header.tsx src/entities/bot/api/botQueryKeys.ts src/entities/bot/api/useBotQueries.ts src/entities/bot/api/useBotMutations.ts src/entities/bot/api/useBotReferenceDataQuery.ts src/services/botsApiService.ts` (pass)
94. `cd bot-mox; npm run lint -- src/entities/bot/api/useBotQueries.ts src/pages/dashboard/index.tsx src/pages/datacenter/index.tsx src/components/layout/ResourceTree.tsx` (pass)
95. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
96. `cd bot-mox; npm run lint -- src/entities/resources/api/resourceQueryKeys.ts src/entities/resources/api/useResourcesQueries.ts src/pages/project/index.tsx src/pages/licenses/index.tsx src/pages/datacenter/index.tsx` (pass)
97. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
98. `cd bot-mox; npm run lint -- src/entities/resources/api/resourceQueryKeys.ts src/entities/resources/api/useResourcesQueries.ts src/entities/bot/api/useBotQueries.ts src/components/bot/BotLicense.tsx src/pages/project/index.tsx src/pages/licenses/index.tsx src/pages/datacenter/index.tsx src/pages/dashboard/index.tsx src/components/layout/ResourceTree.tsx` (pass)
99. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
100. `cd bot-mox; npm run lint -- src/entities/settings/api/settingsQueryKeys.ts src/entities/settings/api/useProjectSettingsQuery.ts src/entities/notes/api/notesQueryKeys.ts src/entities/notes/api/useNotesIndexQuery.ts src/pages/datacenter/index.tsx src/components/layout/ResourceTree.tsx src/pages/project/index.tsx src/pages/workspace/calendar/index.tsx src/components/notes/NoteSidebar.tsx` (pass)
101. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
102. `cd bot-mox; npm run lint -- src/entities/resources/api/useLicenseMutations.ts src/components/bot/BotLicense.tsx src/pages/licenses/index.tsx src/components/bot/BotSummary.tsx src/components/bot/BotProxy.tsx` (pass)
103. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
104. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
105. `cd bot-mox; npm run lint -- src/entities/resources/api/useProxyMutations.ts src/components/bot/BotProxy.tsx src/entities/resources/api/useLicenseMutations.ts src/components/bot/BotSummary.tsx src/components/bot/BotLicense.tsx src/pages/licenses/index.tsx` (pass)
106. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
107. `rg -n "resourcesApiService" bot-mox/src/components bot-mox/src/pages` (no matches)
108. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
109. `cd bot-mox; npm run lint -- src/pages/subscriptions/index.tsx src/pages/project/index.tsx src/pages/datacenter/index.tsx src/pages/settings/SettingsPage.tsx src/entities/bot/api/useBotMutations.ts src/entities/settings/api/settingsQueryKeys.ts src/entities/settings/api/useSubscriptionSettingsQuery.ts` (pass)
110. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
111. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
112. `cd bot-mox; npm run lint -- src/pages/proxies/ProxiesPage.tsx src/pages/proxies/ProxyCrudModal.tsx src/entities/resources/api/useProxyMutations.ts src/entities/bot/api/useBotMutations.ts src/entities/settings/api/useSubscriptionSettingsQuery.ts` (pass)
113. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
114. `rg -n "proxyDataService|subscribeProxies|subscribeBots" bot-mox/src/components bot-mox/src/pages` (no matches)
115. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
116. `cd bot-mox; npm run lint -- src/entities/workspace/api/workspaceQueryKeys.ts src/entities/workspace/api/useWorkspaceQueries.ts src/entities/workspace/api/useWorkspaceMutations.ts src/entities/workspace/model/types.ts src/pages/workspace/calendar/index.tsx src/pages/workspace/calendar/page/types.ts src/pages/workspace/calendar/page/CalendarMainPanel.tsx src/pages/workspace/calendar/page/CalendarEventList.tsx src/pages/workspace/kanban/index.tsx src/services/workspaceService.ts` (pass)
117. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
118. `rg -n "workspaceService|subscribeToCalendarEvents|subscribeToKanbanTasks" bot-mox/src/components bot-mox/src/pages` (no matches)
119. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
120. `cd bot-mox; npm run lint -- src/entities/notes/api/notesQueryKeys.ts src/entities/notes/api/useNotesIndexQuery.ts src/entities/notes/api/useNoteByIdQuery.ts src/entities/notes/api/useNoteMutations.ts src/entities/notes/model/types.ts src/components/notes/NoteEditor.tsx src/components/notes/NoteSidebar.tsx src/pages/notes/index.tsx` (pass)
121. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
122. `rg -n "subscribeToNote|createNote\\(|updateNote\\(|deleteNote\\(" bot-mox/src/components bot-mox/src/pages` (no matches)
123. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
124. `cd bot-mox; npm run lint -- src/entities/settings/api/useResourceTreeSettings.ts src/entities/settings/api/useScheduleGeneratorSettings.ts src/components/layout/ResourceTree.tsx src/components/schedule/ScheduleGenerator.tsx src/entities/settings/api/settingsQueryKeys.ts` (pass)
125. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
126. `rg -n "services/resourceTreeSettingsService|services/apiClient" bot-mox/src/components bot-mox/src/pages` (no runtime matches in UI; only remaining helper import in `bot/account/settings-storage.ts`)
127. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
128. `cd bot-mox; npm run lint -- src/components/notes/BlockEditor.tsx src/components/notes/CheckboxBlock.tsx src/components/notes/ListBlock.tsx src/components/notes/SlashCommandMenu.tsx src/pages/datacenter/index.tsx src/pages/workspace/calendar/index.tsx src/entities/notes/model/types.ts src/entities/notes/lib/ids.ts src/entities/notes/api/useNoteByIdQuery.ts src/entities/notes/api/useNoteMutations.ts src/entities/notes/api/useNotesIndexQuery.ts` (pass)
129. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
130. `rg -n "notesService" bot-mox/src/components bot-mox/src/pages` (no matches)
131. `rg -n "notesService" bot-mox/src` (matches only `entities/notes/api/*` runtime adapters + `services/notesService.ts`)
132. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
133. `cd bot-mox; npm run lint -- src/entities/bot/model/types.ts src/entities/bot/api/useBotQueries.ts src/pages/datacenter/index.tsx src/components/layout/ResourceTree.tsx src/components/layout/resourceTree/builders.ts src/pages/licenses/page/types.ts` (pass)
134. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
135. `rg -n "services/(botsApiService|notesService)" bot-mox/src/components bot-mox/src/pages` (no matches)
136. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
137. `cd bot-mox; npm run lint -- src/entities/finance/model/chart.ts src/entities/finance/api/chartConfig.ts src/entities/finance/lib/date.ts src/components/finance/FinanceTransactions.tsx src/components/finance/TransactionForm.tsx src/components/finance/UniversalChart.tsx` (pass)
138. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
139. `rg -n "services/(financeService|botsApiService|notesService)" bot-mox/src/components bot-mox/src/pages` (no matches)
140. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
141. `cd bot-mox; npm run lint -- src/entities/vm/model/unattend.ts src/entities/settings/model/theme.ts src/entities/settings/model/projectSettings.ts src/pages/settings/ThemeSettingsPanel.tsx src/pages/settings/SettingsSections.tsx src/components/vm/settingsForm/unattend/AccountSection.tsx src/components/vm/settingsForm/unattend/BloatwareSection.tsx src/components/vm/settingsForm/unattend/CustomScriptSection.tsx src/components/vm/settingsForm/unattend/DesktopIconsSection.tsx src/components/vm/settingsForm/unattend/RegionLanguageSection.tsx src/components/vm/settingsForm/unattend/VisualEffectsSection.tsx src/components/vm/settingsForm/unattend/WindowsSettingsSection.tsx` (pass)
142. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
143. `rg -n "^import type .*services/" bot-mox/src/components bot-mox/src/pages -g "*.tsx"` (no matches)
144. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
145. `cd bot-mox; npm run lint -- src/entities/resources/api/ipqsFacade.ts src/entities/settings/api/settingsFacade.ts src/pages/proxies/ProxiesPage.tsx src/pages/proxies/ProxyCrudModal.tsx src/pages/proxies/proxyColumns.tsx src/components/bot/BotProxy.tsx src/components/bot/proxy/ProxyIpqsResults.tsx src/pages/settings/SettingsPage.tsx src/pages/project/index.tsx src/components src/pages` (pass)
146. `cd bot-mox; npm run lint -- src/entities/bot/api/botLegacyFacade.ts src/entities/vm/api/vmLegacyFacade.ts src/components/bot/BotCharacter.tsx src/components/bot/BotLifeStages.tsx src/components/vm/VMSetupProgress.tsx src/components/vm/VMSettingsForm.tsx src/components/vm/VMQueuePanel.tsx src/pages/vms/VMsPage.tsx src/components/vm/VMCommandPanel.tsx src/pages/vms/VMServicePage.tsx src/components/vm/VMList.tsx src/components/vm/settingsForm/PlaybookTab.tsx src/components/vm/settingsForm/SecretField.tsx src/components/vm/settingsForm/UnattendTab.tsx src/components src/pages` (pass)
147. `rg -n "from .*services/" bot-mox/src/components bot-mox/src/pages -g "*.tsx"` (no matches)
148. `rg -n "from .*services/" bot-mox/src/components bot-mox/src/pages -g "*.ts" -g "*.tsx"` (8 matches remain in non-TSX helpers/hooks)
149. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
150. `cd bot-mox; npm run lint -- src/entities/settings/api/themeFacade.ts src/entities/settings/api/settingsPathClient.ts src/entities/vm/api/vmDeleteContextFacade.ts src/pages/settings/useThemeSettings.ts src/pages/vms/deleteVmRules.ts src/pages/vms/hooks/useDeleteVmWorkflow.ts src/pages/vms/hooks/useVmStartAndQueueActions.ts src/pages/vms/hooks/useVmStorageOptions.ts src/components/bot/account/settings-storage.ts src/components src/pages` (pass)
151. `cd bot-mox; npm run lint -- src/entities/bot/api/botLegacyFacade.ts src/entities/vm/api/vmLegacyFacade.ts src/components/bot/BotCharacter.tsx src/components/bot/BotLifeStages.tsx src/components/vm/VMSetupProgress.tsx src/components/vm/VMSettingsForm.tsx src/components/vm/VMQueuePanel.tsx src/pages/vms/VMsPage.tsx src/components/vm/VMCommandPanel.tsx src/pages/vms/VMServicePage.tsx src/components/vm/VMList.tsx src/components/vm/settingsForm/PlaybookTab.tsx src/components/vm/settingsForm/SecretField.tsx src/components/vm/settingsForm/UnattendTab.tsx src/components src/pages` (pass)
152. `rg -n "from .*services/" bot-mox/src/components bot-mox/src/pages -g "*.ts" -g "*.tsx"` (no matches)
153. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (same pre-existing `src/services/unattendProfileService.ts` typing issues)
154. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
155. `cd bot-mox; npm run lint -- src/services/unattendProfileService.ts src/components src/pages` (pass)
156. `rg -n "from .*services/" bot-mox/src/components bot-mox/src/pages -g "*.ts" -g "*.tsx"` (no matches)
157. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
158. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
159. `cd bot-mox; npx eslint src/pages/vms/VMsPage.tsx src/entities/vm/api/useRefreshOnVmMutationEvents.ts` (pass)
160. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
161. `rg -n "subscribe[A-Z]|subscribeTo|createPollingSubscription" bot-mox/src/components bot-mox/src/pages -g "*.ts" -g "*.tsx"` (no matches)
162. `cd bot-mox; npx eslint src/hooks/useSubscriptions.ts src/entities/resources/api/useSubscriptionMutations.ts src/entities/settings/api/useSubscriptionSettingsMutation.ts src/entities/resources/api/subscriptionFacade.ts` (pass)
163. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
164. `rg -n "subscribeToSubscriptions|subscribeToBotSubscriptions" bot-mox/src/hooks/useSubscriptions.ts` (no matches)
165. `cd bot-mox; npx eslint src/pages/settings/SettingsPage.tsx src/entities/settings/api/useSettingsQueries.ts src/entities/settings/api/useSettingsMutations.ts src/entities/settings/api/useProjectSettingsQuery.ts src/entities/settings/api/settingsQueryKeys.ts src/entities/settings/api/settingsFacade.ts` (pass)
166. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
167. `rg -n "getApiKeys\\(|getProxySettings\\(|getNotificationEvents\\(|getThemeSettings\\(|getProjectSettings\\(|getStoragePolicy\\(|updateApiKeys\\(|updateProxySettings\\(|updateNotificationEvents\\(|updateStoragePolicy\\(" bot-mox/src/pages/settings/SettingsPage.tsx` (no matches)
168. `cd bot-mox; npx eslint src/pages/settings/useThemeSettings.ts src/entities/settings/api/useThemeAssetsQuery.ts src/entities/settings/api/useThemeMutations.ts src/entities/settings/api/settingsQueryKeys.ts` (pass)
169. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
170. `rg -n "applyThemePreset\\(|deleteThemePreset\\(|saveThemePreset\\(|updateThemeSettings\\(|updateThemeVisualSettings\\(|listThemeAssets\\(|uploadThemeAsset\\(|deleteThemeAsset\\(" bot-mox/src/pages/settings/useThemeSettings.ts` (no matches)
171. `cd bot-mox; npx eslint src/components/vm/VMList.tsx src/components/vm/VMCommandPanel.tsx src/pages/vms/VMServicePage.tsx src/components/vm/VMSetupProgress.tsx src/components/bot/BotLifeStages.tsx src/entities/vm/api/useVmActionMutations.ts src/entities/vm/api/useVmQueries.ts src/entities/vm/api/vmQueryKeys.ts src/entities/bot/api/useBotLifecycleMutations.ts` (pass)
172. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
173. `rg -n "startVM\\(|stopVM\\(|updateVMConfig\\(|waitForTask\\(|startAndSendKeyBatch\\(|proxmoxLogin\\(|getVmSetupProgress\\(|banBot\\(|unbanBot\\(" bot-mox/src/components/vm/VMList.tsx bot-mox/src/components/vm/VMCommandPanel.tsx bot-mox/src/pages/vms/VMServicePage.tsx bot-mox/src/components/vm/VMSetupProgress.tsx bot-mox/src/components/bot/BotLifeStages.tsx` (no matches)
174. `cd bot-mox; npx eslint src/pages/vms/hooks/useVmStartAndQueueActions.ts src/pages/vms/hooks/useDeleteVmWorkflow.ts src/components/bot/BotCharacter.tsx src/entities/vm/api/useVmActionMutations.ts src/entities/bot/api/useWowNamesMutation.ts` (pass)
175. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
176. `rg -n "startAndSendKeyBatch\\(|updateVMSettings\\(|getWowNames\\(" bot-mox/src/pages/vms/hooks/useVmStartAndQueueActions.ts bot-mox/src/pages/vms/hooks/useDeleteVmWorkflow.ts bot-mox/src/components/bot/BotCharacter.tsx` (no matches)
177. `cd bot-mox; npx eslint src/components/vm/VMSettingsForm.tsx src/components/vm/VMQueuePanel.tsx src/pages/vms/VMsPage.tsx src/components/vm/settingsForm/UnattendTab.tsx src/components/vm/settingsForm/PlaybookTab.tsx src/components/vm/settingsForm/SecretField.tsx src/pages/vms/hooks/useVmStorageOptions.ts src/entities/vm/api/vmReadFacade.ts src/entities/vm/api/vmSettingsFacade.ts src/entities/vm/api/vmSelectionFacade.ts src/entities/vm/api/unattendProfileFacade.ts src/entities/vm/api/playbookFacade.ts src/entities/vm/api/secretsFacade.ts` (pass)
178. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
179. `rg -n "vmLegacyFacade|botLegacyFacade" bot-mox/src/components bot-mox/src/pages -g "*.ts" -g "*.tsx"` (no matches)
180. `cd bot-mox; npm run lint -- src/components src/pages` (pass)
181. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
182. `rg -n "from .*services/|vmLegacyFacade|botLegacyFacade" bot-mox/src/components bot-mox/src/pages -g "*.ts" -g "*.tsx"` (no matches)
183. `cd bot-mox; npm run test:e2e -- e2e/smoke.spec.ts --project=chromium` (pass)
184. `npx @biomejs/biome check apps packages` (fails initially: invalid `noProcessEnv` key + Nest parameter decorator parsing disabled)
185. `npx @biomejs/biome check apps packages --write` (pass after `biome.json` fixes; 19 files auto-fixed)
186. `npm run biome:write:mono` (pass; formatted `configs/tsconfig.base.json`)
187. `npm run biome:check:mono` (pass)
188. `npm run check:all:mono` (fails in current env: `turbo` cannot resolve package-manager binary because `pnpm-lock.yaml`/local pnpm are not available)
189. `corepack pnpm install --lockfile-only` (pass; `pnpm-lock.yaml` generated)
190. `npm install` + `npm install -D pnpm@10.30.0` (pass; local `turbo`/`pnpm` binaries available in root)
191. `npm run check:all:mono` (passes turbo graph bootstrap; fails on `@botmox/database-schema#db:types` because Supabase target is not running)
192. `corepack pnpm --filter @botmox/api typecheck` (fail -> fixed `apps/api/tsconfig.json` + `ResourcesService`; pass)
193. `npm run db:types` (fails with actionable Supabase message; no Windows `npx.cmd`/`EINVAL` execution error anymore)
194. `npm run biome:check:mono` (pass)
195. `cd bot-mox; npm run test:e2e -- e2e/smoke.spec.ts --project=chromium` (pass)
196. `npm run db:types:check` (pass; deterministic migration-hash based check)
197. `npm run check:all:mono` (pass)
198. `cd bot-mox; npm run lint -- src/providers/data-provider.ts src/providers/resource-contract-client.ts` (pass)
199. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
200. `cd bot-mox; npm run build` (pass)
201. `corepack pnpm --filter @botmox/api-contract typecheck` (pass)
202. `npm run check:no-any:mono` (pass)
203. `npm run check:all:mono` (pass; includes turbo graph + biome + no-any gates)
204. `corepack pnpm --filter @botmox/api-contract check` (pass)
205. `cd bot-mox; npm run lint -- src/services/vmOpsService.ts src/providers/vmops-contract-client.ts` (pass)
206. `cd bot-mox; npx tsc -p tsconfig.app.json --noEmit` (pass)
207. `cd bot-mox; npm run build` (pass)
208. `npx @biomejs/biome check packages/api-contract/src/contract.ts --write` (pass)
209. `npm run check:all:mono` (pass; includes turbo graph + biome + no-any gates)
210. `corepack pnpm --filter @botmox/api-contract check` (pass)
211. `corepack pnpm --filter @botmox/api check` (pass)
212. `npm run check:all:mono` (pass; includes turbo graph + biome + no-any gates)
213. `cd agent; npm run typecheck` (pass)
214. `npm run check:all:mono` (pass; includes turbo graph + biome + no-any gates)

## Phase 4 — Visual Background Theme (Anime/Art)

- [x] `GREEN` Add backend schema extension (`settings/theme.visual`).
- [x] `GREEN` Add image asset metadata table and migration.
- [x] `GREEN` Add theme-assets upload/list/delete API.
- [x] `GREEN` Add settings UI for upload/select/background controls.
- [x] `GREEN` Add shell background layer with overlay/blur/dim.
- [x] `GREEN` Add runtime rollback switch.

Evidence:
1. `proxy-server/src/contracts/schemas.js`
2. `supabase/migrations/20260216001000_create_theme_background_assets.sql`
3. `proxy-server/src/modules/theme-assets/service.js`
4. `proxy-server/src/modules/v1/theme-assets.routes.js`
5. `proxy-server/src/modules/v1/index.js`
6. `bot-mox/src/services/themeAssetsService.ts`
7. `bot-mox/src/pages/settings/ThemeSettingsPanel.tsx`
8. `bot-mox/src/pages/settings/useThemeSettings.ts`
9. `bot-mox/src/App.tsx`

## Phase 5 — Hardening and Cleanup

- [x] `GREEN` Remove dead CSS and obsolete variables.
- [x] `GREEN` Final accessibility/contrast pass.
- [x] `GREEN` Final performance pass for background mode.
- [x] `GREEN` Update dev docs for adding new themed pages.

## Phase 6 — Architecture Alignment (FSD + Query, Wave 1)

- [x] `GREEN` Add app-level TanStack Query provider.
- [x] `GREEN` Create FSD slices for finance domain (`entities` + `features`).
- [x] `GREEN` Move finance page server-state from legacy polling hook to query-layer.
- [x] `GREEN` Migrate heavy domains (`datacenter`, `vms`, `bot`) to same query pattern.
- [x] `GREEN` Expand migration across pages/components and enforce no-API-in-UI guardrails.
- [x] `GREEN` Remove direct API client/service usage from UI components/pages (runtime access moved behind entities query hooks/facades).
- [x] `GREEN` Add lint guardrails for no direct API/service usage in UI (bot + legacy subscription + bot/resource/license/settings/proxyData/workspace/notes/resourceTree/apiClient scopes enabled).
- [x] `GREEN` Replace `subscribeBots*` usage on pages/layout with shared bot queries.
- [x] `GREEN` Replace `subscribeResources*` usage on pages/components with shared resources queries.
- [x] `GREEN` Replace `subscribeToProjectSettings` usage in pages/layout with shared settings query.
- [x] `GREEN` Replace `subscribeToNotesIndex` usage in pages/components with shared notes query.
- [x] `GREEN` Replace direct license CRUD usage in UI with shared resources mutation hooks.
- [x] `GREEN` Replace bot summary resource fetch path with shared resources query hooks.
- [x] `GREEN` Replace direct proxy CRUD usage in bot UI with shared resources mutation hooks.
- [x] `GREEN` Replace direct bot list/delete usage in pages with shared bot query/mutation hooks.
- [x] `GREEN` Replace direct `getSubscriptionSettings` usage in pages with shared settings query hook.
- [x] `GREEN` Replace proxies page legacy polling/CRUD (`proxyDataService`) with shared query/mutation hooks.
- [x] `GREEN` Replace workspace calendar/kanban legacy polling/CRUD (`workspaceService`) with shared workspace query/mutation hooks.
- [x] `GREEN` Replace notes page/editor/sidebar legacy subscribe/CRUD (`notesService`) with shared notes query/mutation hooks.
- [x] `GREEN` Replace resource tree settings direct service calls with shared settings query/mutation hooks.
- [x] `GREEN` Replace schedule generator direct api-client calls with shared settings query/mutation hooks.
- [x] `GREEN` Remove remaining direct `notesService` imports from UI components/pages (types + list item id generation moved to entities layer).
- [x] `GREEN` Remove remaining direct `botsApiService` type imports from UI components/pages (`BotRecord` moved to entities model import).
- [x] `GREEN` Remove direct `financeService` imports from finance UI components (chart config/date formatting moved to `entities/finance`).
- [x] `GREEN` Remove all remaining `import type ...services/...` usages in UI TSX (`theme/project-settings/unattend` types moved to entities model slices).
- [x] `GREEN` Remove direct `ipqs/settings/*` service imports from UI TSX (`Proxies/Settings/Project` moved to entities facades).
- [x] `GREEN` Remove direct `vm/*` + `botLifecycle/wowNames` service imports from UI TSX via `entities/vm` and `entities/bot` facades.
- [x] `GREEN` Reach zero direct `services/*` imports in UI TSX (`src/components/**/*.tsx` + `src/pages/**/*.tsx`).
- [x] `GREEN` Reach zero direct `services/*` imports in UI components/pages source (`src/components/**/*.{ts,tsx}` + `src/pages/**/*.{ts,tsx}`).
- [x] `GREEN` Remove remaining UI `subscribe*` adapters by moving VM operations event subscription from page layer into `entities/vm` hook.
- [x] `GREEN` Migrate `useSubscriptions` hook from legacy `subscribe*` polling + direct CRUD to query/mutation hooks in entities layer.
- [x] `GREEN` Migrate `SettingsPage` orchestration to query/mutation hooks (`api keys`, `proxy`, `notification events`, `theme`, `projects`, `storage policy`) and remove imperative `Promise.all` load flow.
- [x] `GREEN` Migrate `useThemeSettings` runtime operations to entities query/mutation hooks (theme presets + theme assets), removing direct imperative facade calls from page hook.
- [x] `GREEN` Migrate VM/Bot lifecycle runtime operations in UI components to entity mutation/query hooks (`VMList`, `VMCommandPanel`, `VMServicePage`, `VMSetupProgress`, `BotLifeStages`).
- [x] `GREEN` Continue VM/Bot runtime decoupling in page hooks/components (`useVmStartAndQueueActions`, `useDeleteVmWorkflow`, `BotCharacter`) by replacing direct legacy calls with entity mutations.
- [x] `GREEN` Remove remaining `vmLegacyFacade/botLegacyFacade` imports from `src/components/**/*.{ts,tsx}` and `src/pages/**/*.{ts,tsx}` using specialized VM facades (`vmRead/vmSettings/vmSelection/playbook/unattend/secrets`).
- [x] `GREEN` Restore frontend typecheck green by fixing legacy migration typing in `unattendProfileService`.
- [x] `GREEN` Move resources path in `data-provider` to contract-native full CRUD (list/get/getMany/create/update/delete) for `licenses/proxies/subscriptions`.
- [x] `GREEN` Move VM/Agent runtime service path (`vmOpsService`) to contract-native client for `agents list`, `agent pairing create`, `vm-ops dispatch`, and `command status`.
- [x] `GREEN` Align migrated Nest API modules (`agents`, `vm-ops`, `resources`) to reuse shared contract Zod schemas and remove local validation drift.

Evidence:
1. `bot-mox/src/app/providers/QueryProvider.tsx`
2. `bot-mox/src/shared/lib/query/queryClient.ts`
3. `bot-mox/src/entities/finance/api/useFinanceOperationsQuery.ts`
4. `bot-mox/src/features/finance/model/useFinanceOperations.ts`
5. `bot-mox/src/pages/finance/index.tsx`
6. `bot-mox/src/App.tsx`
7. `bot-mox/src/pages/datacenter/index.tsx`
8. `bot-mox/src/entities/vm/api/useVmQueries.ts`
9. `bot-mox/src/entities/vm/api/vmQueryKeys.ts`
10. `bot-mox/src/pages/vms/VMsPage.tsx`
11. `bot-mox/src/pages/vms/VMServicePage.tsx`
12. `bot-mox/src/components/vm/VMServicesPanel.tsx`
13. `bot-mox/src/hooks/useFinance.ts` (compatibility wrapper over FSD/query layer)
14. `bot-mox/src/entities/bot/api/botQueryKeys.ts`
15. `bot-mox/src/entities/bot/api/useBotQueries.ts`
16. `bot-mox/src/pages/bot/index.tsx`
17. `bot-mox/src/components/bot/BotPerson.tsx`
18. `bot-mox/src/components/bot/BotCharacter.tsx`
19. `bot-mox/src/components/bot/BotSchedule.tsx`
20. `bot-mox/src/components/bot/BotLifeStages.tsx`
21. `bot-mox/src/components/bot/BotSubscription.tsx`
22. `bot-mox/src/components/bot/account/use-bot-account-subscription.ts`
23. `bot-mox/src/components/layout/Header.tsx`
24. `bot-mox/src/entities/bot/api/useBotMutations.ts`
25. `bot-mox/src/entities/bot/api/useBotReferenceDataQuery.ts`
26. `bot-mox/src/services/botsApiService.ts` (`patchBot` helper for UI-free bot updates)
27. `bot-mox/src/components/bot/BotAccount.tsx` (migrated to mutation hook; removed direct `apiPatch`)
28. `bot-mox/eslint.config.js` (bot UI `no-restricted-imports` guard for `apiClient` + `botsApiService`)
29. `bot-mox/src/pages/dashboard/index.tsx` (migrated from `subscribeBotsList` to `useBotsListQuery`)
30. `bot-mox/src/pages/datacenter/index.tsx` (migrated bots map from `subscribeBotsMap` to `useBotsMapQuery`)
31. `bot-mox/src/components/layout/ResourceTree.tsx` (migrated bots map from `subscribeBotsMap` to `useBotsMapQuery`)
32. `bot-mox/src/entities/bot/api/useBotQueries.ts` (added `useBotsMapQuery`)
33. `bot-mox/src/entities/resources/api/resourceQueryKeys.ts`
34. `bot-mox/src/entities/resources/api/useResourcesQueries.ts`
35. `bot-mox/src/pages/project/index.tsx` (migrated bots/resources subscriptions to shared queries)
36. `bot-mox/src/pages/licenses/index.tsx` (migrated licenses + bots subscriptions to shared queries)
37. `bot-mox/src/components/bot/BotLicense.tsx` (migrated license subscription to shared query)
38. `bot-mox/src/entities/settings/api/settingsQueryKeys.ts`
39. `bot-mox/src/entities/settings/api/useProjectSettingsQuery.ts`
40. `bot-mox/src/entities/notes/api/notesQueryKeys.ts`
41. `bot-mox/src/entities/notes/api/useNotesIndexQuery.ts`
42. `bot-mox/src/pages/workspace/calendar/index.tsx`
43. `bot-mox/src/components/notes/NoteSidebar.tsx`
44. `bot-mox/src/components/bot/BotProxy.tsx` (migrated from `subscribeResources` + direct resource CRUD to `useProxiesQuery` + proxy mutation hooks)
45. `bot-mox/src/entities/resources/api/useLicenseMutations.ts`
46. `bot-mox/src/components/bot/BotLicense.tsx` (migrated license CRUD to mutation hooks)
47. `bot-mox/src/pages/licenses/index.tsx` (migrated license CRUD to mutation hooks)
48. `bot-mox/src/components/bot/BotSummary.tsx` (migrated from direct `fetchResources` to shared resources queries)
49. `bot-mox/src/entities/resources/api/useProxyMutations.ts`
50. `bot-mox/eslint.config.js` (expanded UI `no-restricted-imports` guard for legacy subscriptions and direct bot/resource/license/proxyData/settings service imports)
51. `bot-mox/src/entities/bot/api/useBotMutations.ts` (added `useDeleteBotMutation`)
52. `bot-mox/src/entities/settings/api/useSubscriptionSettingsQuery.ts`
53. `bot-mox/src/entities/settings/api/settingsQueryKeys.ts` (added `subscriptionAlerts` query key)
54. `bot-mox/src/pages/subscriptions/index.tsx` (migrated bot list loading from direct service call to `useBotsListQuery`)
55. `bot-mox/src/pages/project/index.tsx` (migrated bot delete flow to `useDeleteBotMutation`, subscription warning settings to settings query)
56. `bot-mox/src/pages/datacenter/index.tsx` (migrated warning settings from direct service call to settings query)
57. `bot-mox/src/pages/settings/SettingsPage.tsx` (migrated alerts settings load path to settings query hook)
58. `bot-mox/src/pages/proxies/ProxiesPage.tsx` (migrated from `proxyDataService` subscriptions/CRUD to shared query/mutation hooks)
59. `bot-mox/src/pages/proxies/ProxyCrudModal.tsx` (migrated proxy create/update to shared proxy mutation hooks)
60. `bot-mox/src/entities/workspace/api/workspaceQueryKeys.ts`
61. `bot-mox/src/entities/workspace/api/useWorkspaceQueries.ts`
62. `bot-mox/src/entities/workspace/api/useWorkspaceMutations.ts`
63. `bot-mox/src/entities/workspace/model/types.ts`
64. `bot-mox/src/pages/workspace/calendar/index.tsx` (migrated from `workspaceService` subscribe/create/update/delete to shared workspace query/mutation hooks)
65. `bot-mox/src/pages/workspace/kanban/index.tsx` (migrated from `workspaceService` subscribe/create/update/delete to shared workspace query/mutation hooks)
66. `bot-mox/src/pages/workspace/calendar/page/types.ts`
67. `bot-mox/src/pages/workspace/calendar/page/CalendarMainPanel.tsx`
68. `bot-mox/src/pages/workspace/calendar/page/CalendarEventList.tsx`
69. `bot-mox/src/services/workspaceService.ts` (exposed explicit `fetchCalendarEvents`/`fetchKanbanTasks` for query layer; subscriptions now delegate to those fetchers)
70. `bot-mox/src/entities/notes/api/useNoteByIdQuery.ts`
71. `bot-mox/src/entities/notes/api/useNoteMutations.ts`
72. `bot-mox/src/entities/notes/model/types.ts`
73. `bot-mox/src/entities/notes/api/notesQueryKeys.ts` (added `note(id)` query key)
74. `bot-mox/src/pages/notes/index.tsx` (migrated from `subscribeToNote` to shared note-by-id query hook)
75. `bot-mox/src/components/notes/NoteEditor.tsx` (migrated note update/delete to shared notes mutations)
76. `bot-mox/src/components/notes/NoteSidebar.tsx` (migrated note create/pin/delete to shared notes mutations)
77. `bot-mox/eslint.config.js` (expanded UI `no-restricted-imports` guard for direct notes CRUD + `subscribeToNote`)
78. `bot-mox/src/entities/settings/api/useResourceTreeSettings.ts`
79. `bot-mox/src/components/layout/ResourceTree.tsx` (migrated from direct resource-tree settings service calls to shared settings query/mutation hooks)
80. `bot-mox/src/entities/settings/api/useScheduleGeneratorSettings.ts`
81. `bot-mox/src/components/schedule/ScheduleGenerator.tsx` (migrated from direct `apiClient` calls to shared schedule-generator settings query/mutation hooks)
82. `bot-mox/src/entities/settings/api/settingsQueryKeys.ts` (added `resourceTree` + `scheduleGenerator` query keys)
83. `bot-mox/src/entities/notes/model/types.ts` (notes model types now owned by entities layer; UI no longer imports notes service types directly)
84. `bot-mox/src/entities/notes/lib/ids.ts` + `bot-mox/src/components/notes/ListBlock.tsx` (list item id generation moved from service layer into entities utility)
85. `bot-mox/src/components/notes/BlockEditor.tsx` + `bot-mox/src/components/notes/CheckboxBlock.tsx` + `bot-mox/src/components/notes/SlashCommandMenu.tsx` + `bot-mox/src/pages/datacenter/index.tsx` + `bot-mox/src/pages/workspace/calendar/index.tsx` (remaining UI note-type imports moved from `notesService` to entities types)
86. `bot-mox/eslint.config.js` (added pattern guard to block any direct `notesService` imports in UI TSX components/pages)
87. `bot-mox/src/entities/bot/model/types.ts` + `bot-mox/src/entities/bot/api/useBotQueries.ts` (`BotRecord` model import moved into entities layer)
88. `bot-mox/src/pages/datacenter/index.tsx` + `bot-mox/src/components/layout/ResourceTree.tsx` + `bot-mox/src/components/layout/resourceTree/builders.ts` + `bot-mox/src/pages/licenses/page/types.ts` (remaining UI `BotRecord` imports moved from `botsApiService` to entities types)
89. `bot-mox/eslint.config.js` (added pattern guard to block any direct `botsApiService` imports in UI TSX components/pages)
90. `bot-mox/src/entities/finance/model/chart.ts` + `bot-mox/src/entities/finance/api/chartConfig.ts` (chart configuration API/type moved to entities layer)
91. `bot-mox/src/entities/finance/lib/date.ts` (shared finance date formatting moved to entities layer)
92. `bot-mox/src/components/finance/UniversalChart.tsx` + `bot-mox/src/components/finance/FinanceTransactions.tsx` + `bot-mox/src/components/finance/TransactionForm.tsx` (removed direct `financeService` imports from finance UI components)
93. `bot-mox/eslint.config.js` (added pattern guard to block any direct `financeService` imports in UI TSX components/pages)
94. `bot-mox/src/entities/vm/model/unattend.ts` (unattend profile type exports moved to entities VM model layer)
95. `bot-mox/src/entities/settings/model/theme.ts` + `bot-mox/src/entities/settings/model/projectSettings.ts` (theme/project settings type exports moved to entities settings model layer)
96. `bot-mox/src/pages/settings/ThemeSettingsPanel.tsx` + `bot-mox/src/pages/settings/SettingsSections.tsx` (type imports switched from services to entities model types)
97. `bot-mox/src/components/vm/settingsForm/unattend/AccountSection.tsx` + `bot-mox/src/components/vm/settingsForm/unattend/BloatwareSection.tsx` + `bot-mox/src/components/vm/settingsForm/unattend/CustomScriptSection.tsx` + `bot-mox/src/components/vm/settingsForm/unattend/DesktopIconsSection.tsx` + `bot-mox/src/components/vm/settingsForm/unattend/RegionLanguageSection.tsx` + `bot-mox/src/components/vm/settingsForm/unattend/VisualEffectsSection.tsx` + `bot-mox/src/components/vm/settingsForm/unattend/WindowsSettingsSection.tsx` (unattend type imports switched from services to entities model types)
98. `bot-mox/src/entities/resources/api/ipqsFacade.ts` + `bot-mox/src/pages/proxies/ProxiesPage.tsx` + `bot-mox/src/pages/proxies/ProxyCrudModal.tsx` + `bot-mox/src/pages/proxies/proxyColumns.tsx` + `bot-mox/src/components/bot/BotProxy.tsx` + `bot-mox/src/components/bot/proxy/ProxyIpqsResults.tsx` (IPQS service usage moved from UI TSX to entities facade)
99. `bot-mox/src/entities/settings/api/settingsFacade.ts` + `bot-mox/src/pages/settings/SettingsPage.tsx` + `bot-mox/src/pages/project/index.tsx` (settings/theme/api-keys/storage/default-settings service usage moved from UI TSX to entities facade)
100. `bot-mox/src/entities/vm/api/vmLegacyFacade.ts` + `bot-mox/src/entities/bot/api/botLegacyFacade.ts` (legacy VM/bot service access centralized in entities facades)
101. `bot-mox/src/components/vm/VMSetupProgress.tsx` + `bot-mox/src/components/vm/VMSettingsForm.tsx` + `bot-mox/src/components/vm/VMQueuePanel.tsx` + `bot-mox/src/pages/vms/VMsPage.tsx` + `bot-mox/src/components/vm/VMCommandPanel.tsx` + `bot-mox/src/pages/vms/VMServicePage.tsx` + `bot-mox/src/components/vm/VMList.tsx` + `bot-mox/src/components/vm/settingsForm/PlaybookTab.tsx` + `bot-mox/src/components/vm/settingsForm/SecretField.tsx` + `bot-mox/src/components/vm/settingsForm/UnattendTab.tsx` + `bot-mox/src/components/bot/BotCharacter.tsx` + `bot-mox/src/components/bot/BotLifeStages.tsx` (remaining direct VM/bot service imports removed from UI TSX)
102. `bot-mox/eslint.config.js` (guardrails expanded for `ipqs/settings/vm/wowNames/botLifecycle` service import blocking in UI TSX)
103. `bot-mox/src/entities/settings/api/themeFacade.ts` + `bot-mox/src/pages/settings/useThemeSettings.ts` (theme and theme-assets service usage moved from page helper to entities settings facade)
104. `bot-mox/src/entities/vm/api/vmDeleteContextFacade.ts` + `bot-mox/src/pages/vms/deleteVmRules.ts` + `bot-mox/src/pages/vms/hooks/useDeleteVmWorkflow.ts` (delete-vm context service usage moved to entities VM facade)
105. `bot-mox/src/pages/vms/hooks/useVmStartAndQueueActions.ts` + `bot-mox/src/pages/vms/hooks/useVmStorageOptions.ts` + `bot-mox/src/entities/vm/api/vmLegacyFacade.ts` (remaining VM service usage in page hooks moved to entities VM facade)
106. `bot-mox/src/entities/settings/api/settingsPathClient.ts` + `bot-mox/src/components/bot/account/settings-storage.ts` (raw settings API client usage moved out of component helper into entities settings API client)
107. `bot-mox/src/components/**/*.ts` + `bot-mox/src/pages/**/*.ts` (direct `services/*` imports reduced to zero across components/pages TS helpers)
108. `bot-mox/src/services/unattendProfileService.ts` (legacy migration typing widened safely via `Omit<..., 'mode'>` for compatibility aliases; `tsc` restored to green)
109. `bot-mox/src/entities/vm/api/useRefreshOnVmMutationEvents.ts` + `bot-mox/src/pages/vms/VMsPage.tsx` (moved VM ops terminal-event subscription out of page layer; no remaining `subscribe*` usage in pages/components)
110. `bot-mox/src/hooks/useSubscriptions.ts` (migrated from legacy subscribe polling/state management to TanStack Query + entity mutations while preserving hook API for UI consumers)
111. `bot-mox/src/entities/resources/api/useSubscriptionMutations.ts` + `bot-mox/src/entities/resources/api/subscriptionFacade.ts` (subscription CRUD + enrichment now provided through entities API surface)
112. `bot-mox/src/entities/settings/api/useSubscriptionSettingsMutation.ts` (subscription settings save flow moved to query mutation with cache sync)
113. `bot-mox/src/entities/settings/api/useSettingsQueries.ts` + `bot-mox/src/entities/settings/api/useSettingsMutations.ts` (query/mutation hooks added for settings domains used by settings page)
114. `bot-mox/src/entities/settings/api/settingsQueryKeys.ts` + `bot-mox/src/entities/settings/api/useProjectSettingsQuery.ts` + `bot-mox/src/entities/settings/api/settingsFacade.ts` (settings query keyspace expanded; project settings hook aligned to entities facade types)
115. `bot-mox/src/pages/settings/SettingsPage.tsx` (migrated from imperative settings load + direct facade CRUD calls to query/mutation hooks with centralized refetch)
116. `bot-mox/src/entities/settings/api/useThemeAssetsQuery.ts` + `bot-mox/src/entities/settings/api/useThemeMutations.ts` (theme assets query and theme/theme-assets mutation hooks added in entities settings API layer)
117. `bot-mox/src/pages/settings/useThemeSettings.ts` (migrated to query/mutation hooks for theme save/apply/delete and asset upload/delete/refresh operations)
118. `bot-mox/src/entities/settings/api/settingsQueryKeys.ts` (added `themeAssets` key for theme assets cache orchestration)
119. `bot-mox/src/entities/vm/api/useVmActionMutations.ts` (centralized VM runtime command mutations: start/stop/config/task-wait/key-batch/proxmox-login)
120. `bot-mox/src/entities/vm/api/useVmQueries.ts` + `bot-mox/src/entities/vm/api/vmQueryKeys.ts` (added VM setup progress query with polling keyspace)
121. `bot-mox/src/entities/bot/api/useBotLifecycleMutations.ts` (ban/unban bot lifecycle mutations with bot query invalidation)
122. `bot-mox/src/components/vm/VMList.tsx` + `bot-mox/src/components/vm/VMCommandPanel.tsx` + `bot-mox/src/pages/vms/VMServicePage.tsx` + `bot-mox/src/components/vm/VMSetupProgress.tsx` + `bot-mox/src/components/bot/BotLifeStages.tsx` (migrated runtime lifecycle operations from direct legacy calls to entity mutations/query hooks)
123. `bot-mox/src/pages/vms/hooks/useVmStartAndQueueActions.ts` + `bot-mox/src/pages/vms/hooks/useDeleteVmWorkflow.ts` + `bot-mox/src/entities/vm/api/useVmActionMutations.ts` (page-level VM runtime actions/settings updates moved from direct legacy calls to mutation hooks)
124. `bot-mox/src/entities/bot/api/useWowNamesMutation.ts` + `bot-mox/src/components/bot/BotCharacter.tsx` (WoW name generation moved from direct legacy call to entity mutation hook)
125. `bot-mox/src/entities/vm/api/vmReadFacade.ts` + `bot-mox/src/entities/vm/api/vmSettingsFacade.ts` + `bot-mox/src/entities/vm/api/vmSelectionFacade.ts` + `bot-mox/src/entities/vm/api/unattendProfileFacade.ts` + `bot-mox/src/entities/vm/api/playbookFacade.ts` + `bot-mox/src/entities/vm/api/secretsFacade.ts` (specialized VM facades introduced to retire `vmLegacyFacade` usage in UI layers)
126. `bot-mox/src/components/vm/VMSettingsForm.tsx` + `bot-mox/src/components/vm/VMQueuePanel.tsx` + `bot-mox/src/pages/vms/VMsPage.tsx` + `bot-mox/src/components/vm/settingsForm/UnattendTab.tsx` + `bot-mox/src/components/vm/settingsForm/PlaybookTab.tsx` + `bot-mox/src/components/vm/settingsForm/SecretField.tsx` + `bot-mox/src/pages/vms/hooks/useVmStorageOptions.ts` (migrated remaining `vmLegacyFacade` imports to dedicated VM facades)
127. `bot-mox/e2e/smoke.spec.ts` + `bot-mox/playwright.config.ts` (React 19 smoke gate executed with Playwright)
128. `biome.json` (Biome 2.x config compatibility fixed for Nest decorators and env rule naming)
129. `package.json` (added `biome:check:mono` / `biome:write:mono`; wired Biome into `check:all:mono`)
130. `configs/tsconfig.base.json` (formatted by monorepo Biome baseline)
131. `pnpm-lock.yaml` (workspace lockfile baseline for pnpm/turbo pipeline)
132. `packages/database-schema/scripts/generate-supabase-types.mjs` (Windows-safe Supabase CLI execution path)
133. `packages/database-schema/scripts/check-generated-types.mjs` (Windows-safe Supabase CLI execution path)
134. `apps/api/tsconfig.json` (Nest tsconfig alignment for strict typecheck)
135. `apps/api/src/modules/resources/resources.service.ts` (null-safe strict typing for in-memory resource store)
136. `packages/database-schema/scripts/update-generated-types-meta.mjs` (added migration-hash metadata generator for deterministic DB types checks)
137. `packages/database-schema/src/generated/supabase.types.meta.json` (generated DB types metadata baseline)
138. `turbo.json` (`db:types:check` no longer hard-depends on `db:types` runtime generation)
139. `packages/api-contract/src/schemas.ts` (resource list query schema added to contract)
140. `packages/api-contract/src/contract.ts` (resources contract extended with query typing)
141. `packages/api-contract/package.json` (package exports adjusted for source-based workspace consumption)
142. `bot-mox/src/providers/resource-contract-client.ts` (contract runtime wrapper for resources full CRUD operations)
143. `bot-mox/src/providers/data-provider.ts` (resources full CRUD path migrated to contract client)
144. `bot-mox/package.json` (added local `@botmox/api-contract` dependency for frontend contract usage)
145. `scripts/check-no-any-mono.js` (no-new-any guard for `apps/*` + `packages/*`)
146. `package.json` (`check:no-any:mono` added and wired into `check:all:mono`)
147. `bot-mox/package-lock.json` (lockfile update after frontend contract package integration)
148. `packages/api-contract/src/contract.ts` (resources contract expanded to full CRUD with compatibility alias)
149. `apps/api/src/modules/resources/resources.controller.ts` + `apps/api/src/modules/resources/resources.service.ts` (Nest resources module aligned with legacy REST/query parity for strangler compatibility)
150. `packages/api-contract/src/schemas.ts` + `packages/api-contract/src/contract.ts` (agents/vm-ops contract expanded for query + pairing + syncthing + 202 dispatch behavior)
151. `bot-mox/src/providers/vmops-contract-client.ts` + `bot-mox/src/services/vmOpsService.ts` (legacy `apiGet/apiPost` calls replaced with contract runtime wrappers for VM ops/agents flow)
152. `apps/api/src/modules/agents/agents.controller.ts` (now uses `@botmox/api-contract` schemas for list/pairing/heartbeat validation)
153. `apps/api/src/modules/vm-ops/vm-ops.controller.ts` (now uses `@botmox/api-contract` schemas for action/dispatch validation)
154. `apps/api/src/modules/resources/resources.controller.ts` (now uses `@botmox/api-contract` resource schemas for kind/query/body validation)
155. `packages/api-contract/src/schemas.ts` + `packages/api-contract/src/contract.ts` (added shared `agentHeartbeatSchema`; `resourceMutationSchema` now non-empty to match runtime boundary rules)

Additional hardening evidence:
1. `bot-mox/src/pages/bot/BotPage.module.css` (removed obsolete legacy `subtab*` block no longer used by bot page runtime)
2. `scripts/check-theme-contrast.js` + `docs/audits/artifacts/theme-contrast/theme-contrast-report-2026-02-18.json` (automated theme token contrast checks for light/dark palettes)
3. `bot-mox/src/App.tsx` (visual background blur now respects `prefers-reduced-motion`, reducing motion/paint cost on constrained setups)
4. `docs/DEV-WORKFLOW.md` (added mandatory checklist for adding new themed pages)
5. `package.json` (`check:theme:contrast` script and inclusion in `check:all`)
6. `agent/src/core/diagnostics.ts` + `agent/src/main/index.ts` + `agent/src/main/tray.ts` (diagnostic bundle command added to tray flow for structured incident export)
7. `scripts/check-strangler-contract-parity.cjs` (expanded parity coverage for migrated modules with explicit `400/404` contract validation branches)
8. `packages/api-contract/src/index.ts` + `packages/api-contract/src/contract.ts` (ESM runtime import compatibility + explicit `agentsList` `400` response contract alignment)
9. `bot-mox/src/providers/auth-provider.ts` + `proxy-server/src/modules/v1/auth.routes.js` (auth verify/whoami flow aligned with contract and strangler behavior; frontend identity resolution moved to `whoami`)
10. `.github/workflows/ci.yml` + `package.json` (`biome:check:mono`) (CI command path migrated to pnpm workspace install/cache and pnpm-based mono checks)
11. `scripts/check-no-any-mono.js` + `package.json` (`check:no-any:mono`) (no-any guard expanded from `apps/packages` to frontend/agent TS scopes using explicit-type matching)
12. `package.json` + `docs/DEV-WORKFLOW.md` (Supabase lifecycle commands moved from `npx` path to `corepack pnpm exec supabase` in primary local workflow)
13. `scripts/check-pnpm-first.js` + `package.json` (`check:pnpm:first`, `check:all:mono`) (pnpm-first guard added to block accidental npm/npx reintroduction in root scripts)
14. `packages/api-contract/src/contract.ts` + `packages/api-contract/src/schemas.ts` + `bot-mox/src/providers/bot-contract-client.ts` + `bot-mox/src/entities/bot/api/useBotQueries.ts` + `bot-mox/src/entities/bot/api/useBotMutations.ts` (bot query/mutation stack moved to contract runtime client; legacy `botsApiService` direct dependency removed from entities hooks)
15. `scripts/check-strangler-contract-parity.cjs` (parity gate now verifies bots routes and `400/404` branches in addition to auth/resources/agents/vm-ops)
16. `bot-mox/src/providers/data-provider.ts` (bots resource CRUD path switched to contract runtime client for Refine provider operations)
17. `packages/api-contract/src/schemas.ts` + `packages/api-contract/src/contract.ts` (workspace notes/calendar/kanban contract slice added with explicit CRUD and validation schemas)
18. `bot-mox/src/providers/workspace-contract-client.ts` + `bot-mox/src/services/workspaceService.ts` (workspace data path moved from direct `apiClient` calls to contract runtime wrapper while preserving existing query-hook surface)
19. `scripts/check-strangler-contract-parity.cjs` + `proxy-server/src/modules/v1/workspace.routes.js` (parity gate extended with workspace `calendar/kanban` success and `400/404` contract branches)
20. `packages/api-contract/src/schemas.ts` + `packages/api-contract/src/contract.ts` (workspace contract slice extended to include `notes` CRUD with shared validation envelopes)
21. `scripts/check-strangler-contract-parity.cjs` (parity gate extended to validate workspace `notes` success and `400/404` branches)
22. `apps/api/src/modules/workspace/workspace.module.ts` + `apps/api/src/modules/workspace/workspace.controller.ts` + `apps/api/src/modules/workspace/workspace.service.ts` (Nest workspace module introduced for `notes/calendar/kanban` with contract-backed validation and strangler-ready route parity)
23. `bot-mox/src/services/notesService.ts` + `bot-mox/src/providers/workspace-contract-client.ts` (notes data flow migrated from direct `apiClient` REST calls to contract runtime wrappers for list/get/create/patch/delete)
24. `packages/api-contract/src/schemas.ts` + `packages/api-contract/src/contract.ts` (bot lifecycle schemas/routes added to typed contract: `lifecycle`, `transitions`, `is-banned`, `transition`, `ban`, `unban`)
25. `bot-mox/src/providers/bot-contract-client.ts` + `bot-mox/src/services/botLifecycleService.ts` (bot lifecycle service migrated from direct `apiGet/apiPost` calls to contract runtime wrapper)
26. `apps/api/src/modules/bots/bots.module.ts` + `apps/api/src/modules/bots/bots.controller.ts` + `apps/api/src/modules/bots/bots.service.ts` + `scripts/check-strangler-contract-parity.cjs` (Nest bots lifecycle parity and contract/error-branch checks added to strangler gate)
27. `packages/api-contract/src/schemas.ts` + `packages/api-contract/src/contract.ts` (playbooks schemas/routes added to typed contract: `list`, `get`, `create`, `update`, `delete`, `validate`, including `422` validation branch)
28. `bot-mox/src/providers/playbook-contract-client.ts` + `bot-mox/src/services/playbookService.ts` (playbook service migrated from direct `apiGet/apiPost/apiPut/apiDelete` calls to contract runtime wrapper)
29. `apps/api/src/modules/playbooks/playbooks.module.ts` + `apps/api/src/modules/playbooks/playbooks.controller.ts` + `apps/api/src/modules/playbooks/playbooks.service.ts` + `scripts/check-strangler-contract-parity.cjs` (Nest playbooks parity and contract validation/error branches added to strangler gate)
30. `packages/api-contract/src/schemas.ts` + `packages/api-contract/src/contract.ts` + `bot-mox/src/providers/wow-names-contract-client.ts` + `bot-mox/src/services/wowNamesService.ts` + `apps/api/src/modules/wow-names/wow-names.module.ts` + `apps/api/src/modules/wow-names/wow-names.controller.ts` + `apps/api/src/modules/wow-names/wow-names.service.ts` + `scripts/check-strangler-contract-parity.cjs` (wow-names contract/Nest/frontend parity completed; `batches` + `count` response modes validated in mono gate)
31. `packages/api-contract/src/schemas.ts` + `packages/api-contract/src/contract.ts` + `bot-mox/src/providers/ipqs-contract-client.ts` + `bot-mox/src/services/ipqsService.ts` + `apps/api/src/modules/ipqs/ipqs.module.ts` + `apps/api/src/modules/ipqs/ipqs.controller.ts` + `apps/api/src/modules/ipqs/ipqs.service.ts` + `scripts/check-strangler-contract-parity.cjs` (ipqs contract/Nest/frontend parity completed; `status/check/check-batch` plus `400` branches validated in mono gate)
32. `packages/api-contract/src/schemas.ts` + `packages/api-contract/src/contract.ts` + `bot-mox/src/providers/settings-contract-client.ts` + `bot-mox/src/services/apiKeysService.ts` + `scripts/check-strangler-contract-parity.cjs` (settings contract/frontend parity completed for `api_keys`/`proxy`/`notifications/events`; `400` branches and nullable GET shape validated in mono gate)
33. `bot-mox/src/components/vm/VMQueuePanel.tsx` + `bot-mox/src/components/vm/VMQueuePanel.module.css` + `bot-mox/src/components/vm/VMOperationLog.tsx` + `bot-mox/src/pages/project/columns.tsx` + `bot-mox/src/pages/project/ProjectPage.module.css` + `bot-mox/src/components/vm/settingsForm/ServiceUrlsSection.tsx` + `bot-mox/src/components/vm/settingsForm/SettingsSectionLayout.module.css` (a11y cleanup wave: explicit button types, modal interaction semantics, label/control alignment in queue/settings/project views)
34. `bot-mox/src/components/vm/settingsForm/SshSection.tsx` + `bot-mox/src/components/vm/settingsForm/ProxmoxSection.tsx` + `bot-mox/src/components/vm/settingsForm/SecretField.tsx` + `bot-mox/src/components/vm/settingsForm/ProxmoxTab.tsx` + `bot-mox/src/components/vm/settingsForm/ProxmoxTab.module.css` + `bot-mox/src/components/vm/settingsForm/PlaybookTab.tsx` + `bot-mox/src/components/vm/settingsForm/PlaybookTab.module.css` + `bot-mox/src/components/vm/settingsForm/unattend/RegionLanguageSection.tsx` (settings-form Biome debt closed: `noLabelWithoutControl`, clickable static elements, and index-key violations)
35. `bot-mox/src/pages/vms/VMsPage.tsx` + `bot-mox/src/pages/vms/VMsPage.module.css` + `bot-mox/src/components/layout/ResourceTree.tsx` + `bot-mox/src/components/layout/ResourceTree.module.css` + `bot-mox/src/components/bot/summary/sections-details.tsx` + `bot-mox/src/components/bot/BotSummary.module.css` + `bot-mox/src/components/notes/SlashCommandMenu.tsx` + `bot-mox/src/components/schedule/TimelineVisualizer.tsx` + `bot-mox/src/components/schedule/TimelineVisualizer.module.css` (semantic interactive controls migrated from `div` patterns to button-based elements with style resets)
36. `bot-mox/src/components/finance/FinanceTransactions.tsx` + `bot-mox/src/pages/finance/index.tsx` + `bot-mox/src/components/layout/Header.tsx` + `bot-mox/src/pages/licenses/page/LicenseColumns.tsx` + `bot-mox/src/components/ui/ErrorBoundary.tsx` + `bot-mox/src/pages/bot/page/sections.tsx` + `bot-mox/src/pages/datacenter/content-map-sections-secondary.tsx` + `bot-mox/src/pages/subscriptions/subscription-columns.tsx` (removed remaining non-null assertions and unused imports in high-traffic pages/components)
37. `bot-mox/src/components/vm/VMSettingsForm.tsx` + `bot-mox/src/components/bot/lifeStages/SimpleBarChart.tsx` + `bot-mox/src/components/finance/GoldPriceChart.tsx` + `bot-mox/src/components/finance/UniversalChart.tsx` + `bot-mox/src/components/schedule/ScheduleGenerator.tsx` + `bot-mox/src/components/ui/LoadingState.tsx` + `bot-mox/src/components/notes/BlockEditor.tsx` + `bot-mox/src/components/notes/NotesComponents.module.css` (final components/pages Biome stabilization: index-key removal, iterable keys, literal-key simplification, and CSS parse fix for Monaco global selectors)
38. `tmp_biome_components_pages_full.txt` + `corepack pnpm --dir e:/Боттинг/source/repos/Bot-Mox exec biome check bot-mox/src/components bot-mox/src/pages --max-diagnostics 5000` (current baseline: `Checked 276 files... No fixes applied`, zero errors in `components/pages` scope)
39. `corepack pnpm --dir e:/Боттинг/source/repos/Bot-Mox run check:all:mono` (full monorepo quality gate green after this refactor wave: turbo checks + biome mono + no-any + strangler parity/routing)
40. `bot-mox/src/main.tsx` (removed final non-null assertion on root bootstrap; explicit runtime guard added for `#root` mount target)
41. `bot-mox/src/App.tsx` + `bot-mox/src/AppShell.module.css` + `bot-mox/src/styles/global.css` + `bot-mox/src/styles/variables.css` + `bot-mox/src/types/appSettings.ts` + `bot-mox/src/types/botLifecycle.ts` + `bot-mox/src/types/core.ts` + `bot-mox/src/types/finance.ts` + `bot-mox/src/types/index.ts` + `bot-mox/src/types/resources.ts` + `bot-mox/src/types/vm.ts` (Biome baseline formatting/import ordering aligned across app shell and shared type/style layer)
42. `tmp_biome_src_full.txt` + `corepack pnpm --dir e:/Боттинг/source/repos/Bot-Mox exec biome check bot-mox/src --max-diagnostics 5000` (frontend source baseline now clean: `Checked 428 files... No fixes applied`, zero errors)
43. `package.json` (`biome:check:mono` / `biome:write:mono` now target full `bot-mox/src` instead of selected folders)
44. `corepack pnpm --dir e:/Боттинг/source/repos/Bot-Mox run check:all:mono` (expanded mono gate re-verified green after full frontend scope switch; `Checked 509 files... No fixes applied`)
45. `package.json` (`biome:check:mono` / `biome:write:mono` now also validate `proxy-server/src`, keeping frontend quality gate aligned with full-stack mono checks)
46. `corepack pnpm --dir e:/Боттинг/source/repos/Bot-Mox run check:all:mono` (re-verified green with expanded backend-inclusive Biome scope; `Checked 614 files... No fixes applied`)

## Risks and Watchlist

1. Hidden dependencies on global CSS selectors can cause visual regressions during migration.
2. Mixed styling approaches (plain CSS + tokens + ad-hoc inline styles) can create inconsistent UI.
3. Background images can reduce text contrast if overlay defaults are weak.
4. Large uploads can create poor UX without size checks and pre-validation.

## Decisions Log

1. 2026-02-16: Background storage -> Supabase Storage.
2. 2026-02-16: V1 media -> images only.
3. 2026-02-16: Scope -> all frontend pages.

## Update Rules (Mandatory)

For every refactor PR:
1. Update task statuses in this file.
2. Add evidence paths (files changed + checks run).
3. If scope changed, update roadmap first, then this audit.
