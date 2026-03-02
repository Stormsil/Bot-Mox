# Task 1 Policy Contract: AntD Import Boundary Baseline

## Baseline Artifacts (immutable snapshot)
- Prefix baseline: `.sisyphus/evidence/task-1-prefix-baseline.txt` (`1457` lines)
- AntD import baseline: `.sisyphus/evidence/task-1-antd-baseline.txt` (`191` lines)
- Color literal baseline: `.sisyphus/evidence/task-1-color-baseline.txt` (`302` lines)

## Business-Layer Direct AntD Context (contract input)
- Verification command executed on `pages/widgets/features/entities`: `pnpm exec rg --glob "*.tsx" "from ['\"]antd['\"]" apps/frontend/src/pages apps/frontend/src/widgets apps/frontend/src/features apps/frontend/src/entities`
- Current direct-import footprint (content search):
  - `pages`: `57` matches in `46` files
  - `widgets`: `113` matches in `102` files
  - `features`: `9` matches in `9` files
  - `entities`: `0` matches
- High-density hotspots (examples):
  - `apps/frontend/src/widgets/bot-profile/ui/BotProxy.tsx`
  - `apps/frontend/src/widgets/vm/settingsForm/PlaybookTab.tsx`
  - `apps/frontend/src/pages/settings/sections/ProxyAndAlertsCards.tsx`
  - `apps/frontend/src/pages/proxies/ProxyCrudModal.tsx`

## Approved Non-Visual AntD Allowlist Baseline
Outside `apps/frontend/src/shared/ui/**`, imports from `antd` are allowed only for:
- `message`
- `theme`
- `App`
- `Form` only when used for `Form.useForm`
- type-only imports (`import type ... from 'antd'`)

Any other direct `antd` import in business layers is treated as visual boundary debt and must migrate to `shared/ui` wrappers.

## Explicit Deny Rule
- Visual AntD components are denied outside `apps/frontend/src/shared/ui/**`.
- Denied examples include (non-exhaustive): `Button`, `Card`, `Table`, `Tag`, `Input`, `Select`, `Switch`, `Modal`, `Drawer`, `Popover`, `Tooltip`, `Typography`, `List`, `Tabs`, `Tree`, `Progress`, `Calendar`, `DatePicker`, `Upload`, `Segmented`.

## Temporary Suppression Policy (strict)
Any temporary suppression for `no-restricted-imports` must include all fields:
- `reason`: concrete unblock reason linked to migration scope
- `owner`: team or person responsible
- `expiry`: ISO date, max `14` days from introduction

Required inline format near suppression:

```ts
// TEMP(antd-boundary): reason=<ticket-or-issue>; owner=<owner>; expiry=<YYYY-MM-DD>
// eslint-disable-next-line no-restricted-imports
```

Expired suppressions are policy violations and must be removed or renewed with a new reason/owner/expiry.

## Alignment Note
This contract aligns with existing restriction governance patterns in `apps/frontend/eslint.config.js` (`no-restricted-imports` blocks already present) and defines the baseline for strict UI-boundary ratcheting in later tasks.
