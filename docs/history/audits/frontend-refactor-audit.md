# Frontend Refactor Audit (Evergreen)

Last updated (UTC): **2026-02-19T18:23:56Z**
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

1. CSS files in frontend (`apps/frontend/src/**/*.css`): **66**
2. TSX files in frontend (`apps/frontend/src/**/*.tsx`): **151**
3. `!important` count in frontend: **242**
4. CSS import statements in frontend: **70**
5. CSS var usage count (`--boxmox/--proxmox/--font/--text/--spacing/--radius`): **1772**
6. Global ant overrides present in `apps/frontend/src/styles/global.css`: **YES**

## Current Snapshot (After This Batch)

Date: 2026-02-18

1. `!important` count in frontend: **0**
2. Global `.ant-*` selectors in `apps/frontend/src/styles/global.css`: **NO**
3. Theme runtime provider introduced and wired into app shell: **YES**
4. Theme visual background API + UI + shell layers: **YES**
5. Theme typography + shape (radius) persisted + applied: **YES**
6. VM domain components migrated to CSS Modules: **20** (`VMQueuePanel`, `VMOperationLog`, `VMSettingsForm`, `ProxmoxTab`, `ProjectResourcesSection`, `UnattendTab`, `PlaybookTab`, `ProxmoxSection`, `SshSection`, `ServiceUrlsSection`, `SecretField`, `SettingsActions`, `VMList`, `VMStatusBar`, `VMConfigPreview`, `VMServicesPanel`, `VMCommandPanel`, `VMListPage`, `VMsPage`, `VMServicePage`)
7. Remaining `.ant-*` selectors in CSS Modules: **0** (across **0** files)
8. ESLint guardrail: explicit button types enforced: **YES** (`react/button-has-type`)
9. Frontend-polish integration wave on enterprise branch: **COMPLETED** (merge + conflict resolution + mono gate green on renamed `apps/frontend`; graph parity check vs `frontend-polish` branch shows no missing polish-side commits)

## Target KPIs

1. `!important` count < 60 for first stabilization, < 20 final.
2. Zero broad global `.ant-*` overrides in shared global styles.
3. 100% of pages receive theme updates consistently via provider/tokens.
4. Background image mode can be enabled/disabled without UI breakage.
5. No regressions in light/dark readability on core workflows.

## Phase Board

## Phase 0 — Guardrails and Baseline

- [x] `GREEN` Add style debt guard checks (new global `.ant-*`, new `!important`, cap `.ant-*` selectors in CSS Modules).
- [x] `GREEN` Add lint guardrail: enforce explicit button types in React (`type="button"` when not submitting).
- [ ] `TODO` Capture page-level visual baseline screenshots.
- [x] `GREEN` Create roadmap and evergreen audit docs.

Evidence:
1. `docs/plans/frontend-refactor-roadmap.md`
2. `docs/audits/frontend-refactor-audit.md`
3. `scripts/check-style-guardrails.js`
4. `package.json` (`check:styles:guardrails`, `check:all`)
5. `apps/frontend/eslint.config.js` (`react/button-has-type`)
6. `apps/frontend/package.json` (`eslint-plugin-react`)

## Phase 1 — Theme Core Consolidation

- [x] `GREEN` Introduce unified ThemeProvider for app-wide state.
- [x] `GREEN` Centralize token mapping for `ConfigProvider`.
- [x] `GREEN` Keep compatibility bridge for legacy CSS vars.
- [x] `GREEN` Add typography + shape (radius) settings to theme runtime and settings persistence.
- [x] `GREEN` Validate theme propagation on all pages.

Evidence:
1. `apps/frontend/src/theme/themeRuntime.tsx`
2. `apps/frontend/src/App.tsx`
3. `apps/frontend/src/theme/themePalette.ts`
4. `apps/frontend/src/services/themeService.ts`
5. `apps/frontend/src/pages/settings/useThemeSettings.ts`
6. `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx`
7. `apps/backend-legacy/src/contracts/schemas.js`
8. `docs/audits/artifacts/frontend-baseline-2026-02-17/theme-propagation-report.json` (`panel` and `text` token values switch consistently between light/dark on all key routes)

## Phase 2 — De-globalize Ant Overrides

- [x] `GREEN` Strip broad `.ant-*` component skinning from `global.css`.
- [x] `GREEN` Move base visuals to antd `token/components` config.
- [x] `GREEN` Re-scope unavoidable exceptions locally.

