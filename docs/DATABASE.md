# Bot-Mox Database Notes

## Primary Store

- Firebase Realtime Database (RTDB) is the primary runtime store.
- Frontend accesses data through backend API (`/api/v1/*`) for business operations.
- Supabase/Postgres migration is staged via `DATA_BACKEND` feature flag.

## Key RTDB Domains

- `bots/*`
- `resources/licenses/*`
- `resources/proxies/*`
- `resources/subscriptions/*`
- `workspace/notes_v2/*`
- `workspace/notes_index/*`
- `workspace/calendar_events/*`
- `workspace/kanban_tasks/*`
- `settings/*`
- `finance/operations/*`
- `finance/daily_stats/*`
- `finance/gold_price_history/*`
- `tenants/{tenantId}/vm_registry/*`
- `tenants/{tenantId}/licenses/*`
- `tenants/{tenantId}/entitlements/*`
- `tenants/{tenantId}/execution_leases/*`
- `tenants/{tenantId}/settings/storage_policy`

## Supabase (Staged)

- `public.storage_policies` (first migrated path for `settings/storage_policy` when `DATA_BACKEND=supabase`)

## Rules

- RTDB rules: `database.rules.json`
- Firestore rules (default deny): `firestore.rules`

## API Access Surface

- `GET|POST|PATCH|DELETE /api/v1/resources/*`
- `GET|POST|PATCH|DELETE /api/v1/workspace/*`
- `GET|PUT|PATCH /api/v1/settings/*`
- `GET|POST|PATCH|DELETE /api/v1/bots/*`
- `GET|POST|PATCH|DELETE /api/v1/finance/*`
- `POST /api/v1/vm/register`
- `GET /api/v1/vm/{uuid}/resolve`
- `POST /api/v1/license/lease`
- `POST /api/v1/license/heartbeat`
- `POST /api/v1/license/revoke`

Legacy `/api/*` adapters are removed.

Migration plan: `docs/plans/supabase-saas-agent-mvp.md`.

## History

- `docs/history/architecture/refactor-baseline.md`
- `docs/history/architecture/refactor-handoff-2026-02-10.md`
