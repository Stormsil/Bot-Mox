BEGIN;

CREATE TABLE IF NOT EXISTS public.admin_audit_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id text,
  actor_tenant_id text,
  action text NOT NULL,
  target_tenant_id text,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_audit_events_created
  ON public.admin_audit_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_action_created
  ON public.admin_audit_events (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_events_target_created
  ON public.admin_audit_events (target_tenant_id, created_at DESC);

COMMIT;