Evidence:
1. `apps/frontend/src/styles/global.css`
2. `apps/frontend/src/theme/themeRuntime.tsx`
3. `apps/frontend/src/components/layout/Sidebar.tsx` (menu visuals via tokens + label wrappers; no `.ant-*` CSS)
4. `apps/frontend/src/components/layout/Sidebar.module.css` (no `.ant-*` overrides)
5. `apps/frontend/src/components/layout/Header.tsx` (theme switch visuals via props; no `.ant-*` CSS)
6. `apps/frontend/src/components/layout/Header.module.css` (no `.ant-*` overrides)
7. `apps/frontend/src/pages/settings/SettingsPage.module.css` (no `.ant-*` overrides; token-first)
8. `apps/frontend/src/pages/finance/FinancePage.module.css` (no `.ant-*` overrides; token-first)
9. `apps/frontend/src/pages/vms/VMsPage.module.css` (no `.ant-*` overrides; token-first)
10. `apps/frontend/src/pages/vms/DeleteVmModal.tsx` (Modal/Popover styles via props; no mask/root overrides)
11. `apps/frontend/src/pages/vms/page/VMPageModals.tsx` (Modal styles via props)
12. `apps/frontend/src/components/vm/VMQueuePanel.module.css` (no `.ant-*` overrides; token-first)
13. `apps/frontend/src/components/vm/VMList.module.css` (no `.ant-*` overrides)
14. `apps/frontend/src/components/vm/settingsForm/ProxmoxTab.module.css` (no `.ant-*` overrides)
15. `apps/frontend/src/components/vm/settingsForm/ProjectResourcesSection.module.css` (no `.ant-*` overrides)
16. `apps/frontend/src/pages/proxies/ProxiesPage.module.css` (no `.ant-*` overrides)
17. `apps/frontend/src/pages/proxies/proxyColumns.tsx` (cell layouts via local classes; no `.ant-*` CSS)
18. `apps/frontend/src/components/bot/account/account.module.css` (no `.ant-*` overrides)
19. `apps/frontend/src/components/bot/account/state-sections.tsx` (Alert/Card visuals via props; no `.ant-*` CSS)
20. `apps/frontend/src/components/bot/account/modals.tsx` (Modal visuals via props; no `.ant-*` CSS)
21. `apps/frontend/src/components/bot/character/character.module.css` (no `.ant-*` overrides)
22. `apps/frontend/src/components/bot/BotCharacter.tsx` (Card header + incomplete indicator via local markup)
23. `apps/frontend/src/components/bot/character/CharacterEditForm.tsx` (Alert visuals via props; responsive cols)
24. `apps/frontend/src/components/subscriptions/SubscriptionForm.module.css` (no `.ant-*` overrides)
25. `apps/frontend/src/components/subscriptions/SubscriptionForm.tsx` (Select option content via local markup; no `.ant-*` CSS)
26. `apps/frontend/src/components/ui/TableActionButton.module.css` (no `.ant-*` overrides)
27. `apps/frontend/src/components/schedule/SessionEditor.tsx` (Modal visuals via tokens/props; no `.ant-*` CSS)
28. `apps/frontend/src/components/finance/TransactionForm.tsx` (Modal + form visuals via tokens/props; no `.ant-*` CSS)
29. `apps/frontend/src/components/ui/LoadingState.module.css` (removed local Skeleton `.ant-*` overrides; token-first defaults)
30. `apps/frontend/src/pages/dashboard/index.tsx` + `apps/frontend/src/pages/dashboard/Dashboard.module.css` (Card/Table styles via component props + local classes; removed `.ant-*`/`!important`)
31. `apps/frontend/src/pages/subscriptions/index.tsx` + `apps/frontend/src/pages/subscriptions/subscription-columns.tsx` + `apps/frontend/src/pages/subscriptions/SubscriptionsPage.module.css` + `apps/frontend/src/pages/subscriptions/ExpiringSubscriptionsAlert.tsx` + `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx` (removed page-level `.ant-*` overrides; table/alert/typography styling moved to props + local classes)
32. `apps/frontend/src/components/bot/license/license.module.css` + `apps/frontend/src/components/bot/license/LicenseViews.tsx` + `apps/frontend/src/components/bot/license/LicenseFormModal.tsx` + `apps/frontend/src/components/bot/license/AssignLicenseModal.tsx` (removed all local `.ant-*` overrides from license domain; card/modal theming moved to component `styles`/local classes)
33. `apps/frontend/src/components/bot/BotFinance.module.css` + `apps/frontend/src/components/bot/BotFinance.tsx` (removed all local `.ant-*` overrides from bot finance module; Statistic/Table/Card styling moved to component props + local classes)
34. `apps/frontend/src/components/notes/NotesComponents.module.css` + `apps/frontend/src/components/notes/NoteEditor.tsx` + `apps/frontend/src/components/notes/NoteSidebar.tsx` + `apps/frontend/src/components/notes/CheckboxBlock.tsx` (removed all `.ant-*` selectors from notes styling; editor mode/sidebar/checkbox styling moved to local classes and component props)
35. `apps/frontend/src/components/bot/person/person.module.css` + `apps/frontend/src/components/bot/BotPerson.tsx` + `apps/frontend/src/components/bot/person/PersonCardStates.tsx` + `apps/frontend/src/components/bot/person/PersonFormFields.tsx` (removed all `.ant-*` selectors from person module; card/alert/input/select styling moved to local classes + component props)
36. `apps/frontend/src/components/bot/BotSummary.module.css` + `apps/frontend/src/components/bot/summary/sections-overview.tsx` + `apps/frontend/src/components/bot/summary/sections-details.tsx` (removed all `.ant-*` selectors from bot summary module; Card/Tag styles moved to component props; dead unused summary CSS blocks removed)
37. `apps/frontend/src/pages/datacenter/DatacenterPage.module.css` + `apps/frontend/src/pages/datacenter/content-map-sections.tsx` + `apps/frontend/src/pages/datacenter/content-map-sections-secondary.tsx` (removed all `.ant-*` selectors from datacenter page styles; deleted unused legacy datacenter block; map-card body spacing moved to `Card.styles`)
38. `apps/frontend/src/components/bot/BotSchedule.module.css` + `apps/frontend/src/components/bot/BotSchedule.tsx` (removed all `.ant-*` selectors from bot schedule module; card header/button/alert visuals moved to component `styles` + local classes)
39. `apps/frontend/src/components/bot/lifeStages/lifeStages.module.css` + `apps/frontend/src/components/bot/BotLifeStages.tsx` + `apps/frontend/src/components/bot/lifeStages/StagePanels.tsx` + `apps/frontend/src/components/bot/lifeStages/StageTimeline.tsx` (removed all `.ant-*` selectors from life stages module; Card/Statistic/Timeline/button styling moved to component props + local classes; responsive width hack replaced by responsive `Col` props)
40. `apps/frontend/src/pages/project/ProjectPage.module.css` + `apps/frontend/src/pages/project/index.tsx` + `apps/frontend/src/pages/project/columns.tsx` (removed all `.ant-*` selectors from project page; table header/body styling moved to column/table classes, filter controls moved to local classes, status tags styled via explicit class)
41. `apps/frontend/src/pages/licenses/LicensesPage.module.css` + `apps/frontend/src/pages/licenses/index.tsx` + `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx` (removed all `.ant-*` selectors from licenses page; table styles moved to column/table classes, filter/header/tag styles moved to local classes)
42. `apps/frontend/src/components/finance/FinanceTransactions.module.css` + `apps/frontend/src/components/finance/FinanceTransactions.tsx` (removed all `.ant-*` selectors from finance transactions module; table header/body styling moved to column/table classes, card body spacing moved to `Card.styles`, filter controls moved to local classes)
43. `apps/frontend/src/components/bot/proxy/proxy.module.css` + `apps/frontend/src/components/bot/proxy/ProxyDetailsCard.tsx` + `apps/frontend/src/components/bot/proxy/ProxyEmptyCard.tsx` + `apps/frontend/src/components/bot/proxy/ProxyEditorModal.tsx` (removed all `.ant-*` selectors from bot proxy module; Card/Modal header visuals moved to component `styles`, dead/unused proxy CSS overrides removed)
44. `apps/frontend/src/components/bot/subscription/subscription.module.css` + `apps/frontend/src/components/bot/BotSubscription.tsx` + `apps/frontend/src/components/bot/subscription/SubscriptionAlerts.tsx` (removed all `.ant-*` selectors from bot subscription module; Card body/header and list item visuals moved to `Card.styles` + local classes; dead subscription help CSS removed)
45. `apps/frontend/src/pages/workspace/calendar/WorkspaceCalendarPage.module.css` + `apps/frontend/src/pages/workspace/calendar/index.tsx` + `apps/frontend/src/pages/workspace/calendar/page/CalendarMainPanel.tsx` + `apps/frontend/src/pages/workspace/calendar/page/CalendarEventList.tsx` (removed all `.ant-*` selectors from workspace calendar page; calendar month cells moved to local `fullCellRender`, Card/list/divider visuals moved to component props + local classes)
46. `apps/frontend/src/components/bot/BotLeveling.module.css` + `apps/frontend/src/components/bot/BotLeveling.tsx` (removed all `.ant-*` selectors from bot leveling module; Statistic title/content and Card header/body visuals moved to local classes + component props)
47. `apps/frontend/src/components/finance/FinanceSummary.module.css` + `apps/frontend/src/components/finance/FinanceSummary.tsx` + `apps/frontend/src/components/finance/ProjectPerformanceTable.tsx` (removed all `.ant-*` selectors from finance summary module; metric/table visuals moved to local classes + component props)
48. `apps/frontend/src/components/bot/BotFarm.module.css` + `apps/frontend/src/components/bot/BotFarm.tsx` (removed all `.ant-*` selectors from bot farm module; Statistic title/content and Inventory Card header/body visuals moved to local classes + component props)
49. `apps/frontend/src/components/schedule/ScheduleGenerator.module.css` + `apps/frontend/src/components/schedule/ScheduleGenerator.tsx` (removed all `.ant-*` selectors from schedule generator module; Form/List/Button visuals moved to local classes + component props; removed local `!important` overrides)
50. `apps/frontend/src/components/schedule/SessionList.module.css` + `apps/frontend/src/components/schedule/SessionList.tsx` (removed all `.ant-*` selectors from session list module; switch/button visuals moved to component props + local classes)
51. `apps/frontend/src/components/schedule/WeekOverview.module.css` (removed unused `week-overview-actions` block and all local `.ant-*` overrides)
52. `apps/frontend/src/components/finance/UniversalChart.module.css` + `apps/frontend/src/components/finance/UniversalChart.tsx` (removed local `.ant-*` overrides from chart card extra button; moved to local class on the settings button)
53. `apps/frontend/src/pages/notes/NotesPage.module.css` (removed local `.ant-empty-description` override; empty-state color moved to local description wrapper class)
54. `apps/frontend/src/pages/bot/BotPage.module.css` + `apps/frontend/src/pages/bot/page/sections.tsx` (removed all `.ant-collapse*` selectors from bot page styles; collapse panel visuals moved to item-level `styles` + local item classes)
55. `apps/frontend/src/components/bot/BotProfession.module.css` + `apps/frontend/src/components/bot/BotProfession.tsx` (removed all `.ant-*` selectors from bot profession module; Card header/body and typography visuals moved to local classes + `Card.styles`)
56. `apps/frontend/src/components/ui/MetricCard.module.css` + `apps/frontend/src/components/ui/MetricCard.tsx` (removed all `.ant-*` selectors and local `!important` overrides; Card/Progress visuals moved to component props)
57. `apps/frontend/src/pages/workspace/kanban/WorkspaceKanbanPage.module.css` + `apps/frontend/src/pages/workspace/kanban/index.tsx` (removed all `.ant-*` selectors and local `!important` overrides; card body/title icon visuals moved to component props + local wrappers)
58. `apps/frontend/src/components/bot/BotLogs.module.css` + `apps/frontend/src/components/bot/BotLogs.tsx` + `apps/frontend/src/components/bot/BotVMInfo.module.css` + `apps/frontend/src/components/bot/BotVMInfo.tsx` (removed all `.ant-*` selectors from bot logs/vm-info modules; Card header/title visuals moved to component props + local classes)
59. `apps/frontend/src/components/notes/NotesComponents.module.css` (removed remaining local `!important` overrides in notes module)
60. `apps/frontend/src/pages/datacenter/DatacenterPage.module.css` (removed local `!important` overrides in content map title/toggle styles)
61. `apps/frontend/src/components/finance/FinanceCommon.module.css` + `apps/frontend/src/components/vm/VMOperationLog.module.css` + `apps/frontend/src/components/vm/settingsForm/UnattendTab.module.css` + `apps/frontend/src/pages/vms/VMsPage.module.css` (removed remaining local `!important` overrides in VM/Finance shared styles)
62. `apps/frontend/src/components/bot/BotFinance.tsx` + `apps/frontend/src/components/bot/lifeStages/StagePanels.tsx` + `apps/frontend/src/components/bot/person/PersonCardStates.tsx` + `apps/frontend/src/pages/subscriptions/ExpiringSubscriptionsAlert.tsx` (fixed antd API compatibility after refactor: replaced unsupported `Statistic.titleStyle`/`Alert.styles` usage with supported props/markup)

