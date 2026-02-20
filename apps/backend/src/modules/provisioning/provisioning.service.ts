import { randomUUID } from 'node:crypto';
import type {
  provisioningGenerateIsoPayloadResponseSchema,
  provisioningGenerateIsoPayloadSchema,
  provisioningProgressResponseSchema,
  provisioningReportProgressResponseSchema,
  provisioningReportProgressSchema,
  provisioningValidateTokenResponseSchema,
  provisioningValidateTokenSchema,
  unattendProfileCreateSchema,
  unattendProfileRecordSchema,
  unattendProfileUpdateSchema,
} from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
import { ProvisioningRepository } from './provisioning.repository';

export type UnattendProfileRecord = z.infer<typeof unattendProfileRecordSchema>;
type CreateUnattendProfilePayload = z.infer<typeof unattendProfileCreateSchema>;
type UpdateUnattendProfilePayload = z.infer<typeof unattendProfileUpdateSchema>;
type ValidateTokenPayload = z.infer<typeof provisioningValidateTokenSchema>;
type ValidateTokenResult = z.infer<typeof provisioningValidateTokenResponseSchema>;
type ReportProgressPayload = z.infer<typeof provisioningReportProgressSchema>;
export type ReportProgressResult = z.infer<typeof provisioningReportProgressResponseSchema>;
type ProgressResult = z.infer<typeof provisioningProgressResponseSchema>;
type GenerateIsoPayload = z.infer<typeof provisioningGenerateIsoPayloadSchema>;
type GenerateIsoPayloadResult = z.infer<typeof provisioningGenerateIsoPayloadResponseSchema>;

interface IssueTokenInput {
  vmUuid: string;
  tenantId: string;
  userId: string;
}

interface IssueTokenResult {
  token: string;
  tokenId: string;
  expiresAt: string;
}

export interface ProvisioningTokenRecord {
  token: string;
  tokenId: string;
  tenantId: string;
  userId: string;
  vmUuid: string;
  expiresAtMs: number;
}

@Injectable()
export class ProvisioningService {
  private tokenSequence = 0;

  constructor(private readonly repository: ProvisioningRepository) {}

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  private normalizeUserId(userId: string): string {
    const normalized = String(userId || '').trim();
    if (!normalized) {
      throw new Error('userId is required');
    }
    return normalized;
  }

  private normalizeVmUuid(vmUuid: string): string {
    const normalized = String(vmUuid || '').trim();
    if (!normalized) {
      throw new Error('vmUuid is required');
    }
    return normalized;
  }

  private nextProfileId(): string {
    return `profile-${randomUUID()}`;
  }

  private nextTokenId(): string {
    this.tokenSequence += 1;
    return `token-${this.tokenSequence}`;
  }

  private clone<TValue>(value: TValue): TValue {
    return JSON.parse(JSON.stringify(value)) as TValue;
  }

  private async getTokenRecord(token: string): Promise<ProvisioningTokenRecord | null> {
    const normalized = String(token || '').trim();
    if (!normalized) return null;

    const record = await this.repository.findToken(normalized);
    if (!record || record.expiresAtMs <= Date.now()) {
      return null;
    }
    return record;
  }

  private async revokeToken(token: string): Promise<void> {
    const normalized = String(token || '').trim();
    if (!normalized) return;
    await this.repository.deleteToken(normalized);
  }

  private async unsetDefaultProfile(tenantId: string, exceptProfileId?: string): Promise<void> {
    const profiles = await this.repository.listProfiles(tenantId);
    for (const profile of profiles) {
      if (!profile.is_default) {
        continue;
      }
      if (exceptProfileId && profile.id === exceptProfileId) {
        continue;
      }
      await this.repository.upsertProfile({
        tenantId,
        id: profile.id,
        payload: {
          ...profile,
          is_default: false,
          updated_at: new Date().toISOString(),
        },
      });
    }
  }

