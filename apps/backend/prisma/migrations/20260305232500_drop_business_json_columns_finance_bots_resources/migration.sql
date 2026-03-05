ALTER TABLE public.finance_operations
  DROP COLUMN IF EXISTS payload,
  DROP COLUMN IF EXISTS data;

ALTER TABLE public.bots
  DROP COLUMN IF EXISTS data;

ALTER TABLE public.resources_licenses
  DROP COLUMN IF EXISTS data;

ALTER TABLE public.resources_proxies
  DROP COLUMN IF EXISTS data;

ALTER TABLE public.resources_subscriptions
  DROP COLUMN IF EXISTS data;