## Phase 3 — CSS Modules Migration (Domain by Domain)

- [x] `GREEN` Layout domain migration.
- [x] `GREEN` VM domain migration.
- [x] `GREEN` Resources domain migration.
- [x] `GREEN` Workspace domain migration.
- [x] `GREEN` Bot + Finance domain migration.

Evidence (Layout):
1. `apps/frontend/src/components/layout/Header.tsx`
2. `apps/frontend/src/components/layout/Header.module.css`
3. `apps/frontend/src/components/layout/Sidebar.tsx`
4. `apps/frontend/src/components/layout/Sidebar.module.css`
5. `apps/frontend/src/components/layout/ContentPanel.tsx`
6. `apps/frontend/src/components/layout/ContentPanel.module.css`
7. `apps/frontend/src/components/layout/ResourceTree.tsx`
8. `apps/frontend/src/components/layout/ResourceTree.module.css`
9. `apps/frontend/src/components/layout/resourceTree/parts.tsx`
10. `apps/frontend/src/pages/login/index.tsx`
11. `apps/frontend/src/pages/login/LoginPage.module.css`
12. `apps/frontend/src/pages/settings/SettingsPage.tsx`
13. `apps/frontend/src/pages/settings/SettingsPage.module.css`
14. `apps/frontend/src/pages/settings/SettingsSections.tsx`
15. `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx`
16. `apps/frontend/src/pages/dashboard/index.tsx`
17. `apps/frontend/src/pages/dashboard/Dashboard.module.css`
18. `apps/frontend/src/pages/datacenter/index.tsx`
19. `apps/frontend/src/pages/datacenter/DatacenterPage.module.css`
20. `apps/frontend/src/pages/datacenter/content-map.tsx`
21. `apps/frontend/src/pages/datacenter/content-map-sections.tsx`
22. `apps/frontend/src/pages/datacenter/content-map-sections-secondary.tsx`

