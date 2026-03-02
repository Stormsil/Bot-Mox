## Task 8 - Interactive wrappers
- Dense-control wrappers can stay minimal by defaulting antd `size` to `small` and forwarding all remaining props for controlled usage (`value`/`onChange`/`disabled`, or `checked` for switch).
- Wrapper-level style defaults should be token-driven (`--botmox-font-primary`) and merged before caller-provided `style` so explicit consumer overrides remain intact.
- Shared UI barrel pattern remains one export per wrapper folder (`./AppX/AppX`) and scales cleanly for incremental design-system expansion.

## Task 9 - CSS hardcode cleanup (hotspots)
- In dense CSS modules, safe tokenization is highest-value on semantic spacing (`margin`/`padding`/`gap`) while fixed table/control widths should remain px to preserve layout stability.
- Replacing hardcoded translucent colors with `color-mix(in srgb, var(--botmox-color-*) ..., transparent)` removes raw RGB literals without changing visual intent.
- Scoped hotspot scans (`rg` against touched files) are required alongside repo-wide scans because repository-level outputs are noisy and can hide local progress.

## Task 9 - CSS hardcode cleanup (final gate pass)
- A full wave pass can be stabilized by replacing raw literals in priority order: status colors (`#52c41a/#ff4d4f/#faad14`) first, then neutral/white/black literals, then `rgba(...)` overlays via `color-mix`.
- `color: white` and similar named literals can also trip token-usage guards in strict mode; convert them to design tokens the same way as HEX values.

## Task 10 - TSX inline cleanup and semantic wrappers
- For dense table renderers, replacing inline `Text` styling with `AppText` plus CSS-module classes removes hardcoded literals while keeping visual density stable.
- Keeping inline styles only for runtime values (for example, dynamic fraud score color) is a safe compromise when static typography/spacing is moved into semantic classes.
- Hotspot-local residual scans are essential because repo-wide `rg` results can still fail due to unrelated files outside the current task wave.

## Task 11 - AntD import migration (attempt)
- Wrapper migration at this scope needs AST-aware import rewriting; regex replacement is too fragile for multiline/mixed imports.
- Compatibility wrappers (`AppInput`/`AppSelect` static members and `AppTag` accepting legacy `color`) reduce migration friction, but do not replace the need for safe codemods.
- Safe fallback policy is mandatory: if any batch produces malformed imports, rollback touched business-layer files before continuing.

## Task 11 - AntD import migration (completion wave)
- Parser-safe AST import migration is stable when wrappers are aliased back to original local names (`AppX as X`), because JSX usage does not need tree-wide rename edits.
- A shared `shared/ui` barrel with alias exports for non-covered AntD components enables full business-layer decoupling from direct visual `antd` imports without behavior changes.
- Running `biome check --write` on touched business-layer paths after codemod removes import-order/format noise and keeps the migration compile-safe.

## Task 11 - Final lint gate closure
- Closing unrelated lint blockers in a targeted file set (format-only files plus one CSS empty-block file) is enough to unblock the full `lint && typecheck` command without affecting migration semantics.
- Keeping `antd` runtime utility imports (`message`, `theme`, `App`) while removing visual imports produces a clean, enforceable allowlist boundary for business layers.

## Task 12 - Domain styling bridge for WoW colors
- Centralizing WoW palette tokens in `features/wow-data/config/colors.ts` enables targeted migration of domain widgets without leaking constants into `shared/ui` or global theme.
- Keep domain helpers in the same module (`getWowRarityColor`, `getWowProfessionColor`) to replace local switch-based color functions with compile-safe imports.
- Scoped verification should distinguish expected literals in the new domain palette from residual literals in unrelated bot-profile modules.

## Task 12 - strict acceptance follow-up
- For non-WoW bot-profile widgets, replacing raw hex status colors with semantic CSS variable strings (`var(--boxmox-color-status-*)`) preserves behavior and satisfies strict no-hex TS/TSX gates.
- Inline alpha effects can be preserved without hex by using `color-mix(in srgb, <token-color> <percent>, transparent)` for tag/background accents.
