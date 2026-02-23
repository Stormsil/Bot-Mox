BEGIN;

DO $$
DECLARE
  v_table_name text;
  tenant_tables text[] := ARRAY[
    'resource_items',
    'workspace_items',
    'finance_operations',
    'bot_entities',
    'settings_items',
    'agents',
    'agent_commands',
    'secret_meta',
    'secret_bindings',
    'playbook_items',
    'theme_asset_items',
    'license_lease_items',
    'artifact_release_items',
    'artifact_assignment_items',
    'infra_vm_items',
    'infra_vm_config_items',
    'provisioning_profile_items',
    'provisioning_token_items',
    'provisioning_progress_items',
    'tenant_project_rollouts'
  ];
BEGIN
  FOREACH v_table_name IN ARRAY tenant_tables LOOP
    IF EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = v_table_name
        AND column_name = 'tenant_id'
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', v_table_name);
      EXECUTE format('DROP POLICY IF EXISTS tenant_isolation_policy ON public.%I', v_table_name);
      EXECUTE format(
        'CREATE POLICY tenant_isolation_policy ON public.%I USING (tenant_id = current_setting(''app.tenant_id'', true)) WITH CHECK (tenant_id = current_setting(''app.tenant_id'', true))',
        v_table_name
      );
    END IF;
  END LOOP;
END $$;

COMMIT;