Evidence (VM):
1. `apps/frontend/src/pages/vms/VMsPage.tsx`
2. `apps/frontend/src/pages/vms/VMsPage.module.css`
3. `apps/frontend/src/pages/vms/page/VMPageModals.tsx`
4. `apps/frontend/src/pages/vms/DeleteVmModal.tsx`
5. `apps/frontend/src/components/vm/VMQueuePanel.tsx`
6. `apps/frontend/src/components/vm/VMQueuePanel.module.css`
7. `apps/frontend/src/components/vm/VMOperationLog.tsx`
8. `apps/frontend/src/components/vm/VMOperationLog.module.css`
9. `apps/frontend/src/components/vm/VMSettingsForm.tsx`
10. `apps/frontend/src/components/vm/VMSettingsForm.module.css`
11. `apps/frontend/src/components/vm/settingsForm/ProxmoxTab.tsx`
12. `apps/frontend/src/components/vm/settingsForm/ProxmoxTab.module.css`
13. `apps/frontend/src/components/vm/settingsForm/ProjectResourcesSection.tsx`
14. `apps/frontend/src/components/vm/settingsForm/ProjectResourcesSection.module.css`
15. `apps/frontend/src/components/vm/settingsForm/UnattendTab.tsx`
16. `apps/frontend/src/components/vm/settingsForm/UnattendTab.module.css`
17. `apps/frontend/src/components/vm/settingsForm/PlaybookTab.tsx`
18. `apps/frontend/src/components/vm/settingsForm/PlaybookTab.module.css`
19. `apps/frontend/src/components/vm/settingsForm/SettingsSectionLayout.module.css`
20. `apps/frontend/src/components/vm/settingsForm/ProxmoxSection.tsx`
21. `apps/frontend/src/components/vm/settingsForm/SshSection.tsx`
22. `apps/frontend/src/components/vm/settingsForm/ServiceUrlsSection.tsx`
23. `apps/frontend/src/components/vm/settingsForm/SecretField.tsx`
24. `apps/frontend/src/components/vm/settingsForm/SettingsActions.tsx`
25. `apps/frontend/src/components/vm/VMList.tsx`
26. `apps/frontend/src/components/vm/VMList.module.css`
27. `apps/frontend/src/components/vm/VMStatusBar.tsx`
28. `apps/frontend/src/components/vm/VMStatusBar.module.css`
29. `apps/frontend/src/components/vm/VMConfigPreview.tsx`
30. `apps/frontend/src/components/vm/VMConfigPreview.module.css`
31. `apps/frontend/src/components/vm/VMServicesPanel.tsx`
32. `apps/frontend/src/components/vm/VMServicesPanel.module.css`
33. `apps/frontend/src/components/vm/VMCommandPanel.tsx`
34. `apps/frontend/src/components/vm/VMCommandPanel.module.css`
35. `apps/frontend/src/pages/vms/VMListPage.tsx`
36. `apps/frontend/src/pages/vms/VMListPage.module.css`
37. `apps/frontend/src/pages/vms/VMServicePage.tsx`
38. `apps/frontend/src/pages/vms/VMServicePage.module.css`

