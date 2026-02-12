create table if not exists public.artifact_releases (
  id bigserial primary key,
  tenant_id text not null,
  module text not null,
  platform text not null,
  channel text not null default 'stable',
  version text not null,
  object_key text not null,
  sha256 text not null,
  size_bytes bigint not null,
  status text not null default 'active',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by text null,
  updated_by text null,
  constraint artifact_releases_status_check check (status in ('draft', 'active', 'disabled', 'archived')),
  constraint artifact_releases_sha256_check check (sha256 ~ '^[a-fA-F0-9]{64}$'),
  constraint artifact_releases_size_bytes_check check (size_bytes > 0),
  constraint artifact_releases_unique_version unique (tenant_id, module, platform, channel, version),
  constraint artifact_releases_unique_object_key unique (tenant_id, object_key)
);

create index if not exists idx_artifact_releases_lookup
  on public.artifact_releases (tenant_id, module, platform, channel, status);

create index if not exists idx_artifact_releases_created_at
  on public.artifact_releases (tenant_id, created_at desc);

create table if not exists public.artifact_assignments (
  id bigserial primary key,
  tenant_id text not null,
  module text not null,
  platform text not null default 'windows',
  channel text not null default 'stable',
  user_id text null,
  release_id bigint not null references public.artifact_releases(id) on delete restrict,
  is_default boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  created_by text null,
  updated_by text null,
  constraint artifact_assignments_scope_check check (
    (user_id is not null and is_default = false) or
    (user_id is null and is_default = true)
  )
);

create unique index if not exists uq_artifact_assignments_user_scope
  on public.artifact_assignments (tenant_id, user_id, module, platform, channel)
  where user_id is not null;

create unique index if not exists uq_artifact_assignments_tenant_default_scope
  on public.artifact_assignments (tenant_id, module, platform, channel)
  where user_id is null and is_default = true;

create index if not exists idx_artifact_assignments_release_id
  on public.artifact_assignments (release_id);

create table if not exists public.artifact_download_audit (
  id bigserial primary key,
  tenant_id text not null,
  lease_id text null,
  lease_jti text null,
  user_id text null,
  vm_uuid text null,
  module text not null,
  platform text not null,
  channel text not null,
  release_id bigint null references public.artifact_releases(id) on delete set null,
  event_type text not null,
  result text not null,
  reason text null,
  request_ip text null,
  url_expires_at_ms bigint null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  constraint artifact_download_audit_event_type_check check (
    event_type in ('resolve_success', 'resolve_denied', 'download_url_issued')
  ),
  constraint artifact_download_audit_result_check check (
    result in ('allowed', 'denied', 'error')
  )
);

create index if not exists idx_artifact_download_audit_tenant_created
  on public.artifact_download_audit (tenant_id, created_at desc);

create index if not exists idx_artifact_download_audit_tenant_module
  on public.artifact_download_audit (tenant_id, module, created_at desc);

create index if not exists idx_artifact_download_audit_tenant_user
  on public.artifact_download_audit (tenant_id, user_id, created_at desc);

create index if not exists idx_artifact_download_audit_tenant_lease
  on public.artifact_download_audit (tenant_id, lease_id, created_at desc);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

drop trigger if exists trg_artifact_releases_updated_at on public.artifact_releases;
create trigger trg_artifact_releases_updated_at
before update on public.artifact_releases
for each row
execute function public.touch_updated_at();

drop trigger if exists trg_artifact_assignments_updated_at on public.artifact_assignments;
create trigger trg_artifact_assignments_updated_at
before update on public.artifact_assignments
for each row
execute function public.touch_updated_at();
