-- Deterministic, idempotent typed-column backfill for scoped business domains.
-- Keeps legacy JSON columns/tables intact.

CREATE OR REPLACE FUNCTION pg_temp.botmox_try_numeric(raw text)
RETURNS numeric
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN btrim(raw) = '' THEN NULL
    WHEN btrim(raw) ~ '^-?[0-9]+(\.[0-9]+)?$' THEN btrim(raw)::numeric
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.botmox_try_integer(raw text)
RETURNS integer
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN btrim(raw) = '' THEN NULL
    WHEN btrim(raw) ~ '^-?[0-9]+$' THEN btrim(raw)::integer
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.botmox_try_bigint(raw text)
RETURNS bigint
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN btrim(raw) = '' THEN NULL
    WHEN btrim(raw) ~ '^-?[0-9]+$' THEN btrim(raw)::bigint
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.botmox_try_boolean(raw text)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
AS $$
  SELECT CASE
    WHEN raw IS NULL THEN NULL
    WHEN lower(btrim(raw)) IN ('true', 't', '1', 'yes', 'y', 'on') THEN TRUE
    WHEN lower(btrim(raw)) IN ('false', 'f', '0', 'no', 'n', 'off') THEN FALSE
    ELSE NULL
  END
$$;

CREATE OR REPLACE FUNCTION pg_temp.botmox_try_timestamptz(raw text)
RETURNS timestamptz
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  normalized text;
  numeric_value numeric;
BEGIN
  normalized := NULLIF(btrim(raw), '');
  IF normalized IS NULL THEN
    RETURN NULL;
  END IF;

  IF normalized ~ '^-?[0-9]+(\.[0-9]+)?$' THEN
    numeric_value := normalized::numeric;
    IF abs(numeric_value) >= 100000000000::numeric THEN
      RETURN to_timestamp((numeric_value / 1000.0)::double precision);
    END IF;
    RETURN to_timestamp(numeric_value::double precision);
  END IF;

  BEGIN
    RETURN normalized::timestamptz;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

-- finance
UPDATE public.finance_operations AS f
SET
  type = COALESCE(
    f.type,
    NULLIF(btrim(COALESCE(f.data->>'type', f.payload->>'type')), '')
  ),
  category = COALESCE(
    f.category,
    NULLIF(btrim(COALESCE(f.data->>'category', f.payload->>'category')), '')
  ),
  amount = COALESCE(
    f.amount,
    pg_temp.botmox_try_numeric(COALESCE(f.data->>'amount', f.payload->>'amount'))
  ),
  currency = COALESCE(
    f.currency,
    NULLIF(btrim(COALESCE(f.data->>'currency', f.payload->>'currency')), '')
  ),
  operation_at = COALESCE(
    f.operation_at,
    pg_temp.botmox_try_timestamptz(
      COALESCE(f.data->>'operation_at', f.data->>'date', f.payload->>'operation_at', f.payload->>'date')
    )
  ),
  status = COALESCE(
    f.status,
    NULLIF(btrim(COALESCE(f.data->>'status', f.payload->>'status')), '')
  ),
  project_id = COALESCE(
    f.project_id,
    NULLIF(btrim(COALESCE(f.data->>'project_id', f.payload->>'project_id')), '')
  ),
  bot_id = COALESCE(
    f.bot_id,
    NULLIF(btrim(COALESCE(f.data->>'bot_id', f.payload->>'bot_id')), '')
  ),
  gold_amount = COALESCE(
    f.gold_amount,
    pg_temp.botmox_try_numeric(COALESCE(f.data->>'gold_amount', f.payload->>'gold_amount'))
  ),
  gold_price_at_time = COALESCE(
    f.gold_price_at_time,
    pg_temp.botmox_try_numeric(
      COALESCE(f.data->>'gold_price_at_time', f.payload->>'gold_price_at_time')
    )
  )
WHERE
  f.type IS NULL
  OR f.category IS NULL
  OR f.amount IS NULL
  OR f.currency IS NULL
  OR f.operation_at IS NULL
  OR f.status IS NULL
  OR f.project_id IS NULL
  OR f.bot_id IS NULL
  OR f.gold_amount IS NULL
  OR f.gold_price_at_time IS NULL;

