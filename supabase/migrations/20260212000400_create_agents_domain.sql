-- Agents domain: registration, pairing, heartbeat, command queue

create table if not exists public.agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  name text not null default '',
  status text not null default 'pending',
  version text null,
  platform text null,
  capabilities jsonb not null default '[]'::jsonb,
  pairing_code text null,
  pairing_expires_at timestamptz null,
  paired_at timestamptz null,
  paired_by text null,
  last_seen_at timestamptz null,
  revoked_at timestamptz null,
  revoked_by text null,
  revoke_reason text null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agents_status_check check (status in ('pending', 'active', 'offline', 'revoked'))
);

create index if not exists idx_agents_tenant_status
  on public.agents (tenant_id, status);

create index if not exists idx_agents_tenant_created
  on public.agents (tenant_id, created_at desc);

create unique index if not exists uq_agents_pairing_code
  on public.agents (pairing_code)
  where pairing_code is not null and status = 'pending';

-- Agent commands: queued actions dispatched to agents
create table if not exists public.agent_commands (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  agent_id uuid not null references public.agents(id) on delete cascade,
  command_type text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'queued',
  result jsonb null,
  error_message text null,
  queued_at timestamptz not null default timezone('utc', now()),
  started_at timestamptz null,
  completed_at timestamptz null,
  expires_at timestamptz null,
  created_by text null,
  updated_at timestamptz not null default timezone('utc', now()),
  constraint agent_commands_status_check check (
    status in ('queued', 'dispatched', 'running', 'succeeded', 'failed', 'expired', 'cancelled')
  )
);

create index if not exists idx_agent_commands_agent_status
  on public.agent_commands (agent_id, status, queued_at);

create index if not exists idx_agent_commands_tenant_created
  on public.agent_commands (tenant_id, queued_at desc);

-- Secrets ciphertext: E2E encrypted vault (server-blind)
create table if not exists public.secrets_ciphertext (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  label text not null default '',
  ciphertext text not null,
  alg text not null default 'AES-256-GCM',
  key_id text not null,
  nonce text not null,
  aad_meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  rotated_at timestamptz null,
  created_by text null
);

create index if not exists idx_secrets_ciphertext_tenant
  on public.secrets_ciphertext (tenant_id, created_at desc);

-- Secret bindings: scope-scoped references to secrets
create table if not exists public.secret_bindings (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  scope_type text not null,
  scope_id text not null,
  secret_ref uuid not null references public.secrets_ciphertext(id) on delete cascade,
  field_name text not null default '',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint secret_bindings_scope_type_check check (scope_type in ('bot', 'vm', 'vm_settings', 'agent', 'tenant'))
);

create unique index if not exists uq_secret_bindings_scope_field
  on public.secret_bindings (tenant_id, scope_type, scope_id, field_name);

create index if not exists idx_secret_bindings_tenant_scope
  on public.secret_bindings (tenant_id, scope_type, scope_id);

-- Triggers for updated_at
drop trigger if exists trg_agents_updated_at on public.agents;
create trigger trg_agents_updated_at
before update on public.agents
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_agent_commands_updated_at on public.agent_commands;
create trigger trg_agent_commands_updated_at
before update on public.agent_commands
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_secrets_ciphertext_updated_at on public.secrets_ciphertext;
create trigger trg_secrets_ciphertext_updated_at
before update on public.secrets_ciphertext
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_secret_bindings_updated_at on public.secret_bindings;
create trigger trg_secret_bindings_updated_at
before update on public.secret_bindings
for each row
execute function public.touch_updated_at();
