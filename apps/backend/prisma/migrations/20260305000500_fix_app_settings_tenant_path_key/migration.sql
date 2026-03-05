-- Fix app_settings typed key contract to be tenant + path.
-- This keeps typed reads/writes path-stable for multi-path tenants.

UPDATE public.app_settings
SET path = '__legacy__/default'
WHERE path IS NULL OR btrim(path) = '';

ALTER TABLE public.app_settings
  ALTER COLUMN path SET NOT NULL;

ALTER TABLE public.app_settings
  DROP CONSTRAINT IF EXISTS app_settings_pkey;

ALTER TABLE public.app_settings
  ADD CONSTRAINT app_settings_pkey PRIMARY KEY (tenant_id, path);
