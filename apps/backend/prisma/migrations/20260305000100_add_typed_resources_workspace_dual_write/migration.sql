-- Stage typed resources/workspace tables for dual-write migration.
-- Idempotent by design for environments that already applied Supabase migrations.

CREATE TABLE IF NOT EXISTS public.resources_licenses (
  tenant_id text NOT NULL DEFAULT 'default',
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resources_licenses_pkey PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.resources_proxies (
  tenant_id text NOT NULL DEFAULT 'default',
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resources_proxies_pkey PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.resources_subscriptions (
  tenant_id text NOT NULL DEFAULT 'default',
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT resources_subscriptions_pkey PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.workspace_notes (
  tenant_id text NOT NULL DEFAULT 'default',
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_notes_pkey PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.workspace_calendar_events (
  tenant_id text NOT NULL DEFAULT 'default',
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_calendar_events_pkey PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.workspace_kanban_tasks (
  tenant_id text NOT NULL DEFAULT 'default',
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT workspace_kanban_tasks_pkey PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_resources_licenses_tenant_updated
  ON public.resources_licenses (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_proxies_tenant_updated
  ON public.resources_proxies (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_subscriptions_tenant_updated
  ON public.resources_subscriptions (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_notes_tenant_updated
  ON public.workspace_notes (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_calendar_events_tenant_updated
  ON public.workspace_calendar_events (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_kanban_tasks_tenant_updated
  ON public.workspace_kanban_tasks (tenant_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.playbooks (
  tenant_id text NOT NULL DEFAULT 'default',
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT playbooks_pkey PRIMARY KEY (tenant_id, id)
);

CREATE TABLE IF NOT EXISTS public.theme_background_assets (
  tenant_id text NOT NULL DEFAULT 'default',
  id text NOT NULL,
  data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT theme_background_assets_pkey PRIMARY KEY (tenant_id, id)
);

CREATE INDEX IF NOT EXISTS idx_playbooks_tenant_updated
  ON public.playbooks (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_theme_background_assets_tenant_updated
  ON public.theme_background_assets (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_bots_tenant_updated
  ON public.bots (tenant_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_settings_updated
  ON public.app_settings (updated_at DESC);

DO $$
BEGIN
  IF to_regclass('public.finance_operations') IS NOT NULL THEN
    ALTER TABLE public.finance_operations
      ADD COLUMN IF NOT EXISTS data jsonb;

    ALTER TABLE public.finance_operations
      ADD COLUMN IF NOT EXISTS payload jsonb;

    UPDATE public.finance_operations
    SET
      data = COALESCE(data, payload, '{}'::jsonb),
      payload = COALESCE(payload, data, '{}'::jsonb)
    WHERE data IS NULL OR payload IS NULL;

    CREATE OR REPLACE FUNCTION public.sync_finance_operations_payload_data_dualwrite()
    RETURNS trigger
    LANGUAGE plpgsql
    AS $inner$
    BEGIN
      NEW.payload := COALESCE(NEW.payload, NEW.data, '{}'::jsonb);
      NEW.data := COALESCE(NEW.data, NEW.payload, '{}'::jsonb);
      RETURN NEW;
    END;
    $inner$;

    DROP TRIGGER IF EXISTS trg_sync_finance_operations_payload_data_dualwrite ON public.finance_operations;
    CREATE TRIGGER trg_sync_finance_operations_payload_data_dualwrite
    BEFORE INSERT OR UPDATE ON public.finance_operations
    FOR EACH ROW
    EXECUTE FUNCTION public.sync_finance_operations_payload_data_dualwrite();
  END IF;
END;
$$;
