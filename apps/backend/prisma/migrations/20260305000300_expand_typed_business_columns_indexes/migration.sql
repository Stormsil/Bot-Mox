-- Additive typed business columns and tenant-first indexes for scoped typed-store domains.
-- Keep legacy JSON columns (`payload`/`data`) intact for staged cutover.

ALTER TABLE public.finance_operations
  ADD COLUMN IF NOT EXISTS data jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS category text,
  ADD COLUMN IF NOT EXISTS amount numeric(20, 6),
  ADD COLUMN IF NOT EXISTS currency text,
  ADD COLUMN IF NOT EXISTS operation_at timestamptz,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS project_id text,
  ADD COLUMN IF NOT EXISTS bot_id text,
  ADD COLUMN IF NOT EXISTS gold_amount numeric(20, 6),
  ADD COLUMN IF NOT EXISTS gold_price_at_time numeric(20, 6);

ALTER TABLE public.bots
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS lifecycle jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS platform text,
  ADD COLUMN IF NOT EXISTS profile text,
  ADD COLUMN IF NOT EXISTS version text,
  ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

ALTER TABLE public.resources_licenses
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS bot_id text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS port integer,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS days_remaining integer,
  ADD COLUMN IF NOT EXISTS is_expiring_soon boolean;

ALTER TABLE public.resources_proxies
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS bot_id text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS port integer,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS days_remaining integer,
  ADD COLUMN IF NOT EXISTS is_expiring_soon boolean;

ALTER TABLE public.resources_subscriptions
  ADD COLUMN IF NOT EXISTS type text,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS bot_id text,
  ADD COLUMN IF NOT EXISTS country text,
  ADD COLUMN IF NOT EXISTS country_code text,
  ADD COLUMN IF NOT EXISTS ip text,
  ADD COLUMN IF NOT EXISTS port integer,
  ADD COLUMN IF NOT EXISTS expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS days_remaining integer,
  ADD COLUMN IF NOT EXISTS is_expiring_soon boolean;

ALTER TABLE public.workspace_notes
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS preview text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blocks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

ALTER TABLE public.workspace_calendar_events
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS preview text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blocks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

ALTER TABLE public.workspace_kanban_tasks
  ADD COLUMN IF NOT EXISTS kind text,
  ADD COLUMN IF NOT EXISTS title text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS preview text,
  ADD COLUMN IF NOT EXISTS tags jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS blocks jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS priority text,
  ADD COLUMN IF NOT EXISTS start_at timestamptz,
  ADD COLUMN IF NOT EXISTS end_at timestamptz,
  ADD COLUMN IF NOT EXISTS due_at timestamptz;

ALTER TABLE public.playbooks
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS content text,
  ADD COLUMN IF NOT EXISTS is_default boolean,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS version text;

ALTER TABLE public.app_settings
  ADD COLUMN IF NOT EXISTS path text,
  ADD COLUMN IF NOT EXISTS value jsonb DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS namespace text,
  ADD COLUMN IF NOT EXISTS value_type text;

ALTER TABLE public.theme_background_assets
  ADD COLUMN IF NOT EXISTS object_key text,
  ADD COLUMN IF NOT EXISTS mime_type text,
  ADD COLUMN IF NOT EXISTS size_bytes integer,
  ADD COLUMN IF NOT EXISTS width integer,
  ADD COLUMN IF NOT EXISTS height integer,
  ADD COLUMN IF NOT EXISTS status text,
  ADD COLUMN IF NOT EXISTS image_url text,
  ADD COLUMN IF NOT EXISTS image_url_expires_at_ms bigint;

CREATE INDEX IF NOT EXISTS idx_finance_operations_tenant_operation_at
  ON public.finance_operations (tenant_id, operation_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_operations_tenant_status_operation_at
  ON public.finance_operations (tenant_id, status, operation_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_operations_tenant_category_operation_at
  ON public.finance_operations (tenant_id, category, operation_at DESC);
CREATE INDEX IF NOT EXISTS idx_finance_operations_tenant_currency_operation_at
  ON public.finance_operations (tenant_id, currency, operation_at DESC);

CREATE INDEX IF NOT EXISTS idx_bots_tenant_status_updated
  ON public.bots (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bots_tenant_platform_updated
  ON public.bots (tenant_id, platform, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_bots_tenant_last_seen
  ON public.bots (tenant_id, last_seen_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_licenses_tenant_status_expires
  ON public.resources_licenses (tenant_id, status, expires_at ASC);
CREATE INDEX IF NOT EXISTS idx_resources_licenses_tenant_type_updated
  ON public.resources_licenses (tenant_id, type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_licenses_tenant_bot_updated
  ON public.resources_licenses (tenant_id, bot_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_licenses_tenant_country_updated
  ON public.resources_licenses (tenant_id, country_code, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_proxies_tenant_status_expires
  ON public.resources_proxies (tenant_id, status, expires_at ASC);
CREATE INDEX IF NOT EXISTS idx_resources_proxies_tenant_type_updated
  ON public.resources_proxies (tenant_id, type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_proxies_tenant_bot_updated
  ON public.resources_proxies (tenant_id, bot_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_proxies_tenant_country_updated
  ON public.resources_proxies (tenant_id, country_code, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_resources_subscriptions_tenant_status_expires
  ON public.resources_subscriptions (tenant_id, status, expires_at ASC);
CREATE INDEX IF NOT EXISTS idx_resources_subscriptions_tenant_type_updated
  ON public.resources_subscriptions (tenant_id, type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_subscriptions_tenant_bot_updated
  ON public.resources_subscriptions (tenant_id, bot_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_resources_subscriptions_tenant_country_updated
  ON public.resources_subscriptions (tenant_id, country_code, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_workspace_notes_tenant_kind_updated
  ON public.workspace_notes (tenant_id, kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_notes_tenant_status_updated
  ON public.workspace_notes (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_notes_tenant_priority_due
  ON public.workspace_notes (tenant_id, priority, due_at ASC);

CREATE INDEX IF NOT EXISTS idx_workspace_calendar_events_tenant_kind_updated
  ON public.workspace_calendar_events (tenant_id, kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_calendar_events_tenant_status_start
  ON public.workspace_calendar_events (tenant_id, status, start_at ASC);
CREATE INDEX IF NOT EXISTS idx_workspace_calendar_events_tenant_priority_due
  ON public.workspace_calendar_events (tenant_id, priority, due_at ASC);

CREATE INDEX IF NOT EXISTS idx_workspace_kanban_tasks_tenant_kind_updated
  ON public.workspace_kanban_tasks (tenant_id, kind, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_kanban_tasks_tenant_status_updated
  ON public.workspace_kanban_tasks (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_workspace_kanban_tasks_tenant_priority_due
  ON public.workspace_kanban_tasks (tenant_id, priority, due_at ASC);

CREATE INDEX IF NOT EXISTS idx_playbooks_tenant_status_updated
  ON public.playbooks (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_playbooks_tenant_default_updated
  ON public.playbooks (tenant_id, is_default, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_app_settings_tenant_namespace_updated
  ON public.app_settings (tenant_id, namespace, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_app_settings_tenant_path
  ON public.app_settings (tenant_id, path);

CREATE INDEX IF NOT EXISTS idx_theme_background_assets_tenant_status_updated
  ON public.theme_background_assets (tenant_id, status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_theme_background_assets_tenant_mime_updated
  ON public.theme_background_assets (tenant_id, mime_type, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_theme_background_assets_tenant_object_key
  ON public.theme_background_assets (tenant_id, object_key);
