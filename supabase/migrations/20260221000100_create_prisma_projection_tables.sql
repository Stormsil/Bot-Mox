-- Align local Supabase schema with current Prisma projection tables used by backend.
-- This migration is idempotent and safe to rerun.

BEGIN;

-- finance_operations compatibility: backend reads/writes payload, legacy schema uses data.
ALTER TABLE public.finance_operations
  ADD COLUMN IF NOT EXISTS payload jsonb;

UPDATE public.finance_operations
SET payload = COALESCE(payload, data, '{}'::jsonb)
WHERE payload IS NULL;

ALTER TABLE public.finance_operations
  ALTER COLUMN payload SET NOT NULL;

CREATE OR REPLACE FUNCTION public.sync_finance_operations_payload_data()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.payload := COALESCE(NEW.payload, NEW.data, '{}'::jsonb);
  NEW.data := COALESCE(NEW.data, NEW.payload, '{}'::jsonb);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_finance_operations_payload_data ON public.finance_operations;
CREATE TRIGGER trg_sync_finance_operations_payload_data
BEFORE INSERT OR UPDATE ON public.finance_operations
FOR EACH ROW
EXECUTE FUNCTION public.sync_finance_operations_payload_data();

-- Generic projection tables expected by Prisma schema.
CREATE TABLE IF NOT EXISTS public.resource_items (
  tenant_id text NOT NULL,
  kind text NOT NULL,
  id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resource_items_pkey PRIMARY KEY (tenant_id, kind, id)
);
CREATE INDEX IF NOT EXISTS idx_resource_items_tenant_kind_updated
  ON public.resource_items (tenant_id, kind, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.workspace_items (
  tenant_id text NOT NULL,
  kind text NOT NULL,
  id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_items_pkey PRIMARY KEY (tenant_id, kind, id)
);
CREATE INDEX IF NOT EXISTS idx_workspace_items_tenant_kind_updated
  ON public.workspace_items (tenant_id, kind, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.bot_entities (
  tenant_id text NOT NULL,
  id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT bot_entities_pkey PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_bot_entities_tenant_updated
  ON public.bot_entities (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.playbook_items (
  tenant_id text NOT NULL,
  id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playbook_items_pkey PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_playbook_items_tenant_updated
  ON public.playbook_items (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.settings_items (
  tenant_id text NOT NULL,
  path text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT settings_items_pkey PRIMARY KEY (tenant_id, path)
);
CREATE INDEX IF NOT EXISTS idx_settings_items_tenant_updated
  ON public.settings_items (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.theme_asset_items (
  tenant_id text NOT NULL,
  id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theme_asset_items_pkey PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_theme_asset_items_tenant_updated
  ON public.theme_asset_items (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.license_lease_items (
  tenant_id text NOT NULL,
  id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT license_lease_items_pkey PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_license_lease_items_tenant_updated
  ON public.license_lease_items (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.artifact_release_items (
  tenant_id text NOT NULL,
  id integer NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artifact_release_items_pkey PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_artifact_release_items_tenant_updated
  ON public.artifact_release_items (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.artifact_assignment_items (
  tenant_id text NOT NULL,
  id integer NOT NULL,
  module text NOT NULL,
  platform text NOT NULL,
  channel text NOT NULL,
  user_key text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT artifact_assignment_items_pkey PRIMARY KEY (tenant_id, id)
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_artifact_assignment_scope
  ON public.artifact_assignment_items (tenant_id, module, platform, channel, user_key);
CREATE INDEX IF NOT EXISTS idx_artifact_assignment_items_tenant_updated
  ON public.artifact_assignment_items (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.infra_vm_items (
  tenant_id text NOT NULL,
  node text NOT NULL,
  vmid text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infra_vm_items_pkey PRIMARY KEY (tenant_id, node, vmid)
);
CREATE INDEX IF NOT EXISTS idx_infra_vm_items_tenant_node_updated
  ON public.infra_vm_items (tenant_id, node, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.infra_vm_config_items (
  tenant_id text NOT NULL,
  vmid text NOT NULL,
  content text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT infra_vm_config_items_pkey PRIMARY KEY (tenant_id, vmid)
);
CREATE INDEX IF NOT EXISTS idx_infra_vm_config_items_tenant_updated
  ON public.infra_vm_config_items (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.provisioning_profile_items (
  tenant_id text NOT NULL,
  id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provisioning_profile_items_pkey PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_provisioning_profile_items_tenant_updated
  ON public.provisioning_profile_items (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.provisioning_token_items (
  token text NOT NULL,
  tenant_id text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provisioning_token_items_pkey PRIMARY KEY (token)
);
CREATE INDEX IF NOT EXISTS idx_provisioning_token_items_tenant_updated
  ON public.provisioning_token_items (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.provisioning_progress_items (
  tenant_id text NOT NULL,
  id text NOT NULL,
  vm_uuid text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT provisioning_progress_items_pkey PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_provisioning_progress_items_scope
  ON public.provisioning_progress_items (tenant_id, vm_uuid, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.secret_meta (
  tenant_id text NOT NULL,
  id text NOT NULL,
  label text NOT NULL,
  alg text NOT NULL,
  key_id text NOT NULL,
  vault_ref text,
  material_version integer NOT NULL DEFAULT 1,
  aad_meta jsonb NOT NULL DEFAULT '{}'::jsonb,
  rotated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT secret_meta_pkey PRIMARY KEY (tenant_id, id)
);
CREATE INDEX IF NOT EXISTS idx_secret_meta_tenant_updated
  ON public.secret_meta (tenant_id, updated_at DESC);

-- Backfill projection tables from legacy storage (idempotent via ON CONFLICT DO NOTHING).
INSERT INTO public.bot_entities (tenant_id, id, payload, created_at, updated_at)
SELECT b.tenant_id, b.id, COALESCE(b.data, '{}'::jsonb), b.created_at, b.updated_at
FROM public.bots b
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO public.resource_items (tenant_id, kind, id, payload, created_at, updated_at)
SELECT r.tenant_id, 'licenses', r.id, COALESCE(r.data, '{}'::jsonb), r.created_at, r.updated_at
FROM public.resources_licenses r
ON CONFLICT (tenant_id, kind, id) DO NOTHING;

INSERT INTO public.resource_items (tenant_id, kind, id, payload, created_at, updated_at)
SELECT r.tenant_id, 'proxies', r.id, COALESCE(r.data, '{}'::jsonb), r.created_at, r.updated_at
FROM public.resources_proxies r
ON CONFLICT (tenant_id, kind, id) DO NOTHING;

INSERT INTO public.resource_items (tenant_id, kind, id, payload, created_at, updated_at)
SELECT r.tenant_id, 'subscriptions', r.id, COALESCE(r.data, '{}'::jsonb), r.created_at, r.updated_at
FROM public.resources_subscriptions r
ON CONFLICT (tenant_id, kind, id) DO NOTHING;

INSERT INTO public.workspace_items (tenant_id, kind, id, payload, created_at, updated_at)
SELECT w.tenant_id, 'notes', w.id, COALESCE(w.data, '{}'::jsonb), w.created_at, w.updated_at
FROM public.workspace_notes w
ON CONFLICT (tenant_id, kind, id) DO NOTHING;

INSERT INTO public.workspace_items (tenant_id, kind, id, payload, created_at, updated_at)
SELECT w.tenant_id, 'calendar_events', w.id, COALESCE(w.data, '{}'::jsonb), w.created_at, w.updated_at
FROM public.workspace_calendar_events w
ON CONFLICT (tenant_id, kind, id) DO NOTHING;

INSERT INTO public.workspace_items (tenant_id, kind, id, payload, created_at, updated_at)
SELECT w.tenant_id, 'kanban_tasks', w.id, COALESCE(w.data, '{}'::jsonb), w.created_at, w.updated_at
FROM public.workspace_kanban_tasks w
ON CONFLICT (tenant_id, kind, id) DO NOTHING;

INSERT INTO public.playbook_items (tenant_id, id, payload, created_at, updated_at)
SELECT p.tenant_id, p.id::text, to_jsonb(p) - 'tenant_id' - 'id', p.created_at, p.updated_at
FROM public.playbooks p
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO public.theme_asset_items (tenant_id, id, payload, created_at, updated_at)
SELECT t.tenant_id, t.id::text, to_jsonb(t) - 'tenant_id' - 'id', t.created_at, t.updated_at
FROM public.theme_background_assets t
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO public.license_lease_items (tenant_id, id, payload, created_at, updated_at)
SELECT e.tenant_id, e.id::text, to_jsonb(e) - 'tenant_id' - 'id',
       to_timestamp(e.created_at_ms::double precision / 1000.0),
       to_timestamp(e.updated_at_ms::double precision / 1000.0)
FROM public.execution_leases e
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO public.artifact_release_items (tenant_id, id, payload, created_at, updated_at)
SELECT a.tenant_id, a.id::integer, to_jsonb(a) - 'tenant_id' - 'id', a.created_at, a.updated_at
FROM public.artifact_releases a
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO public.artifact_assignment_items (
  tenant_id, id, module, platform, channel, user_key, payload, created_at, updated_at
)
SELECT a.tenant_id, a.id::integer, a.module, a.platform, a.channel, a.user_id,
       to_jsonb(a) - 'tenant_id' - 'id' - 'module' - 'platform' - 'channel' - 'user_id',
       a.created_at, a.updated_at
FROM public.artifact_assignments a
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO public.provisioning_profile_items (tenant_id, id, payload, created_at, updated_at)
SELECT u.tenant_id, u.id::text, to_jsonb(u) - 'tenant_id' - 'id', u.created_at, u.updated_at
FROM public.unattend_profiles u
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO public.provisioning_token_items (token, tenant_id, payload, expires_at, created_at, updated_at)
SELECT p.token, p.tenant_id, COALESCE(p.metadata, '{}'::jsonb), p.expires_at, p.issued_at, COALESCE(p.used_at, p.issued_at)
FROM public.provisioning_tokens p
ON CONFLICT (token) DO NOTHING;

INSERT INTO public.provisioning_progress_items (tenant_id, id, vm_uuid, payload, created_at, updated_at)
SELECT p.tenant_id, p.id::text, p.vm_uuid, COALESCE(p.details, '{}'::jsonb), p.created_at, p.created_at
FROM public.vm_setup_progress p
ON CONFLICT (tenant_id, id) DO NOTHING;

INSERT INTO public.secret_meta (
  tenant_id, id, label, alg, key_id, aad_meta, rotated_at, created_at, updated_at
)
SELECT s.tenant_id, s.id::text, s.label, s.alg, s.key_id, COALESCE(s.aad_meta, '{}'::jsonb), s.rotated_at, s.created_at, s.updated_at
FROM public.secrets_ciphertext s
ON CONFLICT (tenant_id, id) DO NOTHING;

COMMIT;
