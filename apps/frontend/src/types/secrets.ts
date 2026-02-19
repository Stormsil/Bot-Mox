export interface SecretMeta {
  id: string;
  tenant_id: string;
  label: string;
  alg: string;
  key_id: string;
  aad_meta?: Record<string, unknown>;
  rotated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecretBinding {
  id: string;
  tenant_id: string;
  scope_type: string;
  scope_id: string;
  secret_ref: string;
  field_name: string;
  created_at: string;
}

export type SecretBindingsMap = Record<string, SecretBinding>;
