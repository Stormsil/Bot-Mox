BEGIN;

CREATE TABLE IF NOT EXISTS public.project_catalog_releases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_key text NOT NULL,
  version text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  artifacts jsonb NOT NULL DEFAULT '[]'::jsonb,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_project_catalog_release_version UNIQUE (project_key, version)
);
CREATE INDEX IF NOT EXISTS idx_project_catalog_release_project_status
  ON public.project_catalog_releases (project_key, status, updated_at DESC);

CREATE TABLE IF NOT EXISTS public.tenant_project_rollouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id text NOT NULL,
  project_key text NOT NULL,
  release_id uuid NOT NULL REFERENCES public.project_catalog_releases(id) ON DELETE RESTRICT,
  status text NOT NULL DEFAULT 'rolled_out',
  wave text,
  notes text,
  rolled_out_at timestamptz NOT NULL DEFAULT now(),
  updated_by text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ux_tenant_project_rollout_scope UNIQUE (tenant_id, project_key)
);
CREATE INDEX IF NOT EXISTS idx_tenant_project_rollout_tenant_updated
  ON public.tenant_project_rollouts (tenant_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_tenant_project_rollout_project_status
  ON public.tenant_project_rollouts (project_key, status, updated_at DESC);

ALTER TABLE public.tenant_project_rollouts ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_project_rollouts_isolation ON public.tenant_project_rollouts;
CREATE POLICY tenant_project_rollouts_isolation ON public.tenant_project_rollouts
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

COMMIT;