-- bots
UPDATE public.bots AS b
SET
  status = COALESCE(
    b.status,
    NULLIF(btrim(COALESCE(b.data->>'status', src.payload->>'status')), '')
  ),
  lifecycle = COALESCE(
    b.lifecycle,
    CASE
      WHEN jsonb_typeof(COALESCE(b.data->'lifecycle', src.payload->'lifecycle')) = 'object'
        THEN COALESCE(b.data->'lifecycle', src.payload->'lifecycle')
      ELSE NULL
    END
  ),
  platform = COALESCE(
    b.platform,
    NULLIF(btrim(COALESCE(b.data->>'platform', src.payload->>'platform')), '')
  ),
  profile = COALESCE(
    b.profile,
    NULLIF(btrim(COALESCE(b.data->>'profile', src.payload->>'profile')), '')
  ),
  version = COALESCE(
    b.version,
    NULLIF(btrim(COALESCE(b.data->>'version', src.payload->>'version')), '')
  ),
  last_seen_at = COALESCE(
    b.last_seen_at,
    pg_temp.botmox_try_timestamptz(COALESCE(b.data->>'last_seen_at', src.payload->>'last_seen_at'))
  )
FROM LATERAL (
  SELECT (
    SELECT e.payload
    FROM public.bot_entities AS e
    WHERE e.tenant_id = b.tenant_id
      AND e.id = b.id
    LIMIT 1
  ) AS payload
) AS src
WHERE
  (
    b.status IS NULL
    OR b.lifecycle IS NULL
    OR b.platform IS NULL
    OR b.profile IS NULL
    OR b.version IS NULL
    OR b.last_seen_at IS NULL
  );

-- resources
UPDATE public.resources_licenses AS r
SET
  type = COALESCE(r.type, NULLIF(btrim(COALESCE(r.data->>'type', src.payload->>'type')), '')),
  status = COALESCE(r.status, NULLIF(btrim(COALESCE(r.data->>'status', src.payload->>'status')), '')),
  bot_id = COALESCE(r.bot_id, NULLIF(btrim(COALESCE(r.data->>'bot_id', src.payload->>'bot_id')), '')),
  country = COALESCE(r.country, NULLIF(btrim(COALESCE(r.data->>'country', src.payload->>'country')), '')),
  country_code = COALESCE(
    r.country_code,
    NULLIF(btrim(COALESCE(r.data->>'country_code', src.payload->>'country_code')), '')
  ),
  ip = COALESCE(r.ip, NULLIF(btrim(COALESCE(r.data->>'ip', src.payload->>'ip')), '')),
  port = COALESCE(r.port, pg_temp.botmox_try_integer(COALESCE(r.data->>'port', src.payload->>'port'))),
  expires_at = COALESCE(
    r.expires_at,
    pg_temp.botmox_try_timestamptz(COALESCE(r.data->>'expires_at', src.payload->>'expires_at'))
  ),
  days_remaining = COALESCE(
    r.days_remaining,
    pg_temp.botmox_try_integer(COALESCE(r.data->>'days_remaining', src.payload->>'days_remaining'))
  ),
  is_expiring_soon = COALESCE(
    r.is_expiring_soon,
    pg_temp.botmox_try_boolean(COALESCE(r.data->>'is_expiring_soon', src.payload->>'is_expiring_soon'))
  )
FROM LATERAL (
  SELECT (
    SELECT i.payload
    FROM public.resource_items AS i
    WHERE i.tenant_id = r.tenant_id
      AND i.id = r.id
      AND i.kind = 'licenses'
    LIMIT 1
  ) AS payload
) AS src
WHERE
  (
    r.type IS NULL
    OR r.status IS NULL
    OR r.bot_id IS NULL
    OR r.country IS NULL
    OR r.country_code IS NULL
    OR r.ip IS NULL
    OR r.port IS NULL
    OR r.expires_at IS NULL
    OR r.days_remaining IS NULL
    OR r.is_expiring_soon IS NULL
  );

