-- Final typed-store cutover cleanup.
-- Retire legacy JSON-first persistence artifacts for scoped Task 10 domains.

DROP TRIGGER IF EXISTS trg_sync_finance_operations_payload_data_dualwrite
  ON public.finance_operations;

DROP FUNCTION IF EXISTS public.sync_finance_operations_payload_data_dualwrite();

ALTER TABLE IF EXISTS public.finance_operations
  DROP COLUMN IF EXISTS payload;

ALTER TABLE IF EXISTS public.app_settings
  DROP COLUMN IF EXISTS data;

DROP TABLE IF EXISTS public.bot_entities CASCADE;
DROP TABLE IF EXISTS public.resource_items CASCADE;
DROP TABLE IF EXISTS public.workspace_items CASCADE;
DROP TABLE IF EXISTS public.playbook_items CASCADE;
DROP TABLE IF EXISTS public.settings_items CASCADE;
DROP TABLE IF EXISTS public.theme_asset_items CASCADE;
