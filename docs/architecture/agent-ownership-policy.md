# Agent Ownership and Access Policy (Supabase)

This document replaces historical Firebase rules guidance for active runtime paths.

## Status

- Firebase rules are decommissioned for active runtime.
- User access control for agent operations is enforced by backend auth + Supabase data model.

## Ownership Model

1. Each new agent pairing must have `owner_user_id`.
2. Default owner is current authenticated user (`auth.uid`).
3. `admin`/`infra` can override `owner_user_id` when creating pairing.
4. Non-privileged users can only read and operate their own agents.
5. VM command dispatch is blocked when:
   - agent belongs to another user (`AGENT_OWNER_MISMATCH`),
   - agent has no assigned owner for non-privileged caller (`AGENT_OWNER_UNASSIGNED`).

## Relevant Migrations

- `supabase/migrations/20260213001000_add_agents_owner_user_id.sql`
  - adds `owner_user_id` to `public.agents` + indexes.
- `supabase/migrations/20260213002000_backfill_agents_owner_user_id.sql`
  - backfills ownership from `paired_by` for historical records.

## Operational Verification (Docker/Supabase)

Run on VPS after deploy:

```bash
docker exec -i supabase-db psql -U postgres postgres -c \
  "select count(*) as unassigned_agents from public.agents where owner_user_id is null or btrim(owner_user_id) = '';"

docker exec -i supabase-db psql -U postgres postgres -c \
  "select id, tenant_id, owner_user_id, status, paired_by from public.agents order by created_at desc limit 20;"
```

Expected:

1. `unassigned_agents = 0` for fully migrated tenants.
2. New agents created by pairing are always user-bound.

## API-Level Enforcement Points

- `proxy-server/src/modules/v1/agents.routes.js`
- `proxy-server/src/modules/agents/service.js`
- `proxy-server/src/modules/vm-ops/service.js`
- `docs/api/openapi.yaml`

