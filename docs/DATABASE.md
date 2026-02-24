# Bot-Mox Database Notes

Status: Active
Owner: Data Platform
Last Updated: 2026-02-22
Applies To: Supabase/Postgres runtime
Non-goals: Deprecated/archived datastore implementations
Related Checks: `db:types:check`, `contract:check`

## Primary Store

- Supabase/Postgres is the primary runtime store.
- Frontend accesses data through backend API (`/api/v1/*`) for business operations.
- Sensitive workspace payloads are encrypted at rest by backend before persistence
  (notes/calendar/kanban JSON payload), and transparently decrypted on read.
- Sensitive finance payloads are encrypted at rest by backend before persistence
  (`finance_operations.payload`), and transparently decrypted on read.
- Settings payloads are encrypted at rest by backend before persistence
  (`settings_items.payload`), and transparently decrypted on read.
- Resources payloads are encrypted at rest by backend before persistence
  (`resource_items.payload`), and transparently decrypted on read.
- Playbooks payloads are encrypted at rest by backend before persistence
  (`playbook_items.payload`), and transparently decrypted on read.
- Bots payloads are encrypted at rest by backend before persistence
  (`bot_entities.payload`), and transparently decrypted on read.
- Artifact release/assignment payloads are encrypted at rest by backend before persistence
  (`artifact_release_items.payload`, `artifact_assignment_items.payload`), and transparently decrypted on read.
- Theme assets payloads are encrypted at rest by backend before persistence
  (`theme_asset_items.payload`), and transparently decrypted on read.
- License lease payloads are encrypted at rest by backend before persistence
  (`license_lease_items.payload`), and transparently decrypted on read.
- Provisioning unattend profiles are encrypted at rest by backend before persistence
  (`provisioning_profile_items.payload`), and transparently decrypted on read.
- Provisioning progress events are encrypted at rest by backend before persistence
  (`provisioning_progress_items.payload`), and transparently decrypted on read.
- Provisioning token payloads are encrypted at rest by backend before persistence
  (`provisioning_token_items.payload`), and transparently decrypted on read.
- Infra VM SSH config content is encrypted at rest by backend before persistence
  (`infra_vm_config_items.content`), and transparently decrypted on read.
- Agent command payload/result are encrypted at rest by backend before persistence
  (`agent_commands.payload`, `agent_commands.result`), and transparently decrypted on read.

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

## Inspecting Schema And Data

Use these commands to inspect schema/data safely without bypassing app isolation checks in normal flows.

### Local (compose stack)

```bash
# open psql inside the local stack database
docker compose -f deploy/compose.stack.yml --env-file deploy/compose.prod-sim.env exec supabase-db \
  psql -U postgres -d postgres
```

```sql
-- list tenant-scoped projection tables
\dt public.*_items

-- inspect one tenant safely (replace tenant id)
SELECT tenant_id, path, updated_at
FROM public.settings_items
WHERE tenant_id = 't_example'
ORDER BY updated_at DESC
LIMIT 50;

-- verify RLS policies are enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN (
    'resource_items',
    'workspace_items',
    'finance_operations',
    'bot_entities',
    'settings_items',
    'agents',
    'agent_commands'
  )
ORDER BY tablename;
```

### VPS (production-like)

```bash
# from server shell, with DATABASE_URL already exported
psql "$DATABASE_URL"
```

```sql
-- show table + index details for hot tenant paths
\d+ public.settings_items
\d+ public.resource_items
\d+ public.workspace_items
```

Do not query or dump cross-tenant data for operational tasks. Use tenant-filtered queries and audited admin APIs first.

## History

- `docs/history/architecture/refactor-baseline.md`
- `docs/history/architecture/refactor-handoff-2026-02-10.md`
- `docs/history/` (archived historical materials)