Evidence (Bot + Finance + Project):
1. `apps/frontend/src/pages/bot/index.tsx`
2. `apps/frontend/src/pages/bot/BotPage.module.css`
3. `apps/frontend/src/pages/bot/page/sections.tsx`
4. `apps/frontend/src/pages/bot/page/states.tsx`
5. `apps/frontend/src/pages/finance/index.tsx`
6. `apps/frontend/src/pages/finance/FinancePage.module.css`
7. `apps/frontend/src/pages/project/index.tsx`
8. `apps/frontend/src/pages/project/columns.tsx`
9. `apps/frontend/src/pages/project/ProjectPage.module.css`
10. `apps/frontend/src/components/bot/BotSchedule.tsx`
11. `apps/frontend/src/components/bot/BotSchedule.module.css`
12. `apps/frontend/src/components/bot/BotSummary.tsx`
13. `apps/frontend/src/components/bot/BotSummary.module.css`
14. `apps/frontend/src/components/bot/summary/sections-overview.tsx`
15. `apps/frontend/src/components/bot/summary/sections-details.tsx`
16. `apps/frontend/src/components/bot/summary/stat-item.tsx`
17. `apps/frontend/src/components/bot/BotVMInfo.tsx`
18. `apps/frontend/src/components/bot/BotVMInfo.module.css`
19. `apps/frontend/src/components/bot/BotLogs.tsx`
20. `apps/frontend/src/components/bot/BotLogs.module.css`
21. `apps/frontend/src/components/bot/BotFinance.tsx`
22. `apps/frontend/src/components/bot/BotFinance.module.css`
23. `apps/frontend/src/components/bot/BotProxy.tsx`
24. `apps/frontend/src/components/bot/proxy/proxy.module.css`
25. `apps/frontend/src/components/bot/proxy/ProxyDetailsCard.tsx`
26. `apps/frontend/src/components/bot/proxy/ProxyEditorModal.tsx`
27. `apps/frontend/src/components/bot/proxy/ProxyEmptyCard.tsx`
28. `apps/frontend/src/components/bot/proxy/ProxyIpqsResults.tsx`
29. `apps/frontend/src/components/bot/proxy/ProxyStatusAlert.tsx`
30. `apps/frontend/src/components/bot/BotLicense.tsx`
31. `apps/frontend/src/components/bot/license/license.module.css`
32. `apps/frontend/src/components/bot/license/LicenseViews.tsx`
33. `apps/frontend/src/components/bot/BotSubscription.tsx`
34. `apps/frontend/src/components/bot/subscription/subscription.module.css`
35. `apps/frontend/src/components/bot/subscription/SubscriptionAlerts.tsx`
36. `apps/frontend/src/components/bot/subscription/SubscriptionListItem.tsx`
37. `apps/frontend/src/components/bot/BotPerson.tsx`
38. `apps/frontend/src/components/bot/person/person.module.css`
39. `apps/frontend/src/components/bot/person/PersonCardStates.tsx`
40. `apps/frontend/src/components/bot/person/PersonFormFields.tsx`
41. `apps/frontend/src/components/bot/BotProfession.tsx`
42. `apps/frontend/src/components/bot/BotProfession.module.css`
43. `apps/frontend/src/components/bot/BotLeveling.tsx`
44. `apps/frontend/src/components/bot/BotLeveling.module.css`
45. `apps/frontend/src/components/bot/BotFarm.tsx`
46. `apps/frontend/src/components/bot/BotFarm.module.css`
47. `apps/frontend/src/components/bot/BotLifeStages.tsx`
48. `apps/frontend/src/components/bot/lifeStages/lifeStages.module.css`
49. `apps/frontend/src/components/bot/lifeStages/StagePanels.tsx`
50. `apps/frontend/src/components/bot/lifeStages/StageTimeline.tsx`
51. `apps/frontend/src/components/bot/lifeStages/SimpleBarChart.tsx`
52. `apps/frontend/src/components/bot/BotCharacter.tsx`
53. `apps/frontend/src/components/bot/character/character.module.css`
54. `apps/frontend/src/components/bot/character/CharacterEditForm.tsx`