  async listProfiles(tenantId: string): Promise<UnattendProfileRecord[]> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const items = await this.repository.listProfiles(normalizedTenantId);
    return items.map((item) => this.clone(item));
  }

  async createProfile(
    payload: CreateUnattendProfilePayload,
    tenantId: string,
  ): Promise<UnattendProfileRecord> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const id = this.nextProfileId();
    const now = new Date().toISOString();
    const isDefault = payload.is_default === true;

    if (isDefault) {
      await this.unsetDefaultProfile(normalizedTenantId);
    }

    const profile: UnattendProfileRecord = {
      id,
      name: payload.name,
      is_default: isDefault,
      config: payload.config,
      created_at: now,
      updated_at: now,
    };

    const persisted = await this.repository.upsertProfile({
      tenantId: normalizedTenantId,
      id,
      payload: profile,
    });
    return this.clone(persisted);
  }

  async updateProfile(
    id: string,
    payload: UpdateUnattendProfilePayload,
    tenantId: string,
  ): Promise<UnattendProfileRecord | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedId = String(id || '').trim();
    const current = await this.repository.findProfileById(normalizedTenantId, normalizedId);
    if (!current) return null;

    const nextIsDefault = payload.is_default === true;
    if (nextIsDefault) {
      await this.unsetDefaultProfile(normalizedTenantId, normalizedId);
    }

    const updated: UnattendProfileRecord = {
      ...current,
      id: normalizedId,
      name: payload.name ?? current.name,
      config: payload.config ?? current.config,
      is_default: typeof payload.is_default === 'boolean' ? payload.is_default : current.is_default,
      updated_at: new Date().toISOString(),
    };

    const persisted = await this.repository.upsertProfile({
      tenantId: normalizedTenantId,
      id: normalizedId,
      payload: updated,
    });
    return this.clone(persisted);
  }

  async deleteProfile(id: string, tenantId: string): Promise<boolean> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedId = String(id || '').trim();

    const existing = await this.repository.findProfileById(normalizedTenantId, normalizedId);
    if (!existing) {
      return false;
    }

    await this.repository.deleteProfile(normalizedTenantId, normalizedId);
    return true;
  }

  async getProfile(id: string, tenantId: string): Promise<UnattendProfileRecord | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedId = String(id || '').trim();
    const profile = await this.repository.findProfileById(normalizedTenantId, normalizedId);
    return profile ? this.clone(profile) : null;
  }

  async issueToken(input: IssueTokenInput): Promise<IssueTokenResult> {
    const tokenId = this.nextTokenId();
    const vmUuid = this.normalizeVmUuid(input.vmUuid);
    const tenantId = this.normalizeTenantId(input.tenantId);
    const userId = this.normalizeUserId(input.userId);
    const expiresAtMs = Date.now() + 15 * 60_000;
    const token = `token-${vmUuid}-${tokenId}`;

    const record: ProvisioningTokenRecord = {
      token,
      tokenId,
      tenantId,
      userId,
      vmUuid,
      expiresAtMs,
    };

    await this.repository.upsertToken(record);

    return {
      token,
      tokenId,
      expiresAt: new Date(expiresAtMs).toISOString(),
    };
  }

  async generateIsoPayload(
    payload: GenerateIsoPayload,
    identity: { tenantId: string; userId: string },
  ): Promise<GenerateIsoPayloadResult> {
    const token = await this.issueToken({
      vmUuid: payload.vm_uuid,
      tenantId: identity.tenantId,
      userId: identity.userId,
    });

    const computerName = String(payload.vm_name || `vm-${payload.vm_uuid}`)
      .trim()
      .slice(0, 15);
    const username =
      payload.profile_config?.user?.customName?.trim() ||
      payload.profile_config?.user?.displayName?.trim() ||
      'Administrator';

    const autounattend = `<unattend vm="${payload.vm_uuid}" computer="${computerName}" />`;
    const provisionJson = JSON.stringify(
      {
        vm_uuid: payload.vm_uuid,
        token: token.token,
        ip: payload.ip,
      },
      null,
      2,
    );
    const startPs1 = `Write-Host "Provisioning ${payload.vm_uuid}"`;

    return {
      files: {
        'autounattend.xml': Buffer.from(autounattend, 'utf-8').toString('base64'),
        'provision.json': Buffer.from(provisionJson, 'utf-8').toString('base64'),
        'START.ps1': Buffer.from(startPs1, 'utf-8').toString('base64'),
      },
      token: token.token,
      tokenId: token.tokenId,
      expiresAt: token.expiresAt,
      computerName: computerName || 'vm-default',
      username,
      vmUuid: payload.vm_uuid,
      playbookId: payload.playbook_id ?? null,
    };
  }

  async validateToken(payload: ValidateTokenPayload): Promise<ValidateTokenResult | null> {
    const tokenRecord = await this.getTokenRecord(payload.token);
    if (!tokenRecord) {
      return null;
    }

    return {
      valid: true,
      userId: tokenRecord.userId,
      tenantId: tokenRecord.tenantId,
      bootstrap_url: null,
      app_url: null,
    };
  }

  async reportProgress(payload: ReportProgressPayload): Promise<ReportProgressResult | null> {
    const tokenRecord = await this.getTokenRecord(payload.token);
    if (!tokenRecord) {
      return null;
    }

    const normalizedVmUuid = payload.vm_uuid.trim();
    if (normalizedVmUuid !== tokenRecord.vmUuid) {
      return null;
    }

    const entry: ReportProgressResult = {
      vm_uuid: normalizedVmUuid,
      step: payload.step,
      status: payload.status,
      details: payload.details,
      updated_at: new Date().toISOString(),
    };

    await this.repository.appendProgress({
      tenantId: tokenRecord.tenantId,
      id: randomUUID(),
      vmUuid: normalizedVmUuid,
      payload: entry,
    });

    if (payload.status === 'completed' || payload.status === 'failed') {
      await this.revokeToken(payload.token);
    }
    return entry;
  }

  async getProgress(vmUuid: string, tenantId: string): Promise<ProgressResult> {
    const normalizedVmUuid = String(vmUuid || '').trim();
    const normalizedTenantId = this.normalizeTenantId(tenantId);

    const events = await this.repository.listProgressByVm(normalizedTenantId, normalizedVmUuid);
    const updatedAt = events[events.length - 1]?.updated_at ?? new Date().toISOString();

    return {
      vm_uuid: normalizedVmUuid,
      events,
      updated_at: updatedAt,
    };
  }
}