UPDATE public.resources_proxies AS r
SET
  type = COALESCE(r.type, NULLIF(btrim(COALESCE(r.data->>'type', src.payload->>'type')), '')),
  status = COALESCE(r.status, NULLIF(btrim(COALESCE(r.data->>'status', src.payload->>'status')), '')),
  bot_id = COALESCE(r.bot_id, NULLIF(btrim(COALESCE(r.data->>'bot_id', src.payload->>'bot_id')), '')),
  country = COALESCE(r.country, NULLIF(btrim(COALESCE(r.data->>'country', src.payload->>'country')), '')),
  country_code = COALESCE(
    r.country_code,
    NULLIF(btrim(COALESCE(r.data->>'country_code', src.payload->>'country_code')), '')
  ),
  ip = COALESCE(r.ip, NULLIF(btrim(COALESCE(r.data->>'ip', src.payload->>'ip')), '')),
  port = COALESCE(r.port, pg_temp.botmox_try_integer(COALESCE(r.data->>'port', src.payload->>'port'))),
  expires_at = COALESCE(
    r.expires_at,
    pg_temp.botmox_try_timestamptz(COALESCE(r.data->>'expires_at', src.payload->>'expires_at'))
  ),
  days_remaining = COALESCE(
    r.days_remaining,
    pg_temp.botmox_try_integer(COALESCE(r.data->>'days_remaining', src.payload->>'days_remaining'))
  ),
  is_expiring_soon = COALESCE(
    r.is_expiring_soon,
    pg_temp.botmox_try_boolean(COALESCE(r.data->>'is_expiring_soon', src.payload->>'is_expiring_soon'))
  )
FROM LATERAL (
  SELECT (
    SELECT i.payload
    FROM public.resource_items AS i
    WHERE i.tenant_id = r.tenant_id
      AND i.id = r.id
      AND i.kind = 'proxies'
    LIMIT 1
  ) AS payload
) AS src
WHERE
  (
    r.type IS NULL
    OR r.status IS NULL
    OR r.bot_id IS NULL
    OR r.country IS NULL
    OR r.country_code IS NULL
    OR r.ip IS NULL
    OR r.port IS NULL
    OR r.expires_at IS NULL
    OR r.days_remaining IS NULL
    OR r.is_expiring_soon IS NULL
  );

UPDATE public.resources_subscriptions AS r
SET
  type = COALESCE(r.type, NULLIF(btrim(COALESCE(r.data->>'type', src.payload->>'type')), '')),
  status = COALESCE(r.status, NULLIF(btrim(COALESCE(r.data->>'status', src.payload->>'status')), '')),
  bot_id = COALESCE(r.bot_id, NULLIF(btrim(COALESCE(r.data->>'bot_id', src.payload->>'bot_id')), '')),
  country = COALESCE(r.country, NULLIF(btrim(COALESCE(r.data->>'country', src.payload->>'country')), '')),
  country_code = COALESCE(
    r.country_code,
    NULLIF(btrim(COALESCE(r.data->>'country_code', src.payload->>'country_code')), '')
  ),
  ip = COALESCE(r.ip, NULLIF(btrim(COALESCE(r.data->>'ip', src.payload->>'ip')), '')),
  port = COALESCE(r.port, pg_temp.botmox_try_integer(COALESCE(r.data->>'port', src.payload->>'port'))),
  expires_at = COALESCE(
    r.expires_at,
    pg_temp.botmox_try_timestamptz(COALESCE(r.data->>'expires_at', src.payload->>'expires_at'))
  ),
  days_remaining = COALESCE(
    r.days_remaining,
    pg_temp.botmox_try_integer(COALESCE(r.data->>'days_remaining', src.payload->>'days_remaining'))
  ),
  is_expiring_soon = COALESCE(
    r.is_expiring_soon,
    pg_temp.botmox_try_boolean(COALESCE(r.data->>'is_expiring_soon', src.payload->>'is_expiring_soon'))
  )
FROM LATERAL (
  SELECT (
    SELECT i.payload
    FROM public.resource_items AS i
    WHERE i.tenant_id = r.tenant_id
      AND i.id = r.id
      AND i.kind = 'subscriptions'
    LIMIT 1
  ) AS payload
) AS src
WHERE
  (
    r.type IS NULL
    OR r.status IS NULL
    OR r.bot_id IS NULL
    OR r.country IS NULL
    OR r.country_code IS NULL
    OR r.ip IS NULL
    OR r.port IS NULL
    OR r.expires_at IS NULL
    OR r.days_remaining IS NULL
    OR r.is_expiring_soon IS NULL
  );

