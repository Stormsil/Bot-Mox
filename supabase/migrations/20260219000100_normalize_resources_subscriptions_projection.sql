-- D-02 normalization wave 1: introduce typed projection columns for subscriptions.
--
-- Goal:
--   keep backward compatibility with JSONB `data` while exposing stable typed columns
--   that can be indexed and consumed by DB-first tooling.
--
-- Notes:
--   - columns are GENERATED ALWAYS AS (...) STORED from JSONB payload
--   - runtime repositories remain backward compatible (no write-path changes required)
--   - future waves can migrate read/write logic to these columns and then shrink `data`

alter table if exists public.resources_subscriptions
  add column if not exists subscription_type text generated always as (nullif(data ->> 'type', '')) stored,
  add column if not exists subscription_status text generated always as (nullif(data ->> 'status', '')) stored,
  add column if not exists expires_at_ms bigint generated always as (
    case
      when coalesce(data ->> 'expires_at', '') ~ '^-?\\d+$' then (data ->> 'expires_at')::bigint
      else null
    end
  ) stored,
  add column if not exists bot_id_ref text generated always as (nullif(data ->> 'bot_id', '')) stored,
  add column if not exists account_email text generated always as (nullif(data ->> 'account_email', '')) stored,
  add column if not exists auto_renew_enabled boolean generated always as (
    case
      when lower(coalesce(data ->> 'auto_renew', '')) in ('true', 'false') then (data ->> 'auto_renew')::boolean
      else null
    end
  ) stored,
  add column if not exists project_id_ref text generated always as (nullif(data ->> 'project_id', '')) stored;

alter table if exists public.resources_subscriptions
  drop constraint if exists resources_subscriptions_subscription_type_chk;

alter table if exists public.resources_subscriptions
  add constraint resources_subscriptions_subscription_type_chk check (
    subscription_type is null
    or subscription_type in ('wow', 'bot', 'proxy', 'vpn', 'other')
  );

alter table if exists public.resources_subscriptions
  drop constraint if exists resources_subscriptions_subscription_status_chk;

alter table if exists public.resources_subscriptions
  add constraint resources_subscriptions_subscription_status_chk check (
    subscription_status is null
    or subscription_status in ('active', 'cancelled')
  );

alter table if exists public.resources_subscriptions
  drop constraint if exists resources_subscriptions_project_id_ref_chk;

alter table if exists public.resources_subscriptions
  add constraint resources_subscriptions_project_id_ref_chk check (
    project_id_ref is null
    or project_id_ref in ('wow_tbc', 'wow_midnight')
  );

create index if not exists idx_resources_subscriptions_type
  on public.resources_subscriptions (tenant_id, subscription_type);

create index if not exists idx_resources_subscriptions_status
  on public.resources_subscriptions (tenant_id, subscription_status);

create index if not exists idx_resources_subscriptions_expires_at
  on public.resources_subscriptions (tenant_id, expires_at_ms);

create index if not exists idx_resources_subscriptions_bot_ref
  on public.resources_subscriptions (tenant_id, bot_id_ref);