Evidence (Workspace - Notes):
1. `apps/frontend/src/components/notes/NotesComponents.module.css`
2. `apps/frontend/src/components/notes/NoteEditor.tsx`
3. `apps/frontend/src/components/notes/NoteSidebar.tsx`
4. `apps/frontend/src/components/notes/BlockEditor.tsx`
5. `apps/frontend/src/components/notes/SlashCommandMenu.tsx`
6. `apps/frontend/src/components/notes/ListBlock.tsx`
7. `apps/frontend/src/components/notes/CheckboxBlock.tsx`

Evidence (Theme Consistency - Typography Tokens):
1. `apps/frontend/src/theme/themeRuntime.tsx`

Evidence (Hardening - Lint Warnings Removed):
1. `apps/frontend/src/pages/vms/VMsPage.tsx`
2. `apps/frontend/src/services/vmOpsEventsService.ts`
55. `apps/frontend/src/components/bot/character/CharacterViewMode.tsx`
56. `apps/frontend/src/components/bot/character/CharacterStateCards.tsx`
57. `apps/frontend/src/components/bot/BotAccount.tsx`
58. `apps/frontend/src/components/bot/account/account.module.css`
59. `apps/frontend/src/components/bot/account/state-sections.tsx`
60. `apps/frontend/src/components/bot/account/credentials-sections.tsx`
61. `apps/frontend/src/components/bot/account/generator-sections.tsx`
62. `apps/frontend/src/components/bot/account/modals.tsx`

Evidence (Resources + Workspace pages):
1. `apps/frontend/src/pages/licenses/index.tsx`
2. `apps/frontend/src/pages/licenses/LicensesPage.module.css`
3. `apps/frontend/src/pages/licenses/page/LicensesStats.tsx`
4. `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx`
5. `apps/frontend/src/pages/subscriptions/index.tsx`
6. `apps/frontend/src/pages/subscriptions/SubscriptionsPage.module.css`
7. `apps/frontend/src/pages/subscriptions/ExpiringSubscriptionsAlert.tsx`
8. `apps/frontend/src/pages/subscriptions/SubscriptionsStats.tsx`
9. `apps/frontend/src/pages/proxies/ProxiesPage.tsx`
10. `apps/frontend/src/pages/proxies/ProxiesPage.module.css`
11. `apps/frontend/src/pages/proxies/proxyColumns.tsx`
12. `apps/frontend/src/pages/notes/index.tsx`
13. `apps/frontend/src/pages/notes/NotesPage.module.css`
14. `apps/frontend/src/pages/workspace/calendar/index.tsx`
15. `apps/frontend/src/pages/workspace/calendar/WorkspaceCalendarPage.module.css`
16. `apps/frontend/src/pages/workspace/calendar/page/CalendarMainPanel.tsx`
17. `apps/frontend/src/pages/workspace/calendar/page/CalendarEventList.tsx`
18. `apps/frontend/src/pages/workspace/kanban/index.tsx`
19. `apps/frontend/src/pages/workspace/kanban/WorkspaceKanbanPage.module.css`
20. `apps/frontend/src/components/subscriptions/SubscriptionForm.tsx`
21. `apps/frontend/src/components/subscriptions/SubscriptionForm.module.css`

Evidence (UI components):
1. `apps/frontend/src/components/ui/LoadingState.tsx`
2. `apps/frontend/src/components/ui/LoadingState.module.css`
3. `apps/frontend/src/components/ui/MetricCard.tsx`
4. `apps/frontend/src/components/ui/MetricCard.module.css`
5. `apps/frontend/src/components/ui/StatusBadge.tsx`
6. `apps/frontend/src/components/ui/StatusBadge.module.css`
7. `apps/frontend/src/components/ui/TableActionButton.tsx`
8. `apps/frontend/src/components/ui/TableActionButton.module.css`

