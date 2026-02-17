# Frontend Refactor Audit (Evergreen)

Last updated (UTC): **2026-02-17T20:32:14Z**
Owner: Frontend/Platform
Source roadmap: `docs/plans/frontend-refactor-roadmap.md`

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

Date: 2026-02-17

1. `!important` count in frontend: **0**
2. Global `.ant-*` selectors in `bot-mox/src/styles/global.css`: **NO**
3. Theme runtime provider introduced and wired into app shell: **YES**
4. Theme visual background API + UI + shell layers: **YES**
5. Theme typography + shape (radius) persisted + applied: **YES**
6. VM domain components migrated to CSS Modules: **20** (`VMQueuePanel`, `VMOperationLog`, `VMSettingsForm`, `ProxmoxTab`, `ProjectResourcesSection`, `UnattendTab`, `PlaybookTab`, `ProxmoxSection`, `SshSection`, `ServiceUrlsSection`, `SecretField`, `SettingsActions`, `VMList`, `VMStatusBar`, `VMConfigPreview`, `VMServicesPanel`, `VMCommandPanel`, `VMListPage`, `VMsPage`, `VMServicePage`)
7. Remaining `.ant-*` selectors in CSS Modules: **0** (across **0** files)

## Target KPIs

1. `!important` count < 60 for first stabilization, < 20 final.
2. Zero broad global `.ant-*` overrides in shared global styles.
3. 100% of pages receive theme updates consistently via provider/tokens.
4. Background image mode can be enabled/disabled without UI breakage.
5. No regressions in light/dark readability on core workflows.

## Phase Board

## Phase 0 — Guardrails and Baseline

- [x] `GREEN` Add style debt guard checks (new global `.ant-*`, new `!important`, cap `.ant-*` selectors in CSS Modules).
- [ ] `TODO` Capture page-level visual baseline screenshots.
- [x] `GREEN` Create roadmap and evergreen audit docs.

Evidence:
1. `docs/plans/frontend-refactor-roadmap.md`
2. `docs/audits/frontend-refactor-audit.md`
3. `scripts/check-style-guardrails.js`
4. `package.json` (`check:styles:guardrails`, `check:all`)

## Phase 1 — Theme Core Consolidation

- [x] `GREEN` Introduce unified ThemeProvider for app-wide state.
- [x] `GREEN` Centralize token mapping for `ConfigProvider`.
- [x] `GREEN` Keep compatibility bridge for legacy CSS vars.
- [x] `GREEN` Add typography + shape (radius) settings to theme runtime and settings persistence.
- [ ] `WIP` Validate theme propagation on all pages.

Evidence:
1. `bot-mox/src/theme/themeRuntime.tsx`
2. `bot-mox/src/App.tsx`
3. `bot-mox/src/theme/themePalette.ts`
4. `bot-mox/src/services/themeService.ts`
5. `bot-mox/src/pages/settings/useThemeSettings.ts`
6. `bot-mox/src/pages/settings/ThemeSettingsPanel.tsx`
7. `proxy-server/src/contracts/schemas.js`

## Phase 2 — De-globalize Ant Overrides

- [x] `GREEN` Strip broad `.ant-*` component skinning from `global.css`.
- [x] `GREEN` Move base visuals to antd `token/components` config.
- [ ] `WIP` Re-scope unavoidable exceptions locally.

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

## Phase 3 — CSS Modules Migration (Domain by Domain)

- [ ] `WIP` Layout domain migration.
- [ ] `WIP` VM domain migration.
- [ ] `TODO` Resources domain migration.
- [ ] `WIP` Workspace domain migration.
- [ ] `WIP` Bot + Finance domain migration.

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
1. `npm run check:all` (pass)

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

- [ ] `WIP` Remove dead CSS and obsolete variables.
- [ ] `WIP` Final accessibility/contrast pass (focus-visible + keyboard navigation).
- [ ] `TODO` Final performance pass for background mode.
- [ ] `WIP` Update dev docs for adding new themed pages.

Evidence:
1. `bot-mox/src/components/notes/NotesComponents.module.css` (focus-within ring for contenteditable blocks)
2. `bot-mox/src/components/vm/VMQueuePanel.module.css` (focus-visible ring for queue inputs)
3. `bot-mox/src/components/bot/lifeStages/lifeStages.module.css` (removed empty placeholder classes)
4. `bot-mox/src/components/bot/lifeStages/StagePanels.tsx` (removed unused CSS module class hooks)
5. `bot-mox/src/components/bot/lifeStages/StageTimeline.tsx` (removed unused CSS module class hooks)
6. `bot-mox/src/components/vm/settingsForm/UnattendTab.module.css` (removed empty selector block)
7. `bot-mox/src/components/vm/settingsForm/UnattendTab.tsx` (removed unused CSS module class hook)
8. `bot-mox/src/components/bot/BotFinance.module.css` (removed comment-only marker class)
9. `bot-mox/src/components/bot/BotFinance.tsx` (removed unused CSS module class hook)
10. `docs/frontend/STYLING.md` (styling conventions + themed page + background-mode QA checklist)
11. `bot-mox/src/pages/project/columns.tsx` (keyboard-accessible table cell navigation)
12. `bot-mox/src/pages/project/ProjectPage.module.css` (focus-visible ring for cell links)
13. `bot-mox/src/components/vm/VMOperationLog.tsx` (dialog ARIA + Escape close + keyboard-accessible task rows)
14. `bot-mox/src/components/vm/VMOperationLog.module.css` (focus-visible ring for task rows)
15. `docs/DEV-WORKFLOW.md` (link to styling conventions)
16. `bot-mox/src/components/bot/lifeStages/lifeStages.module.css` (prefers-reduced-motion support)
17. `bot-mox/src/components/vm/VMOperationLog.tsx` (toolbar button semantics: type=button + aria-pressed)
18. `bot-mox/src/components/layout/resourceTree/parts.tsx` (button semantics: explicit type=button)
19. `bot-mox/src/components/schedule/DayTabs.tsx` (button semantics: explicit type=button)
20. `bot-mox/src/components/schedule/WeekOverview.tsx` (button semantics: explicit type=button)
21. `bot-mox/src/components/schedule/WeekPanel.tsx` (button semantics: explicit type=button)
22. `bot-mox/src/components/vm/VMCommandPanel.tsx` (button semantics: explicit type=button)
23. `bot-mox/src/components/vm/VMQueuePanel.tsx` (button semantics: explicit type=button)
24. `bot-mox/src/components/vm/VMStatusBar.tsx` (button semantics: explicit type=button)

Checks run (this batch):
1. `npm run check:all` (pass)

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
