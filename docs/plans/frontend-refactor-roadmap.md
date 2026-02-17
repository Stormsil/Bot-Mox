# Frontend Refactor Roadmap (Theme-First, Full Coverage)

Last updated (UTC): **2026-02-16T00:00:00Z**

## Purpose

Create a professional, maintainable frontend architecture where:
1. Theme settings from Settings are applied everywhere (old and new UI).
2. Styling is predictable and scalable (no global CSS side effects).
3. VM and non-VM pages follow one design system behavior (Ant Design 5 tokens first).
4. A new optional visual theme mode supports custom background images (including anime/art) with safe readability.
5. Refactoring is incremental and reversible.

## Confirmed Product Decisions

1. Background storage: **Supabase Storage**.
2. Media scope for V1: **images only** (`jpg/png/webp`), no GIF/video.
3. Rollout scope: **all frontend pages** (not VM-only).
4. Theme background feature is optional and must support rollback/disable at runtime.

## Current Baseline (Measured)

1. Frontend files:
- `66` CSS files in `bot-mox/src`.
- `151` TSX files in `bot-mox/src`.

2. Styling debt:
- `242` usages of `!important`.
- `70` explicit CSS imports in TSX files.
- `1772` usages of CSS vars like `var(--boxmox-*)`, `var(--proxmox-*)`, spacing/font vars.

3. Architectural hotspots:
- `bot-mox/src/styles/global.css` contains broad `.ant-*` overrides.
- `bot-mox/src/styles/variables.css` is a major source of global theme variables.
- Theme editor exists (`SettingsPage` + `ThemeSettingsPanel` + `themeService`) but propagation is mixed: tokens + global CSS vars.

## Target Architecture

## 1) Single source of truth for theme

1. Keep backend source at `settings/theme`.
2. Add strict typed theme contract for:
- color palettes (light/dark),
- typography and radius,
- visual background config (enabled, mode, image, overlay, blur, dim).
3. Frontend consumes this contract through one `ThemeProvider` and one token mapping layer.

## 2) Ant Design token-first styling

1. All base component look is controlled via `ConfigProvider theme={{ token, components }}`.
2. Global `.ant-*` overrides are removed from global styles.
3. Local exceptions are component-scoped only (CSS Modules or component styles), never app-wide selectors.

## 3) Scoped styling strategy

1. Use CSS Modules for page/component structure styles.
2. Keep a tiny global stylesheet only for reset, root layout shell, and non-component browser primitives.
3. Introduce style lint rules/checklist to prevent regressions (`.ant-*` global selectors and uncontrolled `!important`).

## 4) Visual background (anime/art) system

1. Background image is rendered as a separate visual layer under content.
2. Foreground readability is guaranteed by overlay + dim + optional blur.
3. Light/dark aware presets; user can upload and select their own images.
4. Instant fallback to plain theme if feature is disabled or image unavailable.

## Scope and Non-Goals

In scope:
1. Full frontend refactor by phases.
2. Minimal backend/db changes needed for theme/background config and image metadata.
3. Documentation and evergreen audit process.

Out of scope for this wave:
1. GIF/video backgrounds.
2. Full redesign of business workflows.
3. Rewriting non-theme backend domains.

## API / Contract Changes (Planned)

## Frontend type additions

File candidates:
- `bot-mox/src/theme/themePalette.ts`
- `bot-mox/src/services/themeService.ts`
- new `bot-mox/src/theme/theme.types.ts`

Planned structures:
1. `ThemeVisualSettings`:
- `enabled: boolean`
- `mode: 'none' | 'image'`
- `backgroundAssetId?: string`
- `backgroundImageUrl?: string`
- `backgroundPosition: 'center' | 'top' | 'custom'`
- `backgroundSize: 'cover' | 'contain' | 'auto'`
- `overlayOpacity: number` (0..1)
- `overlayColorLight: string`
- `overlayColorDark: string`
- `blurPx: number`
- `dimStrength: number`

2. `ThemeSettings` expansion:
- keep existing `palettes`, `presets`, `active_preset_id`
- add `visual: ThemeVisualSettings`

## Backend contract additions

Files:
- `proxy-server/src/contracts/schemas.js`
- `proxy-server/src/modules/v1/settings.routes.js`

Planned:
1. Extend `themeSettingsMutationSchema` with strict `visual` schema.
2. Keep backward compatibility: missing `visual` resolved to defaults.
3. Continue using `/api/v1/settings/theme` for read/write of main theme config.

## New image asset endpoints (small backend increment)

New module proposal:
- `/api/v1/theme-assets/*`

Endpoints:
1. `POST /api/v1/theme-assets/presign-upload`
- input: file name, mime type, size
- output: signed upload URL + asset id + object key

2. `POST /api/v1/theme-assets/complete`
- validates uploaded object metadata
- marks asset ready

3. `GET /api/v1/theme-assets`
- list tenant-owned assets for settings UI picker

4. `DELETE /api/v1/theme-assets/:id`
- soft-delete metadata + optional storage cleanup

## DB additions (minimal)

Migration proposal:
- new table `theme_background_assets`

Columns:
1. `id` (uuid or text id)
2. `tenant_id` (text)
3. `created_by` (text)
4. `object_key` (text)
5. `mime_type` (text)
6. `size_bytes` (int)
7. `width` (int, nullable)
8. `height` (int, nullable)
9. `status` (`pending|ready|failed|deleted`)
10. `created_at`, `updated_at`

