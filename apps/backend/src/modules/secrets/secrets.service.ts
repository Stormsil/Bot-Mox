import { Injectable } from '@nestjs/common';

export interface SecretCreateInput {
  tenantId: string;
  label: string;
  ciphertext: string;
  alg: string;
  keyId: string;
  nonce: string;
  aadMeta?: Record<string, unknown> | undefined;
}

export interface SecretRotateInput {
  tenantId: string;
  id: string;
  ciphertext: string;
  alg?: string | undefined;
  keyId: string;
  nonce: string;
  aadMeta?: Record<string, unknown> | undefined;
}

export interface SecretMetaRecord {
  id: string;
  tenant_id: string;
  label: string;
  alg: string;
  key_id: string;
  aad_meta: Record<string, unknown>;
  rotated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SecretBindingCreateInput {
  tenantId: string;
  scopeType: 'bot' | 'vm' | 'agent' | 'tenant';
  scopeId: string;
  secretRef: string;
  fieldName: string;
}

export interface SecretBindingListInput {
  tenantId: string;
  scopeType?: 'bot' | 'vm' | 'agent' | 'tenant' | undefined;
  scopeId?: string | undefined;
}

export interface SecretBindingRecord {
  id: string;
  tenant_id: string;
  scope_type: 'bot' | 'vm' | 'agent' | 'tenant';
  scope_id: string;
  secret_ref: string;
  field_name: string;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SecretsService {
  private readonly secretStore = new Map<string, SecretMetaRecord>();
  private readonly bindingStore = new Map<string, SecretBindingRecord>();
  private secretSeq = 0;
  private bindingSeq = 0;

  private normalizeTenantId(tenantId: string | undefined): string {
    return String(tenantId || 'default').trim() || 'default';
  }

  private normalizeAadMeta(aadMeta: unknown): Record<string, unknown> {
    return aadMeta && typeof aadMeta === 'object' ? (aadMeta as Record<string, unknown>) : {};
  }

  private nextSecretId(): string {
    this.secretSeq += 1;
    return `sec-${this.secretSeq}`;
  }

  private nextBindingId(): string {
    this.bindingSeq += 1;
    return `bind-${this.bindingSeq}`;
  }

  private toCompositeBindingKey(input: {
    tenantId: string;
    scopeType: string;
    scopeId: string;
    fieldName: string;
  }): string {
    return [
      this.normalizeTenantId(input.tenantId),
      String(input.scopeType || '').trim(),
      String(input.scopeId || '').trim(),
      String(input.fieldName || '').trim(),
    ].join(':');
  }

  createSecret(input: SecretCreateInput): SecretMetaRecord {
    const nowIso = new Date().toISOString();
    const record: SecretMetaRecord = {
      id: this.nextSecretId(),
      tenant_id: this.normalizeTenantId(input.tenantId),
      label: String(input.label || '').trim(),
      alg: String(input.alg || '').trim(),
      key_id: String(input.keyId || '').trim(),
      aad_meta: this.normalizeAadMeta(input.aadMeta),
      rotated_at: null,
      created_at: nowIso,
      updated_at: nowIso,
    };

    this.secretStore.set(record.id, record);
    return record;
  }

  getSecretMeta(tenantId: string, id: string): SecretMetaRecord | null {
    const secretId = String(id || '').trim();
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const record = this.secretStore.get(secretId);
    if (!record || record.tenant_id !== normalizedTenantId) {
      return null;
    }
    return record;
  }

  rotateSecret(input: SecretRotateInput): SecretMetaRecord | null {
    const secretId = String(input.id || '').trim();
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const existing = this.secretStore.get(secretId);
    if (!existing || existing.tenant_id !== normalizedTenantId) {
      return null;
    }

    const rotated: SecretMetaRecord = {
      ...existing,
      alg: input.alg ? String(input.alg).trim() : existing.alg,
      key_id: String(input.keyId || '').trim(),
      aad_meta:
        input.aadMeta !== undefined ? this.normalizeAadMeta(input.aadMeta) : existing.aad_meta,
      rotated_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    this.secretStore.set(secretId, rotated);
    return rotated;
  }

  createBinding(input: SecretBindingCreateInput): SecretBindingRecord {
    const compositeKey = this.toCompositeBindingKey({
      tenantId: input.tenantId,
      scopeType: input.scopeType,
      scopeId: input.scopeId,
      fieldName: input.fieldName,
    });
    const existing = this.bindingStore.get(compositeKey);
    const nowIso = new Date().toISOString();

    const record: SecretBindingRecord = {
      id: existing?.id || this.nextBindingId(),
      tenant_id: this.normalizeTenantId(input.tenantId),
      scope_type: input.scopeType,
      scope_id: String(input.scopeId || '').trim(),
      secret_ref: String(input.secretRef || '').trim(),
      field_name: String(input.fieldName || '').trim(),
      created_at: existing?.created_at || nowIso,
      updated_at: nowIso,
    };

    this.bindingStore.set(compositeKey, record);
    return record;
  }

  listBindings(input: SecretBindingListInput): SecretBindingRecord[] {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const normalizedScopeType = input.scopeType ? String(input.scopeType).trim() : '';
    const normalizedScopeId = input.scopeId ? String(input.scopeId).trim() : '';

    return [...this.bindingStore.values()]
      .filter((record) => {
        if (record.tenant_id !== normalizedTenantId) {
          return false;
        }
        if (normalizedScopeType && record.scope_type !== normalizedScopeType) {
          return false;
        }
        if (normalizedScopeId && record.scope_id !== normalizedScopeId) {
          return false;
        }
        return true;
      })
      .sort((left, right) => right.created_at.localeCompare(left.created_at));
  }
}
