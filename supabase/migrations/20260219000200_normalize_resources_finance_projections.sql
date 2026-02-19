-- D-02 normalization wave 2: typed projections for licenses/proxies/finance operations.
--
-- Backward compatibility:
--   runtime keeps reading/writing JSONB `data`; generated columns are projection-only.
--   this enables DB-first indexing and gradual migration away from opaque payload reads.

-- ============================================================
-- resources_licenses
-- ============================================================

alter table if exists public.resources_licenses
  add column if not exists license_key text generated always as (nullif(data ->> 'key', '')) stored,
  add column if not exists license_type text generated always as (nullif(data ->> 'type', '')) stored,
  add column if not exists license_status text generated always as (nullif(data ->> 'status', '')) stored,
  add column if not exists expires_at_ms bigint generated always as (
    case
      when coalesce(data ->> 'expires_at', '') ~ '^[+-]?[0-9]+$' then (data ->> 'expires_at')::bigint
      else null
    end
  ) stored,
  add column if not exists bot_ids_count integer generated always as (
    case
      when jsonb_typeof(data -> 'bot_ids') = 'array' then jsonb_array_length(data -> 'bot_ids')
      else 0
    end
  ) stored;

alter table if exists public.resources_licenses
  drop constraint if exists resources_licenses_license_status_chk;

alter table if exists public.resources_licenses
  add constraint resources_licenses_license_status_chk check (
    license_status is null
    or license_status in ('active', 'expired', 'revoked')
  );

create index if not exists idx_resources_licenses_key
  on public.resources_licenses (tenant_id, license_key);

create index if not exists idx_resources_licenses_status
  on public.resources_licenses (tenant_id, license_status);

create index if not exists idx_resources_licenses_expires_at
  on public.resources_licenses (tenant_id, expires_at_ms);

-- ============================================================
-- resources_proxies
-- ============================================================

alter table if exists public.resources_proxies
  add column if not exists proxy_ip text generated always as (nullif(data ->> 'ip', '')) stored,
  add column if not exists proxy_port integer generated always as (
    case
      when coalesce(data ->> 'port', '') ~ '^[0-9]+$' then (data ->> 'port')::integer
      else null
    end
  ) stored,
  add column if not exists provider_name text generated always as (nullif(data ->> 'provider', '')) stored,
  add column if not exists country_code text generated always as (nullif(data ->> 'country_code', '')) stored,
  add column if not exists proxy_type text generated always as (nullif(data ->> 'type', '')) stored,
  add column if not exists proxy_status text generated always as (nullif(data ->> 'status', '')) stored,
  add column if not exists bot_id_ref text generated always as (nullif(data ->> 'bot_id', '')) stored,
  add column if not exists fraud_score_value integer generated always as (
    case
      when coalesce(data ->> 'fraud_score', '') ~ '^[+-]?[0-9]+$' then (data ->> 'fraud_score')::integer
      else null
    end
  ) stored,
  add column if not exists expires_at_ms bigint generated always as (
    case
      when coalesce(data ->> 'expires_at', '') ~ '^[+-]?[0-9]+$' then (data ->> 'expires_at')::bigint
      else null
    end
  ) stored,
  add column if not exists last_checked_ms bigint generated always as (
    case
      when coalesce(data ->> 'last_checked', '') ~ '^[+-]?[0-9]+$' then (data ->> 'last_checked')::bigint
      else null
    end
  ) stored;

alter table if exists public.resources_proxies
  drop constraint if exists resources_proxies_proxy_type_chk;

alter table if exists public.resources_proxies
  add constraint resources_proxies_proxy_type_chk check (
    proxy_type is null
    or proxy_type in ('http', 'socks5')
  );

alter table if exists public.resources_proxies
  drop constraint if exists resources_proxies_proxy_status_chk;

alter table if exists public.resources_proxies
  add constraint resources_proxies_proxy_status_chk check (
    proxy_status is null
    or proxy_status in ('active', 'expired', 'banned')
  );

create index if not exists idx_resources_proxies_status
  on public.resources_proxies (tenant_id, proxy_status);

create index if not exists idx_resources_proxies_bot_ref
  on public.resources_proxies (tenant_id, bot_id_ref);

create index if not exists idx_resources_proxies_expires_at
  on public.resources_proxies (tenant_id, expires_at_ms);

create index if not exists idx_resources_proxies_fraud_score
  on public.resources_proxies (tenant_id, fraud_score_value);

-- ============================================================
-- finance_operations
-- ============================================================

alter table if exists public.finance_operations
  add column if not exists operation_type text generated always as (nullif(data ->> 'type', '')) stored,
  add column if not exists operation_category text generated always as (nullif(data ->> 'category', '')) stored,
  add column if not exists amount_value numeric generated always as (
    case
      when coalesce(data ->> 'amount', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$' then (data ->> 'amount')::numeric
      else null
    end
  ) stored,
  add column if not exists currency_code text generated always as (nullif(data ->> 'currency', '')) stored,
  add column if not exists operation_date_ms bigint generated always as (
    case
      when coalesce(data ->> 'date', '') ~ '^[+-]?[0-9]+$' then (data ->> 'date')::bigint
      else null
    end
  ) stored,
  add column if not exists bot_id_ref text generated always as (nullif(data ->> 'bot_id', '')) stored,
  add column if not exists project_id_ref text generated always as (nullif(data ->> 'project_id', '')) stored,
  add column if not exists gold_amount_value numeric generated always as (
    case
      when coalesce(data ->> 'gold_amount', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$' then (data ->> 'gold_amount')::numeric
      else null
    end
  ) stored,
  add column if not exists gold_price_at_time_value numeric generated always as (
    case
      when coalesce(data ->> 'gold_price_at_time', '') ~ '^[+-]?[0-9]+([.][0-9]+)?$' then (data ->> 'gold_price_at_time')::numeric
      else null
    end
  ) stored;

alter table if exists public.finance_operations
  drop constraint if exists finance_operations_operation_type_chk;

alter table if exists public.finance_operations
  add constraint finance_operations_operation_type_chk check (
    operation_type is null
    or operation_type in ('income', 'expense')
  );

alter table if exists public.finance_operations
  drop constraint if exists finance_operations_currency_code_chk;

alter table if exists public.finance_operations
  add constraint finance_operations_currency_code_chk check (
    currency_code is null
    or currency_code in ('USD', 'gold')
  );

alter table if exists public.finance_operations
  drop constraint if exists finance_operations_project_id_ref_chk;

alter table if exists public.finance_operations
  add constraint finance_operations_project_id_ref_chk check (
    project_id_ref is null
    or project_id_ref in ('wow_tbc', 'wow_midnight')
  );

create index if not exists idx_finance_operations_type
  on public.finance_operations (tenant_id, operation_type);

create index if not exists idx_finance_operations_category
  on public.finance_operations (tenant_id, operation_category);

create index if not exists idx_finance_operations_project
  on public.finance_operations (tenant_id, project_id_ref);

create index if not exists idx_finance_operations_date
  on public.finance_operations (tenant_id, operation_date_ms);
