-- D-02: Domain entity tables for Supabase backend
--
-- These tables mirror the domains currently stored in Firebase RTDB:
--   resources (licenses, proxies, subscriptions)
--   workspace (notes, calendar, kanban)
--   bots (+ lifecycle log + archive)
--   finance (operations + aggregates)
--   settings (tree-based key-value)
--
-- Data is stored as JSONB to maintain full parity with the RTDB schema-less model.
-- updated_at is managed by the application layer (no triggers).

-- ============================================================
-- Resources collections
-- ============================================================

create table if not exists public.resources_licenses (
  tenant_id text not null default 'default',
  id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists public.resources_proxies (
  tenant_id text not null default 'default',
  id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists public.resources_subscriptions (
  tenant_id text not null default 'default',
  id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

-- ============================================================
-- Workspace collections
-- ============================================================

create table if not exists public.workspace_notes (
  tenant_id text not null default 'default',
  id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists public.workspace_calendar_events (
  tenant_id text not null default 'default',
  id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists public.workspace_kanban_tasks (
  tenant_id text not null default 'default',
  id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

-- ============================================================
-- Bots
-- ============================================================

create table if not exists public.bots (
  tenant_id text not null default 'default',
  id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create table if not exists public.bot_lifecycle_log (
  tenant_id text not null default 'default',
  id text not null,
  bot_id text not null,
  type text not null,
  message text not null,
  details jsonb,
  timestamp_ms bigint not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create index if not exists idx_bot_lifecycle_log_bot
  on public.bot_lifecycle_log (tenant_id, bot_id, timestamp_ms desc);

create table if not exists public.bot_archive (
  tenant_id text not null default 'default',
  id text not null,
  bot_id text not null,
  reason text not null default 'banned',
  archived_at_ms bigint not null,
  ban_details jsonb,
  snapshot jsonb,
  created_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

create index if not exists idx_bot_archive_bot
  on public.bot_archive (tenant_id, bot_id);

-- ============================================================
-- Finance
-- ============================================================

create table if not exists public.finance_operations (
  tenant_id text not null default 'default',
  id text not null,
  data jsonb not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, id)
);

-- Aggregates stored as JSONB blobs per tenant+key
create table if not exists public.finance_aggregates (
  tenant_id text not null default 'default',
  key text not null,
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (tenant_id, key)
);

-- ============================================================
-- Settings (full tree stored as JSONB blob per tenant)
-- ============================================================

create table if not exists public.app_settings (
  tenant_id text not null default 'default',
  data jsonb not null default '{}',
  updated_at timestamptz not null default now(),
  primary key (tenant_id)
);
