# AntD 6 Compatibility Gate

Last updated (UTC): **2026-02-19T04:07:47Z**
Owner: Frontend / Platform

## Goal

Give an objective go/no-go signal before any migration from `antd@5` to `antd@6`.

## Automated Gate

Run:

```bash
pnpm run audit:antd6:gate
```

Optional hotspot scan:

```bash
pnpm run audit:antd6:scan
```

Strict cutover gate (must be green before real migration):

```bash
pnpm run audit:antd6:gate:full
```

Dedicated AntD pre-cutover E2E gate:

```bash
pnpm run audit:antd6:e2e
```

Source:
- `scripts/check-antd6-compatibility.js`

What it checks:
1. Current `bot-mox` dependency ranges for `antd`, `@refinedev/antd`, `react`.
2. Live registry metadata (via `pnpm view`) for latest `@refinedev/antd` and its peer ranges.
3. Whether `@refinedev/antd` peer dependencies already allow `antd@6`.
4. Static hotspot scan for common AntD migration-risk APIs in `bot-mox/src`:
   - popup components using legacy `visible` prop
   - `Dropdown` with legacy `overlay` prop
   - legacy `dropdownClassName` prop on popup-driven inputs

## Current Result (2026-02-19, refreshed)

1. `react`: **19.x** (ready for modern React baseline).
2. `antd`: **5.x** (current stable production path).
3. Latest `@refinedev/antd` peer dependency for `antd`: **`^5.23.0`** (`@refinedev/antd@6.0.3` from registry).
4. Static hotspot scan (`pnpm run audit:antd6:scan`): **0 findings** on current frontend source.
5. AntD pre-cutover E2E gate (`pnpm run audit:antd6:e2e`): **3 passed** (`login smoke`, `auth-guard redirect`, `authenticated shell route load`).
6. Gate status: **BLOCKED** for AntD 6 cutover right now (`pnpm run audit:antd6:gate` re-run confirmed the same peer restriction).

Reason:
- Current official `@refinedev/antd` peer range does not include `antd@6`, so direct upgrade would violate adapter contract and likely break integration.

## Next Gate Conditions

AntD 6 pilot can start only when all conditions are true:
1. `pnpm run audit:antd6:gate` reports `refine peer supports antd@6 -> yes`.
2. `pnpm run audit:antd6:gate:full` is green (`audit:antd6:gate` + strict hotspot scan + `audit:antd6:e2e`).

## Migration Checklist + Codemod Set (Baseline)

1. `visible -> open` for popup components (`Modal`, `Drawer`, `Dropdown`, `Tooltip`, `Popover`, `Popconfirm`).
2. `Dropdown overlay` migration to `menu={{ items }}` or `dropdownRender`.
3. `dropdownClassName` migration to `popupClassName` where supported.
4. Re-run:
   - `pnpm run audit:antd6:gate:full`
   - `pnpm run check:all:mono`

## Decision

Keep production path on `antd@5` for now and continue refactor work on architecture/contracts/query layers until the gate opens.
AntD 6 migration track is explicitly **deferred/blocked** at this stage.