-- workspace
UPDATE public.workspace_notes AS w
SET
  kind = COALESCE(w.kind, NULLIF(btrim(COALESCE(w.data->>'kind', src.payload->>'kind')), '')),
  title = COALESCE(w.title, NULLIF(btrim(COALESCE(w.data->>'title', src.payload->>'title')), '')),
  content = COALESCE(w.content, NULLIF(btrim(COALESCE(w.data->>'content', src.payload->>'content')), '')),
  preview = COALESCE(w.preview, NULLIF(btrim(COALESCE(w.data->>'preview', src.payload->>'preview')), '')),
  tags = COALESCE(
    w.tags,
    CASE
      WHEN jsonb_typeof(COALESCE(w.data->'tags', src.payload->'tags')) = 'array'
        THEN COALESCE(w.data->'tags', src.payload->'tags')
      ELSE NULL
    END
  ),
  blocks = COALESCE(
    w.blocks,
    CASE
      WHEN jsonb_typeof(COALESCE(w.data->'blocks', src.payload->'blocks')) IN ('array', 'object')
        THEN COALESCE(w.data->'blocks', src.payload->'blocks')
      ELSE NULL
    END
  ),
  status = COALESCE(w.status, NULLIF(btrim(COALESCE(w.data->>'status', src.payload->>'status')), '')),
  priority = COALESCE(
    w.priority,
    NULLIF(btrim(COALESCE(w.data->>'priority', src.payload->>'priority')), '')
  ),
  start_at = COALESCE(
    w.start_at,
    pg_temp.botmox_try_timestamptz(COALESCE(w.data->>'start_at', src.payload->>'start_at'))
  ),
  end_at = COALESCE(
    w.end_at,
    pg_temp.botmox_try_timestamptz(COALESCE(w.data->>'end_at', src.payload->>'end_at'))
  ),
  due_at = COALESCE(
    w.due_at,
    pg_temp.botmox_try_timestamptz(COALESCE(w.data->>'due_at', src.payload->>'due_at'))
  )
FROM LATERAL (
  SELECT (
    SELECT i.payload
    FROM public.workspace_items AS i
    WHERE i.tenant_id = w.tenant_id
      AND i.id = w.id
      AND i.kind = 'notes'
    LIMIT 1
  ) AS payload
) AS src
WHERE
  (
    w.kind IS NULL
    OR w.title IS NULL
    OR w.content IS NULL
    OR w.preview IS NULL
    OR w.tags IS NULL
    OR w.blocks IS NULL
    OR w.status IS NULL
    OR w.priority IS NULL
    OR w.start_at IS NULL
    OR w.end_at IS NULL
    OR w.due_at IS NULL
  );

UPDATE public.workspace_calendar_events AS w
SET
  kind = COALESCE(w.kind, NULLIF(btrim(COALESCE(w.data->>'kind', src.payload->>'kind')), '')),
  title = COALESCE(w.title, NULLIF(btrim(COALESCE(w.data->>'title', src.payload->>'title')), '')),
  content = COALESCE(w.content, NULLIF(btrim(COALESCE(w.data->>'content', src.payload->>'content')), '')),
  preview = COALESCE(w.preview, NULLIF(btrim(COALESCE(w.data->>'preview', src.payload->>'preview')), '')),
  tags = COALESCE(
    w.tags,
    CASE
      WHEN jsonb_typeof(COALESCE(w.data->'tags', src.payload->'tags')) = 'array'
        THEN COALESCE(w.data->'tags', src.payload->'tags')
      ELSE NULL
    END
  ),
  blocks = COALESCE(
    w.blocks,
    CASE
      WHEN jsonb_typeof(COALESCE(w.data->'blocks', src.payload->'blocks')) IN ('array', 'object')
        THEN COALESCE(w.data->'blocks', src.payload->'blocks')
      ELSE NULL
    END
  ),
  status = COALESCE(w.status, NULLIF(btrim(COALESCE(w.data->>'status', src.payload->>'status')), '')),
  priority = COALESCE(
    w.priority,
    NULLIF(btrim(COALESCE(w.data->>'priority', src.payload->>'priority')), '')
  ),
  start_at = COALESCE(
    w.start_at,
    pg_temp.botmox_try_timestamptz(COALESCE(w.data->>'start_at', src.payload->>'start_at'))
  ),
  end_at = COALESCE(
    w.end_at,
    pg_temp.botmox_try_timestamptz(COALESCE(w.data->>'end_at', src.payload->>'end_at'))
  ),
  due_at = COALESCE(
    w.due_at,
    pg_temp.botmox_try_timestamptz(COALESCE(w.data->>'due_at', src.payload->>'due_at'))
  )
