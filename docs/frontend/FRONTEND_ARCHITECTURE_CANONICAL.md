# Frontend Architecture Canonical

Status: Active  
Owner: Frontend Platform  
Last Updated: 2026-02-21  
Applies To: `apps/frontend`  
Non-goals: Pixel-level design specs  
Related Checks: `check:ui:boundaries`, `check:entities:service-boundary`, `check:vm:provider-boundary`, `check:file-size:budgets`

## Stack

1. React 19
2. Vite 7
3. Refine 5
4. Ant Design 5
5. TanStack Query 5

## Structural Target

Use FSD-oriented boundaries:
1. `app`
2. `pages`
3. `widgets`
4. `features`
5. `entities`
6. `shared`

Current repository still contains transitional folders (`components`, `hooks`, `services`, `utils`) that are being reduced by grooming waves.

## Hard Rules

1. UI presentation components must not call transport/service layers directly.
2. Server-state lives in query/model/api hooks under entities/features.
3. Contract DTOs and schemas come from `@botmox/api-contract`.
4. Styling is AntD-token-first and CSS Modules scoped.
5. New global CSS or raw palette literals require explicit approval.
6. New large files require decomposition plan if over budget.
7. Migration code must use `compat` naming (`compat*`, `*Compat*`) instead of new deprecated naming markers.
8. If a public symbol rename is needed in migration layers, keep a deprecated alias for one transition wave.
9. Special migration markers (for example storage placeholders) must be named `*_COMPAT_*` in new code.
10. Theme/settings migration markers must use `COMPAT_*` naming; do not introduce new `LEGACY_*` constants in active code.
11. Deprecated aliases in active runtime paths must use `Deprecated*` naming (not `Legacy*`) and should be removed after migration windows close.

## Styling Rules

1. Prefer AntD tokens + ConfigProvider component tokens.
2. Prefer CSS Modules for local layout/styling.
3. No `.ant-*` overrides in CSS Modules.
4. No `!important` in frontend CSS.
5. Maintain keyboard focus visibility (`:focus-visible`, `:focus-within`).

See `docs/frontend/STYLING.md` for detailed checklist.

## Hotspot Grooming Priority

1. `src/hooks/vm/queue/processor.ts`
2. `src/components/vm/VMQueuePanel.tsx`
3. `src/pages/vms/VMsPage.tsx`
4. `src/services/apiClient.ts`
5. `src/services/vmService.ts`
6. `src/services/vmOpsService.ts`

Each hotspot must be split into model/api/ui composition and moved toward FSD boundaries.

## Service Modularization Pattern

1. When a `src/services/*.ts` file grows beyond maintenance comfort, split it into a dedicated folder with focused modules (for example `backend`, `settings`, `mapper`, `presentation`) and keep the original entry file as a compatibility facade.
2. Preserve the public API surface of the original service entry during the wave; avoid breaking call-sites in the same PR unless migration is explicit.
3. Keep transport calls isolated in a transport-oriented module (`backend` or `client`) and keep pure mapping/formatting logic in side-effect-free modules.
4. Examples applied: `src/services/ipqsService.ts` and `src/services/notesService.ts` were decomposed into `src/services/<domain>/*` modules while keeping facade exports stable.

## RU Notes

1. Прямые API-вызовы из UI-компонентов запрещены.
2. CSS пишем через AntD токены и CSS Modules, не через глобальные хаки.
3. Для backward-compatible миграций используем нейминг `compat`, а не deprecated-маркеры.
