# Bot-Mox Database Notes

Status: Active
Owner: Data Platform
Last Updated: 2026-02-19
Applies To: Supabase/Postgres runtime
Non-goals: Deprecated/archived datastore implementations
Related Checks: `db:types:check`, `contract:check`

## Primary Store

- Supabase/Postgres is the primary runtime store.
- Frontend accesses data through backend API (`/api/v1/*`) for business operations.

## Supabase Runtime Domains

- `public.resources_licenses`
- `public.resources_proxies`
- `public.resources_subscriptions`
- `public.workspace_notes`
- `public.workspace_calendar_events`
- `public.workspace_kanban_tasks`
- `public.bots`
- `public.bot_lifecycle_log`
- `public.bot_archive`
- `public.finance_operations`
- `public.finance_aggregates`
- `public.app_settings`
- `public.storage_policies`
- `public.agents`
  - uses `owner_user_id` for user-scoped ownership; non-privileged API paths require assigned owner.
- `public.agent_commands`
- `public.secrets_ciphertext`
- `public.secret_bindings`
- `public.artifact_releases`
- `public.artifact_assignments`
- `public.artifact_download_audit`
- `public.vm_registry`
- `public.execution_leases`
- `public.tenant_licenses`
- `public.tenant_entitlements`
- `public.unattend_profiles`
  - пользовательские шаблоны autounattend.xml для персонализации Windows-установки
  - unique constraint на `(tenant_id, user_id, name)`
- `public.provisioning_tokens`
  - JWT-токены привязанные к VM для авторизации bootstrap-процесса
  - статусы: `active`, `used`, `expired`, `revoked`
  - unique constraint на `(tenant_id, vm_uuid)`
- `public.vm_setup_progress`
  - трекинг шагов установки VM (windows_installed → downloader_ready → app_downloaded → playbook_running → completed)

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
- `POST /api/v1/artifacts/releases`
- `POST /api/v1/artifacts/assign`
- `GET /api/v1/artifacts/assign/{userId}/{module}`
- `POST /api/v1/artifacts/resolve-download`
- `GET|POST|PUT|DELETE /api/v1/unattend-profiles/*`
- `POST /api/v1/provisioning/generate-iso-payload`
- `POST /api/v1/provisioning/validate-token`
- `POST /api/v1/provisioning/report-progress`
- `GET /api/v1/provisioning/progress/{vmUuid}`

Deprecated `/api/*` adapters are removed.

## History

- `docs/history/architecture/refactor-baseline.md`
- `docs/history/architecture/refactor-handoff-2026-02-10.md`
- `docs/history/` (archived historical materials)
