# Frontend Styling Conventions (Bot-Mox)

This doc defines the expected styling approach for Bot-Mox so new UI can be added quickly without accumulating tech debt.

## Principles (Non-Negotiable)

1. **Token-first**: prefer theme tokens and CSS variables over hardcoded colors/spacing.
2. **Scoped by default**: use **CSS Modules** (`*.module.css`) for page/component styling.
3. **No broad Ant overrides**:
   - do not add global `.ant-*` selector overrides.
   - do not add `.ant-*` selectors inside CSS Modules.
4. **No `!important`** in frontend CSS.
5. **Accessible focus**: do not remove focus styles without replacing them with `:focus-visible` / `:focus-within` indicators.

Guardrails are enforced by `scripts/check-style-guardrails.js` and run via `npm run check:styles:guardrails` (also included in `npm run check:all`).

## What Goes Where

1. **Ant Design component skinning**:
   - use `ConfigProvider theme={{ token, components }}` (see `bot-mox/src/theme/themeRuntime.tsx`).
   - for one-off adjustments, use component props (`styles`, `className`, `rootClassName`) rather than global CSS selectors.

2. **Layout and structure**:
   - use `*.module.css` for grids, spacing, flex, containers, and domain-specific visuals.

3. **Global CSS**:
   - keep `bot-mox/src/styles/global.css` small: reset + app shell primitives only.
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
6. Run:
   - `npm run check:styles:guardrails`
   - `npm run check:all` before committing.

