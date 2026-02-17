-- Playbooks (user-created YAML playbooks for Winsible-style automation)
CREATE TABLE IF NOT EXISTS playbooks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   TEXT NOT NULL DEFAULT 'default',
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL,
  is_default  BOOLEAN DEFAULT false,
  content     TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_playbooks_user ON playbooks(tenant_id, user_id);

-- Link provisioning tokens to the playbook used during ISO generation
ALTER TABLE provisioning_tokens
  ADD COLUMN IF NOT EXISTS playbook_id UUID REFERENCES playbooks(id) ON DELETE SET NULL;
