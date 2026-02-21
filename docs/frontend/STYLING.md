# Frontend Styling Conventions (Bot-Mox)

Status: Active
Owner: Frontend Platform
Last Updated: 2026-02-19
Applies To: `apps/frontend/src`
Non-goals: Raw CSS experimentation outside design system
Related Checks: `check:styles:guardrails`, `check:style:token-usage`, `check:theme:contrast`

This doc defines the expected styling approach for Bot-Mox so new UI can be added quickly without accumulating tech debt.

## Principles (Non-Negotiable)

1. **Token-first**: prefer theme tokens and CSS variables over hardcoded colors/spacing.
2. **Scoped by default**: use **CSS Modules** (`*.module.css`) for page/component styling.
3. **No broad Ant overrides**:
   - do not add global `.ant-*` selector overrides.
   - do not add `.ant-*` selectors inside CSS Modules.
4. **No `!important`** in frontend CSS.
5. **Accessible focus**: do not remove focus styles without replacing them with `:focus-visible` / `:focus-within` indicators.

Guardrails are enforced by `scripts/check-style-guardrails.js` and run via `pnpm run check:styles:guardrails` (also included in `pnpm run check:all`).

## What Goes Where

1. **Ant Design component skinning**:
   - use `ConfigProvider theme={{ token, components }}` (see `apps/frontend/src/theme/themeRuntime.tsx`).
   - for one-off adjustments, use component props (`styles`, `className`, `rootClassName`) rather than global CSS selectors.

2. **Layout and structure**:
   - use `*.module.css` for grids, spacing, flex, containers, and domain-specific visuals.

3. **Global CSS**:
   - keep `apps/frontend/src/styles/global.css` small: reset + app shell primitives only.
   - no app-wide component skinning via `.ant-*`.

## Token Usage

Prefer existing tokens/vars such as:
- `var(--boxmox-color-text-primary|secondary|muted)`
- `var(--boxmox-color-surface-panel|hover|muted)`
- `var(--boxmox-color-border-default|subtle)`
- `var(--boxmox-color-brand-primary)` and `--boxmox-color-brand-primary-rgb`
- `var(--radius-*)`, `var(--text-*)`, `var(--font-*)`

If a new semantic color is needed, extend the theme/token layer rather than scattering new literals.

## Focus Styles (Keyboard UX)

Rules of thumb:
1. Use `:focus-visible` for keyboard-only rings on inputs/buttons/interactive elements.
2. For `contenteditable` blocks, use `:focus-within` on the parent container so the ring is stable.
3. Avoid `outline: none` unless a replacement is present.

Example:
```css
.container:focus-within {
  box-shadow: 0 0 0 2px rgba(var(--boxmox-color-brand-primary-rgb, 66, 133, 244), 0.12);
}

.input:focus-visible {
  box-shadow: 0 0 0 2px rgba(var(--boxmox-color-brand-primary-rgb, 66, 133, 244), 0.15);
}
```

## Adding A New Themed Page (Checklist)

1. Create `PageName.module.css` and keep styles scoped to that page.
2. Import module as `styles` and use `className={styles.someClass}`.
3. Use theme tokens / CSS vars for all colors and spacing.
4. If an Ant component needs styling:
   - prefer tokens first,
   - otherwise use component props (`styles`, `className`, `rootClassName`) locally.
5. Ensure keyboard focus is visible for primary interactions.
6. Make sure the page stays readable with **visual backgrounds enabled**:
   - do not rely on raw text over the shell background layer,
   - ensure primary content sits on a surface (`var(--boxmox-color-surface-panel)` / antd `colorBgContainer`) with adequate contrast.
7. For all native `<button>` elements:
   - set `type="button"` unless you intentionally need `type="submit"` inside a `<form>`.
8. Run:
   - `pnpm run check:styles:guardrails`
   - `pnpm run check:all` before committing.

## New Page Skeleton (Recommended)

Use this baseline when adding a new page to avoid ad-hoc styling.

```tsx
import styles from './MyPage.module.css';

export function MyPage() {
  return (
    <section className={styles.page}>
      <header className={styles.header}>...</header>
      <div className={styles.content}>...</div>
    </section>
  );
}
```

```css
.page {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
  color: var(--boxmox-color-text-primary);
}

.header,
.content {
  background: var(--boxmox-color-surface-panel);
  border: 1px solid var(--boxmox-color-border-default);
  border-radius: var(--radius-md);
}
```

## Regression Matrix For New/Changed Pages

Before merge, validate:
1. Light theme + dark theme.
2. Visual background off + on (with a busy image).
3. Keyboard tab order: all primary controls reachable and visibly focused.
4. Hover/active/selected states readable on panel and muted surfaces.
5. Empty/loading/error states still use tokenized colors (no raw literals).
6. Native buttons use explicit `type` (`button` or intentional `submit`).

## Background Mode Safety (Do Not Skip)

When `settings/theme.visual.enabled` is on, the app shell renders an image layer + overlay under the content. Pages must be resilient to that.

Rules:
1. **Do not make entire pages transparent**. Keep content inside a panel/container surface.
2. Avoid fragile contrast tricks (e.g. light text directly on background). Prefer semantic text tokens.
3. If you introduce translucent surfaces, test in both light/dark with multiple background images and overlay settings.

Quick manual QA:
1. Enable a busy background image in Settings.
2. Check the page in light and dark themes.
3. Keyboard-tab through primary interactions (focus ring visible).
4. Verify any table/list row hover/selected states remain readable.

## If You Need A New Token (Instead of Hardcoding)

Preferred flow:
1. First try existing semantic vars (examples earlier in this doc).
2. If semantics are missing, extend the token mapping in `apps/frontend/src/theme/themeRuntime.tsx` (antd tokens/components) and, only if needed, the compatibility CSS vars bridge.
3. Document the new semantic token name in this file (so future pages reuse it).
