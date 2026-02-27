## 2026-02-27T07:00:00Z Task: initialization
- No implementation decisions recorded yet.

## 2026-02-27T07:24:01Z Task: 1-validate-router-integration-package-api-contract
- Decision: use `@refinedev/react-router` (not `@refinedev/react-router-v6`) because frontend is on `@refinedev/core@5` + `react-router-dom@7`.
- Applied scope: add dependency in `apps/frontend/package.json` and wire `routerProvider` import/prop in `apps/frontend/src/App.tsx`.
- Planned import surface for migration follow-up: keep `routerProvider` as the only new router integration API in Task 1; defer route-tree/`NavigateToResource` refinements to Task 2.

## 2026-02-27T08:06:00Z Task: 2-refactor-app-routing-to-idiomatic-refine-resources-url-sync
- Decision: expand only `Refine.resources` metadata in `apps/frontend/src/App.tsx` for `licenses`, `proxies`, `subscriptions` by adding `create`/`edit`/`show` mapped to their existing list paths.
- Decision: keep `bots` and `notes` resource mappings unchanged (`bots.list = '/'`, `notes.list = '/notes'`) to avoid unintended navigation behavior changes.
- Decision: keep `BrowserRouter`/`Routes` structure, auth wrappers, `/admin/*` external redirect, and legacy path redirects untouched; this task is metadata parity only.

## 2026-02-27T09:05:00Z Task: 4-migrate-proxies-modal-to-usemodalform
- Decision: move create/edit modal orchestration in `ProxiesPage` to two `useModalForm` instances (`action: create` and `action: edit`) with `syncWithLocation` keys for same-route modal state parity.
- Decision: keep `ProxyCrudModal` UI structure and validation UX unchanged, but route persistence through `onCreateFinish`/`onEditFinish` provided by `useModalForm` instead of local `useCreate/useUpdate` mutations.
- Decision: derive edit target from `editProxyModal.id` + table data mapping to avoid reintroducing manual page-level edit visibility/state while preserving row-driven edit workflow.

## 2026-02-27T09:15:00Z Task: 3-migrate-licenses-page-table-modal-crud-to-refine-antd-hooks
- Decision: keep `apps/frontend/src/pages/licenses/page/LicenseModals.tsx` API untouched and render two `LicenseEditorModal` instances (create/edit) from `apps/frontend/src/pages/licenses/index.tsx`, each driven by its own `useModalForm` hook.
- Decision: keep `useTable({ syncWithLocation: true })` and existing `q`/`status`/`type` filter composition unchanged to preserve URL and filter behavior while only replacing create/edit orchestration.
- Decision: retain manual `useUpdate` only for add/remove bot flows; standard create/edit path now submits through `useModalForm` (`onFinish`) with payload mapping via `buildLicensePayload` and `getCurrentTimestamp`.

## 2026-02-27T10:05:00Z Task: 5-migrate-subscriptions-page-to-refine-modal-table-architecture
- Decision: keep `apps/frontend/src/pages/subscriptions/index.tsx` structure unchanged because required migration outcomes are already present (split `useModalForm` create/edit hooks, modal-driven create/edit UI, and no legacy page-level modal/saving state).
- Decision: preserve payload mapping boundaries in `toCreateSubscriptionPayload` and `toUpdateSubscriptionPayload` as the single date-contract integration points (`DD.MM.YYYY` input to timestamp persistence).
- Decision: keep delete flow on `useDelete` + Ant Design `confirm` to preserve current destructive-action UX while leaving standard create/edit on Refine modal form architecture.

## 2026-02-27T10:45:00Z Task: 6-refactor-bot-resource-tabs-to-same-refine-crud-modal-conventions
- Decision: migrate `BotLicense`, `BotProxy`, and `BotSubscription` standard create/edit operations to split `useModalForm` hooks and remove local modal visibility/editing/saving orchestration for those paths.
- Decision: keep assign/unassign/delete and other custom branches on existing manual mutations (`useUpdate`/`useDelete`) to preserve business-specific behavior exactly as currently implemented.
- Decision: keep tab rendering/layout/CSS and bot-scoped list filters unchanged; migration scope is modal CRUD orchestration only.

## 2026-02-27T10:32:00Z Task: 7-normalize-row-action-controls-with-refine-buttons
- Decision: replace license table delete action in `apps/frontend/src/pages/licenses/page/LicenseColumns.tsx` with Refine `DeleteButton` and remove page-level manual `useDelete` wiring from `apps/frontend/src/pages/licenses/index.tsx`.
- Decision: keep manual delete handlers for `proxies` and `subscriptions` because their confirm copy and notification behavior are record-aware and intentionally custom.
- Decision: standardize edit triggers to direct `show(id)` callbacks in `proxies` and `subscriptions` column builders; do not force `EditButton` where modal pre-logic exists (license edit defaults).

## 2026-02-27T11:20:00Z Task: 8-edge-case-and-parity-hardening-pass
- Decision: apply local hardening only in migrated flows (`licenses`, `proxies`, `subscriptions`, and bot-tab modal forms) without changing route tree, backend contracts, or shared abstractions.
- Decision: preserve same-route modal behavior and UX copy, but add submit-state guards plus modal `confirmLoading` in license-related modals to prevent duplicate submits under rapid interaction.
- Decision: keep stale URL handling non-destructive by normalizing invalid enum/pagination query state to safe in-memory defaults and closing stale proxy edit-modal query state back to list context.

## 2026-02-27T08:00:30Z Task: 9-run-full-verification-and-capture-evidence
- Decision: treat `pnpm --filter @botmox/frontend typecheck`, `build`, and `test:e2e` as the required command gates for this task and record timestamped outcomes in dedicated evidence.
- Decision: classify parity items as `PARTIAL` unless proven by interactive manual walkthrough; use explicit reason statements instead of inferring manual pass from code alone.
- Decision: record `/admin/*` parity from unchanged `App.tsx` route wiring (`AdminRedirectPage` -> `${ADMIN_APP_URL}/admin/access`) as a route-tree statement in verification evidence.
