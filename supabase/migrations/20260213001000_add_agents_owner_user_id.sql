-- Add optional user ownership binding for agents.
-- New pairings can be scoped to a specific user within tenant.

alter table if exists public.agents
  add column if not exists owner_user_id text null;

create index if not exists idx_agents_tenant_owner_status
  on public.agents (tenant_id, owner_user_id, status);

create index if not exists idx_agents_owner_user
  on public.agents (owner_user_id);

