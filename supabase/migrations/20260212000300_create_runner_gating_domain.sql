-- Runner gating domain (Supabase-backed replacement for legacy tenant-scoped paths)
-- Targets:
-- - tenants/{tenantId}/vm_registry/*
-- - tenants/{tenantId}/licenses/*
-- - tenants/{tenantId}/entitlements/{userId}
-- - tenants/{tenantId}/execution_leases/*

create table if not exists public.vm_registry (
  tenant_id text not null,
  vm_uuid text not null,
  user_id text not null,
  vm_name text null,
  project_id text null,
  status text not null default 'active',
  metadata jsonb not null default '{}'::jsonb,
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  primary key (tenant_id, vm_uuid),
  constraint vm_registry_status_check check (status in ('active', 'paused', 'revoked'))
);

create index if not exists idx_vm_registry_tenant_user
  on public.vm_registry (tenant_id, user_id);

create table if not exists public.tenant_licenses (
  tenant_id text not null,
  id text not null,
  user_id text null,
  type text not null default 'subscription',
  status text not null default 'active',
  expires_at_ms bigint null,
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  metadata jsonb not null default '{}'::jsonb,
  primary key (tenant_id, id),
  constraint tenant_licenses_status_check check (status in ('active', 'expired', 'revoked')),
  constraint tenant_licenses_expires_at_check check (expires_at_ms is null or expires_at_ms > 0)
);

create index if not exists idx_tenant_licenses_lookup
  on public.tenant_licenses (tenant_id, status, expires_at_ms desc);

create index if not exists idx_tenant_licenses_user
  on public.tenant_licenses (tenant_id, user_id);

create table if not exists public.tenant_entitlements (
  tenant_id text not null,
  user_id text not null,
  modules jsonb not null default '{}'::jsonb,
  updated_at_ms bigint not null,
  updated_by text null,
  primary key (tenant_id, user_id)
);

create table if not exists public.execution_leases (
  id uuid primary key,
  tenant_id text not null,
  token text not null,
  status text not null default 'active',
  created_at_ms bigint not null,
  updated_at_ms bigint not null,
  expires_at_ms bigint not null,
  last_heartbeat_at_ms bigint not null,
  revoked_at_ms bigint null,
  revoked_by text null,
  revoke_reason text null,
  user_id text not null,
  vm_uuid text not null,
  vm_name text null,
  module text not null,
  version text null,
  agent_id text not null,
  runner_id text not null,
  license_id text null,
  constraint execution_leases_status_check check (status in ('active', 'revoked', 'expired')),
  constraint execution_leases_expires_at_check check (expires_at_ms > 0)
);

create unique index if not exists uq_execution_leases_token
  on public.execution_leases (token);

create index if not exists idx_execution_leases_tenant_status
  on public.execution_leases (tenant_id, status, expires_at_ms desc);

create index if not exists idx_execution_leases_tenant_vm
  on public.execution_leases (tenant_id, vm_uuid, created_at_ms desc);