Evidence (Schedule components):
1. `apps/frontend/src/components/schedule/ScheduleGenerator.tsx`
2. `apps/frontend/src/components/schedule/ScheduleGenerator.module.css`
3. `apps/frontend/src/components/schedule/TimelineVisualizer.tsx`
4. `apps/frontend/src/components/schedule/TimelineVisualizer.module.css`
5. `apps/frontend/src/components/schedule/timeline/TimelineHeader.tsx`
6. `apps/frontend/src/components/schedule/timeline/TimelineScale.tsx`
7. `apps/frontend/src/components/schedule/WeekOverview.tsx`
8. `apps/frontend/src/components/schedule/WeekOverview.module.css`
9. `apps/frontend/src/components/schedule/WeekPanel.tsx`
10. `apps/frontend/src/components/schedule/WeekPanel.module.css`
11. `apps/frontend/src/components/schedule/SessionList.tsx`
12. `apps/frontend/src/components/schedule/SessionList.module.css`
13. `apps/frontend/src/components/schedule/SessionEditor.tsx`
14. `apps/frontend/src/components/schedule/SessionEditor.module.css`
15. `apps/frontend/src/components/schedule/DayTabs.tsx`
16. `apps/frontend/src/components/schedule/DayTabs.module.css`
17. `apps/frontend/src/components/schedule/DayStats.tsx`
18. `apps/frontend/src/components/schedule/DayStats.module.css`

Evidence (Finance components):
1. `apps/frontend/src/components/finance/FinanceCommon.module.css`
2. `apps/frontend/src/components/finance/FinanceSummary.tsx`
3. `apps/frontend/src/components/finance/FinanceSummary.module.css`
4. `apps/frontend/src/components/finance/ProjectPerformanceTable.tsx`
5. `apps/frontend/src/components/finance/CostAnalysis.tsx`
6. `apps/frontend/src/components/finance/FinanceTransactions.tsx`
7. `apps/frontend/src/components/finance/FinanceTransactions.module.css`
8. `apps/frontend/src/components/finance/UniversalChart.tsx`
9. `apps/frontend/src/components/finance/UniversalChart.module.css`
10. `apps/frontend/src/components/finance/GoldPriceChart.tsx`
11. `apps/frontend/src/components/finance/GoldPriceChart.module.css`
12. `apps/frontend/src/components/finance/TransactionForm.tsx`
13. `apps/frontend/src/components/finance/TransactionForm.module.css`

Checks run (this batch):
1. `npm run check:all` (pass)

## Phase 4 — Visual Background Theme (Anime/Art)

- [x] `GREEN` Add backend schema extension (`settings/theme.visual`).
- [x] `GREEN` Add image asset metadata table and migration.
- [x] `GREEN` Add theme-assets upload/list/delete API.
- [x] `GREEN` Add settings UI for upload/select/background controls.
- [x] `GREEN` Add shell background layer with overlay/blur/dim.
- [x] `GREEN` Add runtime rollback switch.

Evidence:
1. `apps/backend-legacy/src/contracts/schemas.js`
2. `supabase/migrations/20260216001000_create_theme_background_assets.sql`
3. `apps/backend-legacy/src/modules/theme-assets/service.js`
4. `apps/backend-legacy/src/modules/v1/theme-assets.routes.js`
5. `apps/backend-legacy/src/modules/v1/index.js`
6. `apps/frontend/src/services/themeAssetsService.ts`
7. `apps/frontend/src/pages/settings/ThemeSettingsPanel.tsx`
8. `apps/frontend/src/pages/settings/useThemeSettings.ts`
9. `apps/frontend/src/App.tsx`

## Phase 5 — Hardening and Cleanup

- [x] `GREEN` Remove dead CSS and obsolete variables.
- [x] `GREEN` Final accessibility/contrast pass (focus-visible + keyboard navigation).
- [x] `GREEN` Final performance pass for background mode.
- [x] `GREEN` Update dev docs for adding new themed pages.

