# Task 14 - Global Layout-Reduction Audit and Scope Guard Validation

Date: 2026-03-02

## Audit scope

Target groups and files:

- settings: `apps/frontend/src/pages/settings/SettingsPage.module.css`
- project: `apps/frontend/src/pages/project/ProjectPage.module.css`
- datacenter: `apps/frontend/src/pages/datacenter/DatacenterPageLayout.module.css`, `apps/frontend/src/pages/datacenter/DatacenterPageMetrics.module.css`
- bot-profile (resource):
  - `apps/frontend/src/widgets/bot-profile/ui/proxy/proxy.module.css`
  - `apps/frontend/src/widgets/bot-profile/ui/license/license.module.css`
  - `apps/frontend/src/widgets/bot-profile/ui/subscription/subscription.module.css`
- bot-profile (non-resource):
  - `apps/frontend/src/widgets/bot-profile/ui/BotSummary.module.css`
  - `apps/frontend/src/widgets/bot-profile/ui/character/character.module.css`
  - `apps/frontend/src/widgets/bot-profile/ui/lifeStages/lifeStages.module.css`
  - `apps/frontend/src/widgets/bot-profile/ui/person/person.module.css`
  - `apps/frontend/src/widgets/bot-profile/ui/BotSchedule.module.css`
  - `apps/frontend/src/widgets/bot-profile/ui/BotVMInfo.module.css`

## Counting method

This audit uses the same group-specific layout-property regex patterns and baseline sources from prior evidence artifacts:

- settings baseline source: `.sisyphus/evidence/task-3-settings-css-density.txt`
  - regex: `display:\s*(flex|grid)|justify-content|align-items|\bgap\s*:|flex-direction|grid-template-columns`
- project baseline source: `.sisyphus/evidence/task-5-project-css-density.txt`
  - regex intent: `display|justify-content|align-items|flex-direction|gap`
  - baseline reconstruction is explicit from artifact evidence:
    - removed declarations: `headerContent(3) + headerTitle(3) + rowActions(2) + cellStack(3) = 11`
    - remaining count from artifact grep: `1`
    - baseline = `11 + 1 = 12`
- datacenter baseline source: `.sisyphus/evidence/task-7-datacenter-css-density.txt`
  - regex: `display:|justify-content:|align-items:|gap:|flex-direction:|flex-wrap:|grid-template-columns:`
- bot-profile resource baseline source: `.sisyphus/evidence/task-9-resource-css-density.txt`
  - regex: `display:\s*(flex|grid)|justify-content|align-items|\bgap\s*:|flex-direction|grid-template-columns`
- bot-profile non-resource baseline source: `.sisyphus/evidence/task-11-bot-profile-css-density.txt`
  - regex: `\b(display|flex-direction|justify-content|align-items|gap|grid-template(?:-columns|-rows)?|grid-auto-(?:columns|rows|flow))\s*:`

Current post-migration counts were re-verified with `grep` using these same patterns.

## Group audit table (before vs current)

| Group | Baseline before | Current after | Delta | Reduction |
|---|---:|---:|---:|---:|
| settings | 58 | 16 | -42 | 72.41% |
| project | 12 | 1 | -11 | 91.67% |
| datacenter | 78 | 62 | -16 | 20.51% |
| bot-profile (resource) | 61 | 17 | -44 | 72.13% |
| bot-profile (non-resource) | 190 | 52 | -138 | 72.63% |
| **TOTAL** | **399** | **148** | **-251** | **62.91%** |

Percent formula: `(before - after) / before * 100`, rounded to 2 decimals.

## Current count reproducibility notes

- settings grep result: `16` matches in `SettingsPage.module.css`
- project grep result: `1` match in `ProjectPage.module.css`
- datacenter grep result: `34` in `DatacenterPageLayout.module.css` and `28` in `DatacenterPageMetrics.module.css` (total `62`)
- bot-profile resource grep result: `17` in `proxy.module.css`; no matches in `license.module.css` and `subscription.module.css`
- bot-profile non-resource grep result: `18 + 16 + 10 + 6 + 1 + 1 = 52`

## Exclusion compliance (must remain unchanged)

Files validated unchanged:

- `apps/frontend/src/widgets/schedule/TimelineVisualizer.tsx`
- `apps/frontend/src/widgets/layout/ResourceTree.tsx`

Validation commands executed:

- `git status --short -- apps/frontend/src/widgets/schedule/TimelineVisualizer.tsx apps/frontend/src/widgets/layout/ResourceTree.tsx`
- `git diff --name-only -- apps/frontend/src/widgets/schedule/TimelineVisualizer.tsx apps/frontend/src/widgets/layout/ResourceTree.tsx`
- `git diff --cached --name-only -- apps/frontend/src/widgets/schedule/TimelineVisualizer.tsx apps/frontend/src/widgets/layout/ResourceTree.tsx`

All three commands returned empty output for these paths.

Scope guard proof file: `.sisyphus/evidence/task-14-scope-violation-error.txt`