FROM LATERAL (
  SELECT (
    SELECT i.payload
    FROM public.workspace_items AS i
    WHERE i.tenant_id = w.tenant_id
      AND i.id = w.id
      AND i.kind = 'calendar'
    LIMIT 1
  ) AS payload
) AS src
WHERE
  (
    w.kind IS NULL
    OR w.title IS NULL
    OR w.content IS NULL
    OR w.preview IS NULL
    OR w.tags IS NULL
    OR w.blocks IS NULL
    OR w.status IS NULL
    OR w.priority IS NULL
    OR w.start_at IS NULL
    OR w.end_at IS NULL
    OR w.due_at IS NULL
  );

UPDATE public.workspace_kanban_tasks AS w
SET
  kind = COALESCE(w.kind, NULLIF(btrim(COALESCE(w.data->>'kind', src.payload->>'kind')), '')),
  title = COALESCE(w.title, NULLIF(btrim(COALESCE(w.data->>'title', src.payload->>'title')), '')),
  content = COALESCE(w.content, NULLIF(btrim(COALESCE(w.data->>'content', src.payload->>'content')), '')),
  preview = COALESCE(w.preview, NULLIF(btrim(COALESCE(w.data->>'preview', src.payload->>'preview')), '')),
  tags = COALESCE(
    w.tags,
    CASE
      WHEN jsonb_typeof(COALESCE(w.data->'tags', src.payload->'tags')) = 'array'
        THEN COALESCE(w.data->'tags', src.payload->'tags')
      ELSE NULL
    END
  ),
  blocks = COALESCE(
    w.blocks,
    CASE
      WHEN jsonb_typeof(COALESCE(w.data->'blocks', src.payload->'blocks')) IN ('array', 'object')
        THEN COALESCE(w.data->'blocks', src.payload->'blocks')
      ELSE NULL
    END
  ),
  status = COALESCE(w.status, NULLIF(btrim(COALESCE(w.data->>'status', src.payload->>'status')), '')),
  priority = COALESCE(
    w.priority,
    NULLIF(btrim(COALESCE(w.data->>'priority', src.payload->>'priority')), '')
  ),
  start_at = COALESCE(
    w.start_at,
    pg_temp.botmox_try_timestamptz(COALESCE(w.data->>'start_at', src.payload->>'start_at'))
  ),
  end_at = COALESCE(
    w.end_at,
    pg_temp.botmox_try_timestamptz(COALESCE(w.data->>'end_at', src.payload->>'end_at'))
  ),
  due_at = COALESCE(
    w.due_at,
    pg_temp.botmox_try_timestamptz(COALESCE(w.data->>'due_at', src.payload->>'due_at'))
  )
FROM LATERAL (
  SELECT (
    SELECT i.payload
    FROM public.workspace_items AS i
    WHERE i.tenant_id = w.tenant_id
      AND i.id = w.id
      AND i.kind = 'kanban'
    LIMIT 1
  ) AS payload
) AS src
WHERE
  (
    w.kind IS NULL
    OR w.title IS NULL
    OR w.content IS NULL
    OR w.preview IS NULL
    OR w.tags IS NULL
    OR w.blocks IS NULL
    OR w.status IS NULL
    OR w.priority IS NULL
    OR w.start_at IS NULL
    OR w.end_at IS NULL
    OR w.due_at IS NULL
  );

-- playbooks
UPDATE public.playbooks AS p
SET
  name = COALESCE(p.name, NULLIF(btrim(COALESCE(p.data->>'name', src.payload->>'name')), '')),
  content = COALESCE(
    p.content,
    NULLIF(btrim(COALESCE(p.data->>'content', src.payload->>'content')), '')
  ),
  is_default = COALESCE(
    p.is_default,
    pg_temp.botmox_try_boolean(COALESCE(p.data->>'is_default', src.payload->>'is_default'))
  ),
  status = COALESCE(p.status, NULLIF(btrim(COALESCE(p.data->>'status', src.payload->>'status')), '')),
  version = COALESCE(
    p.version,
    NULLIF(btrim(COALESCE(p.data->>'version', src.payload->>'version')), '')
  )