Evidence:
1. `apps/frontend/src/components/notes/NotesComponents.module.css` (focus-within ring for contenteditable blocks)
2. `apps/frontend/src/components/vm/VMQueuePanel.module.css` (focus-visible ring for queue inputs)
3. `apps/frontend/src/components/bot/lifeStages/lifeStages.module.css` (removed empty placeholder classes)
4. `apps/frontend/src/components/bot/lifeStages/StagePanels.tsx` (removed unused CSS module class hooks)
5. `apps/frontend/src/components/bot/lifeStages/StageTimeline.tsx` (removed unused CSS module class hooks)
6. `apps/frontend/src/components/vm/settingsForm/UnattendTab.module.css` (removed empty selector block)
7. `apps/frontend/src/components/vm/settingsForm/UnattendTab.tsx` (removed unused CSS module class hook)
8. `apps/frontend/src/components/bot/BotFinance.module.css` (removed comment-only marker class)
9. `apps/frontend/src/components/bot/BotFinance.tsx` (removed unused CSS module class hook)
10. `docs/frontend/STYLING.md` (styling conventions + themed page + background-mode QA checklist)
11. `apps/frontend/src/pages/project/columns.tsx` (keyboard-accessible table cell navigation)
12. `apps/frontend/src/pages/project/ProjectPage.module.css` (focus-visible ring for cell links)
13. `apps/frontend/src/components/vm/VMOperationLog.tsx` (dialog ARIA + Escape close + keyboard-accessible task open controls)
14. `apps/frontend/src/components/vm/VMOperationLog.module.css` (focus-visible ring for task rows)
15. `docs/DEV-WORKFLOW.md` (link to styling conventions)
16. `apps/frontend/src/components/bot/lifeStages/lifeStages.module.css` (prefers-reduced-motion support)
17. `apps/frontend/src/components/vm/VMOperationLog.tsx` (toolbar button semantics: type=button + aria-pressed)
18. `apps/frontend/src/components/layout/resourceTree/parts.tsx` (button semantics: explicit type=button)
19. `apps/frontend/src/components/schedule/DayTabs.tsx` (button semantics: explicit type=button)
20. `apps/frontend/src/components/schedule/WeekOverview.tsx` (button semantics: explicit type=button)
21. `apps/frontend/src/components/schedule/WeekPanel.tsx` (button semantics: explicit type=button)
22. `apps/frontend/src/components/vm/VMCommandPanel.tsx` (button semantics: explicit type=button)
23. `apps/frontend/src/components/vm/VMQueuePanel.tsx` (button semantics: explicit type=button)
24. `apps/frontend/src/components/vm/VMStatusBar.tsx` (button semantics: explicit type=button)
25. `apps/frontend/src/App.tsx` (background mode: memoized inline styles to reduce redundant DOM updates)
26. `apps/frontend/src/AppShell.module.css` (background mode: contain + will-change hints for blur/overlay layers)
27. `scripts/report-unused-css-module-classes.js` (dead CSS: report-only helper for finding unused CSS module classes)
28. `apps/frontend/src/pages/settings/SettingsPage.module.css` (dead CSS: removed unused selector)
29. `apps/frontend/src/components/schedule/WeekOverview.module.css` (dead CSS: removed unused selector)
30. `apps/frontend/src/components/schedule/TimelineVisualizer.module.css` (dead CSS: removed unused selector)
31. `apps/frontend/src/components/bot/account/account.module.css` (dead CSS: removed unused selector)
32. `apps/frontend/src/components/bot/BotSummary.module.css` (dead CSS: removed unused selector)
33. `apps/frontend/src/components/schedule/SessionList.module.css` (dead CSS: removed unused selectors)
34. `apps/frontend/src/components/bot/character/character.module.css` (dead CSS: removed unused selectors)
35. `apps/frontend/src/components/bot/proxy/proxy.module.css` (dead CSS: removed unused selectors)
36. `apps/frontend/src/components/bot/subscription/subscription.module.css` (dead CSS: removed unused selectors)
37. `apps/frontend/src/pages/datacenter/DatacenterPage.module.css` (dead CSS: removed unused selectors)
38. `.gitignore` (ignore local audit scratch report)
39. `apps/frontend/src/pages/bot/BotPage.module.css` (dead CSS: removed unused selector group)
40. `scripts/report-unused-css-module-classes.js` (dead CSS: improved report to ignore :global selectors and template-string modifier usage)
41. `apps/frontend/src/components/notes/NotesComponents.module.css` (dead CSS: removed unused markdown preview/splitview styles)
42. `apps/frontend/src/components/vm/VMOperationLog.module.css` (dead CSS: removed unused selector)
43. `apps/frontend/src/pages/vms/VMsPage.module.css` (dead CSS: removed unused selector)
44. `apps/frontend/src/components/layout/ResourceTree.tsx` (a11y: keyboard-accessible resizer + ARIA separator semantics)
45. `apps/frontend/src/components/layout/ResourceTree.module.css` (a11y: focus-visible and hover affordance for resizer handle)
46. `apps/frontend/src/components/bot/summary/sections-details.tsx` (a11y: status summary cards use native button semantics)
47. `apps/frontend/src/components/bot/BotSummary.module.css` (a11y: focus-visible states for interactive summary cards)
48. `docs/frontend/STYLING.md` (new-page skeleton + regression matrix for themed pages)
49. `docs/DEV-WORKFLOW.md` (explicit frontend checklist reference for every page change)
50. `apps/frontend/src/components/notes/CheckboxBlock.tsx` (a11y: remove interactive wrapper click handler; handle checkbox click on native control)
51. `apps/frontend/src/components/bot/summary/sections-details.tsx` (a11y: remove `role="button"` cards; explicit action buttons in card headers)
52. `apps/frontend/src/components/bot/BotSummary.tsx` (a11y: remove obsolete keyboard-activation prop from configure section wiring)
53. `apps/frontend/src/components/vm/VMOperationLog.tsx` (a11y: replace clickable task rows with native task open buttons)
54. `apps/frontend/src/components/vm/VMOperationLog.module.css` (a11y: focus-visible and hover states for task open buttons)

Checks run (this batch):
1. `npm run check:all` (pass)
2. `node scripts/report-unused-css-module-classes.js` (pass: no obvious unused CSS module classes)

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
