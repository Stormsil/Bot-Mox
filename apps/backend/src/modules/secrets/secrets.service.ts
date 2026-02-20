import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { SecretsRepository } from './secrets.repository';
import { SecretsVaultAdapter } from './secrets-vault.adapter';

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
  vault_ref: string | null;
  material_version: number;
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
  constructor(
    private readonly repository: SecretsRepository,
    private readonly vaultAdapter: SecretsVaultAdapter,
  ) {}

  private ensureVaultReferencePolicy(vaultRef: string): void {
    const normalized = String(vaultRef || '').trim();
    if (!normalized) {
      throw new Error('vault_ref is required for secret material');
    }
    if (normalized.startsWith('local-vault://')) {
      throw new Error(
        'Local vault fallback is forbidden; configure Supabase Vault RPC and use vault_ref from adapter',
      );
    }
  }

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  private normalizeAadMeta(aadMeta: unknown): Record<string, unknown> {
    return aadMeta && typeof aadMeta === 'object' ? (aadMeta as Record<string, unknown>) : {};
  }

  private mapDbSecretMeta(row: Record<string, unknown>): SecretMetaRecord {
    return {
      id: String(row.id || '').trim(),
      tenant_id: this.normalizeTenantId(String(row.tenantId || '')),
      label: String(row.label || ''),
      alg: String(row.alg || ''),
      key_id: String(row.keyId || ''),
      vault_ref: row.vaultRef ? String(row.vaultRef) : null,
      material_version: Math.max(1, Number.parseInt(String(row.materialVersion || '1'), 10) || 1),
      aad_meta: this.normalizeAadMeta(row.aadMeta),
      rotated_at: row.rotatedAt instanceof Date ? row.rotatedAt.toISOString() : null,
      created_at:
        row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date().toISOString(),
      updated_at:
        row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  private mapDbBinding(row: Record<string, unknown>): SecretBindingRecord {
    return {
      id: String(row.id || '').trim(),
      tenant_id: this.normalizeTenantId(String(row.tenantId || '')),
      scope_type: String(row.scopeType || 'tenant').trim() as SecretBindingRecord['scope_type'],
      scope_id: String(row.scopeId || '').trim(),
      secret_ref: String(row.secretRef || '').trim(),
      field_name: String(row.fieldName || '').trim(),
      created_at:
        row.createdAt instanceof Date ? row.createdAt.toISOString() : new Date().toISOString(),
      updated_at:
        row.updatedAt instanceof Date ? row.updatedAt.toISOString() : new Date().toISOString(),
    };
  }

  async createSecret(input: SecretCreateInput): Promise<SecretMetaRecord> {
    const normalizedTenant = this.normalizeTenantId(input.tenantId);
    const secretId = `sec-${randomUUID()}`;
    const material = await this.vaultAdapter.storeMaterial({
      tenantId: normalizedTenant,
      secretId,
      ciphertext: input.ciphertext,
      nonce: input.nonce,
      keyId: input.keyId,
      alg: input.alg,
    });
    this.ensureVaultReferencePolicy(material.vaultRef);

    const row = await this.repository.upsertSecretMeta({
      tenantId: normalizedTenant,
      id: secretId,
      label: String(input.label || '').trim(),
      alg: String(input.alg || '').trim(),
      keyId: String(input.keyId || '').trim(),
      vaultRef: material.vaultRef,
      materialVersion: material.materialVersion,
      aadMeta: this.normalizeAadMeta(input.aadMeta) as Prisma.InputJsonValue,
    });

    return this.mapDbSecretMeta(row);
  }

  async getSecretMeta(tenantId: string, id: string): Promise<SecretMetaRecord | null> {
    const secretId = String(id || '').trim();
    const normalizedTenantId = this.normalizeTenantId(tenantId);

    const row = await this.repository.findSecretMeta(normalizedTenantId, secretId);
    return row ? this.mapDbSecretMeta(row) : null;
  }

  async rotateSecret(input: SecretRotateInput): Promise<SecretMetaRecord | null> {
    const secretId = String(input.id || '').trim();
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);

    const existing = await this.getSecretMeta(normalizedTenantId, secretId);
    if (!existing) {
      return null;
    }

    const rotatedAlg = input.alg ? String(input.alg).trim() : existing.alg;

    const material = await this.vaultAdapter.rotateMaterial({
      tenantId: normalizedTenantId,
      secretId,
      ciphertext: input.ciphertext,
      nonce: input.nonce,
      keyId: input.keyId,
      alg: rotatedAlg,
    });
    this.ensureVaultReferencePolicy(material.vaultRef);

    const row = await this.repository.upsertSecretMeta({
      tenantId: normalizedTenantId,
      id: secretId,
      label: existing.label,
      alg: rotatedAlg,
      keyId: String(input.keyId || '').trim(),
      vaultRef: material.vaultRef,
      materialVersion: material.materialVersion,
      aadMeta: (input.aadMeta !== undefined
        ? this.normalizeAadMeta(input.aadMeta)
        : existing.aad_meta) as Prisma.InputJsonValue,
      rotatedAt: new Date(),
    });

    return this.mapDbSecretMeta(row);
  }

  async createBinding(input: SecretBindingCreateInput): Promise<SecretBindingRecord> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const row = await this.repository.upsertBinding({
      tenantId: normalizedTenantId,
      id: `bind-${randomUUID()}`,
      scopeType: input.scopeType,
      scopeId: String(input.scopeId || '').trim(),
      secretRef: String(input.secretRef || '').trim(),
      fieldName: String(input.fieldName || '').trim(),
    });

    return this.mapDbBinding(row);
  }

  async listBindings(input: SecretBindingListInput): Promise<SecretBindingRecord[]> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const normalizedScopeType = input.scopeType ? String(input.scopeType).trim() : '';
    const normalizedScopeId = input.scopeId ? String(input.scopeId).trim() : '';

    const rows = await this.repository.listBindings({
      tenantId: normalizedTenantId,
      ...(normalizedScopeType ? { scopeType: normalizedScopeType } : {}),
      ...(normalizedScopeId ? { scopeId: normalizedScopeId } : {}),
    });

    return rows.map((row) => this.mapDbBinding(row));
  }
}
