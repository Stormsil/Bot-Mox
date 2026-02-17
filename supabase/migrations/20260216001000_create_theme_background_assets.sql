CREATE TABLE IF NOT EXISTS theme_background_assets (
  id         UUID PRIMARY KEY,
  tenant_id  TEXT NOT NULL DEFAULT 'default',
  created_by TEXT,
  object_key TEXT NOT NULL,
  mime_type  TEXT NOT NULL,
  size_bytes BIGINT NOT NULL CHECK (size_bytes > 0),
  width      INTEGER,
  height     INTEGER,
  status     TEXT NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'ready', 'failed', 'deleted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_theme_background_assets_tenant_status
  ON theme_background_assets (tenant_id, status);

CREATE INDEX IF NOT EXISTS idx_theme_background_assets_tenant_created
  ON theme_background_assets (tenant_id, created_at DESC);

CREATE UNIQUE INDEX IF NOT EXISTS uq_theme_background_assets_tenant_object
  ON theme_background_assets (tenant_id, object_key);