FROM LATERAL (
  SELECT (
    SELECT i.payload
    FROM public.playbook_items AS i
    WHERE i.tenant_id = p.tenant_id
      AND i.id = p.id
    LIMIT 1
  ) AS payload
) AS src
WHERE
  (
    p.name IS NULL
    OR p.content IS NULL
    OR p.is_default IS NULL
    OR p.status IS NULL
    OR p.version IS NULL
  );

-- settings
WITH latest_legacy_per_tenant AS (
  SELECT DISTINCT ON (s.tenant_id)
    s.tenant_id,
    s.path,
    s.payload
  FROM public.settings_items AS s
  WHERE NULLIF(btrim(s.path), '') IS NOT NULL
  ORDER BY s.tenant_id, s.updated_at DESC, s.path ASC
),
first_data_path_per_tenant AS (
  SELECT
    a.tenant_id,
    k.path,
    a.data -> k.path AS payload
  FROM public.app_settings AS a
  CROSS JOIN LATERAL (
    SELECT key AS path
    FROM jsonb_object_keys(COALESCE(a.data, '{}'::jsonb)) AS key
    ORDER BY key ASC
    LIMIT 1
  ) AS k
),
resolved_settings_source AS (
  SELECT
    COALESCE(l.tenant_id, d.tenant_id) AS tenant_id,
    COALESCE(NULLIF(btrim(l.path), ''), NULLIF(btrim(d.path), '')) AS path,
    COALESCE(l.payload, d.payload) AS payload
  FROM latest_legacy_per_tenant AS l
  FULL OUTER JOIN first_data_path_per_tenant AS d
    ON d.tenant_id = l.tenant_id
)
UPDATE public.app_settings AS a
SET
  path = COALESCE(a.path, src.path),
  value = COALESCE(a.value, src.payload),
  namespace = COALESCE(
    a.namespace,
    CASE
      WHEN src.path IS NULL THEN NULL
      ELSE NULLIF(split_part(src.path, '/', 1), '')
    END
  ),
  value_type = COALESCE(
    a.value_type,
    CASE
      WHEN COALESCE(a.value, src.payload) IS NULL THEN NULL
      ELSE jsonb_typeof(COALESCE(a.value, src.payload))
    END
  )
FROM resolved_settings_source AS src
WHERE
  a.tenant_id = src.tenant_id
  AND (
    a.path IS NULL
    OR a.value IS NULL
    OR a.namespace IS NULL
    OR a.value_type IS NULL
  );

-- theme-assets
UPDATE public.theme_background_assets AS t
SET
  object_key = COALESCE(
    t.object_key,
    NULLIF(btrim(COALESCE(t.data->>'object_key', src.payload->>'object_key')), '')
  ),
  mime_type = COALESCE(
    t.mime_type,
    NULLIF(btrim(COALESCE(t.data->>'mime_type', src.payload->>'mime_type')), '')
  ),
  size_bytes = COALESCE(
    t.size_bytes,
    pg_temp.botmox_try_integer(COALESCE(t.data->>'size_bytes', src.payload->>'size_bytes'))
  ),
  width = COALESCE(
    t.width,
    pg_temp.botmox_try_integer(COALESCE(t.data->>'width', src.payload->>'width'))
  ),
  height = COALESCE(
    t.height,
    pg_temp.botmox_try_integer(COALESCE(t.data->>'height', src.payload->>'height'))
  ),
  status = COALESCE(
    t.status,
    NULLIF(btrim(COALESCE(t.data->>'status', src.payload->>'status')), '')
  ),
  image_url = COALESCE(
    t.image_url,
    NULLIF(btrim(COALESCE(t.data->>'image_url', src.payload->>'image_url')), '')
  ),
  image_url_expires_at_ms = COALESCE(
    t.image_url_expires_at_ms,
    pg_temp.botmox_try_bigint(
      COALESCE(t.data->>'image_url_expires_at_ms', src.payload->>'image_url_expires_at_ms')
    )
  )
FROM LATERAL (
  SELECT (
    SELECT i.payload
    FROM public.theme_asset_items AS i
    WHERE i.tenant_id = t.tenant_id
      AND i.id = t.id
    LIMIT 1
  ) AS payload
) AS src
WHERE
  (
    t.object_key IS NULL
    OR t.mime_type IS NULL
    OR t.size_bytes IS NULL
    OR t.width IS NULL
    OR t.height IS NULL
    OR t.status IS NULL
    OR t.image_url IS NULL
    OR t.image_url_expires_at_ms IS NULL
  );
