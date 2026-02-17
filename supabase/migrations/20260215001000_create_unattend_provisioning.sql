-- Unattend profiles (user-created autounattend.xml templates)
CREATE TABLE IF NOT EXISTS unattend_profiles (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id  TEXT NOT NULL DEFAULT 'default',
  user_id    UUID NOT NULL,
  name       TEXT NOT NULL,
  is_default BOOLEAN DEFAULT false,
  config     JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id, name)
);

-- Provisioning tokens (per-VM, long-lived)
CREATE TABLE IF NOT EXISTS provisioning_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  user_id     UUID NOT NULL,
  vm_uuid     TEXT NOT NULL,
  token       TEXT NOT NULL UNIQUE,
  status      TEXT NOT NULL DEFAULT 'active'
                CHECK (status IN ('active','used','expired','revoked')),
  issued_at   TIMESTAMPTZ DEFAULT now(),
  expires_at  TIMESTAMPTZ NOT NULL,
  used_at     TIMESTAMPTZ,
  metadata    JSONB DEFAULT '{}',
  UNIQUE(tenant_id, vm_uuid)
);

-- VM setup progress tracking
CREATE TABLE IF NOT EXISTS vm_setup_progress (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  vm_uuid     TEXT NOT NULL,
  token_id    UUID REFERENCES provisioning_tokens(id),
  step        TEXT NOT NULL,
  status      TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending','running','completed','failed')),
  details     JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_vm_setup_progress_vm
  ON vm_setup_progress(tenant_id, vm_uuid);

CREATE INDEX IF NOT EXISTS idx_provisioning_tokens_vm
  ON provisioning_tokens(tenant_id, vm_uuid);

CREATE INDEX IF NOT EXISTS idx_unattend_profiles_user
  ON unattend_profiles(tenant_id, user_id);