Indexes:
1. `(tenant_id, status)`
2. `(tenant_id, created_at desc)`

## Phased Execution Plan

## Phase 0 — Guardrails and Baseline Freeze

Goals:
1. Lock measurable baseline.
2. Prevent new styling debt during refactor.

Tasks:
1. Add/refine docs and audit process.
2. Add lint/check scripts for:
- new global `.ant-*` selectors,
- new `!important` (allowlist only).
3. Snapshot current visual state of key pages for regression checks.

Exit criteria:
1. Baseline metrics captured in audit doc.
2. CI/local checks can detect styling regressions.

## Phase 1 — Theme Core Consolidation

Goals:
1. Unify theme source of truth and propagation path.
2. Eliminate split-brain between CSS vars and antd tokens.

Tasks:
1. Introduce `ThemeProvider` (single runtime theme state).
2. Move all app-level theme mapping to `ConfigProvider` token pipeline.
3. Keep legacy CSS vars as compatibility layer only; no new dependencies on them.
4. Normalize typography/radius/spacing tokens in one place.

Exit criteria:
1. Changing theme in settings immediately updates all pages consistently.
2. No page depends on manual ad-hoc theme state outside provider.

## Phase 2 — De-globalize Ant Overrides

Goals:
1. Remove broad `.ant-*` overrides from global styles.
2. Replace with token config + scoped styles.

Tasks:
1. Refactor `bot-mox/src/styles/global.css`:
- keep reset/layout shell only,
- remove global ant component skinning.
2. Introduce `components` token config in `ConfigProvider` for Button/Table/Input/Card/etc.
3. Move rare visual exceptions into local scope.

Exit criteria:
1. `global.css` no longer contains broad ant component overrides.
2. UI remains visually stable on all pages.

## Phase 3 — CSS Modules Migration by Domains

Goals:
1. Incrementally migrate from raw global CSS to scoped modules.
2. Keep behavior identical during migration.

Execution order:
1. Layout and shell (`layout/*`, main containers).
2. VM domain (`components/vm`, `pages/vms`).
3. Resources domains (licenses, proxies, subscriptions).
4. Workspace/pages (notes, calendar, kanban).
5. Bot and finance domains.

Rules:
1. Rename `*.css` -> `*.module.css` where local scope is intended.
2. Import as `styles` and replace className strings.
3. Do not convert everything in one PR; small vertical slices.

Exit criteria:
1. Domain-by-domain migration completed.
2. No accidental cross-page style leakage.

## Phase 4 — Visual Background Theme (Anime/Art)

Goals:
1. Add optional artistic backgrounds safely.
2. Keep readability and accessibility first.

Tasks:
1. Add settings UI section: `Appearance > Visual Background`.
2. Add upload flow to Supabase Storage (presigned).
3. Add image picker and preview.
4. Add rendering layer in app shell:
- image layer,
- overlay layer,
- content layer.
5. Add controls for opacity/blur/dim per theme mode.
6. Add emergency toggle: disable backgrounds globally per tenant settings.

Exit criteria:
1. User can upload/select/remove background image.
2. All pages remain readable in light/dark.
3. One-click rollback to plain theme works.

## Phase 5 — Hardening, QA, and Cleanup

Goals:
1. Make result production-ready and easy to extend.

Tasks:
1. Remove dead CSS and obsolete variables.
2. Add docs for theme extension and page onboarding.
3. Add regression test checklist for new pages.
4. Validate performance with/without background image.
5. Final pass for accessibility contrast and focus states.

Exit criteria:
1. Theme system is stable and documented.
2. Team can add new pages without custom theme hacks.

## Testing Strategy

## Automated

1. Type checks and build:
- `npm --prefix bot-mox run build`
2. Lint:
- `npm --prefix bot-mox run lint`
3. Backend syntax/smoke after API changes:
- `npm run check:backend:syntax`
- `npm run check:backend:smoke`

## Manual matrix (each phase)

1. Pages:
- login, datacenter, vm generator/list, resources pages, settings, notes/workspace.
2. Modes:
- light + dark.
3. Theme operations:
- preset save/apply/delete,
- color changes persisted,
- background upload/select/remove.
4. Failure cases:
- image URL missing,
- upload interrupted,
- invalid image format,
- backend unavailable.

## Rollback Strategy

1. Feature flag in settings for background visuals (`visual.enabled=false`).
2. Keep compatibility fallback for old theme payload (no `visual` block).
3. Deploy in slices; each phase is independently revertible.
4. Keep migration additive (no destructive DB changes in first pass).

## Delivery Model

1. Work in small PR batches per phase.
2. Update audit doc in same PR every time.
3. Mark item `GREEN` only with evidence (files + checks run).

## References

1. `docs/audits/frontend-refactor-audit.md`
2. `docs/DEV-WORKFLOW.md`
3. `bot-mox/src/App.tsx`
4. `bot-mox/src/styles/global.css`
5. `bot-mox/src/styles/variables.css`
6. `bot-mox/src/pages/settings/ThemeSettingsPanel.tsx`
7. `bot-mox/src/services/themeService.ts`
8. `proxy-server/src/contracts/schemas.js`
9. `proxy-server/src/modules/v1/settings.routes.js`
