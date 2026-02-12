create table if not exists public.storage_policies (
  tenant_id text primary key,
  secrets text not null default 'local-only',
  operational text not null default 'cloud',
  sync_enabled boolean not null default false,
  updated_at_ms bigint not null default (extract(epoch from now()) * 1000)::bigint,
  updated_by text null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  constraint storage_policies_secrets_check check (secrets = 'local-only'),
  constraint storage_policies_operational_check check (operational in ('local', 'cloud'))
);

create index if not exists idx_storage_policies_operational
  on public.storage_policies (operational);

create or replace function public.touch_storage_policies_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_storage_policies_updated_at on public.storage_policies;
create trigger trg_storage_policies_updated_at
before update on public.storage_policies
for each row
execute function public.touch_storage_policies_updated_at();

