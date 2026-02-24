BEGIN;

CREATE TABLE IF NOT EXISTS public.tenant_account_access (
  tenant_id text PRIMARY KEY,
  plan text NOT NULL DEFAULT 'free',
  trial_started_at timestamptz,
  trial_ends_at timestamptz,
  trial_used_at timestamptz,
  premium_until timestamptz,
  lifetime_premium boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tenant_account_access_plan_updated
  ON public.tenant_account_access (plan, updated_at DESC);

ALTER TABLE public.tenant_account_access ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS tenant_account_access_isolation ON public.tenant_account_access;
CREATE POLICY tenant_account_access_isolation ON public.tenant_account_access
  USING (tenant_id = current_setting('app.tenant_id', true))
  WITH CHECK (tenant_id = current_setting('app.tenant_id', true));

COMMIT;
