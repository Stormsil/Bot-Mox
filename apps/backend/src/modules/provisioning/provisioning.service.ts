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

type UnattendProfileRecord = z.infer<typeof unattendProfileRecordSchema>;
type CreateUnattendProfilePayload = z.infer<typeof unattendProfileCreateSchema>;
type UpdateUnattendProfilePayload = z.infer<typeof unattendProfileUpdateSchema>;
type ValidateTokenPayload = z.infer<typeof provisioningValidateTokenSchema>;
type ValidateTokenResult = z.infer<typeof provisioningValidateTokenResponseSchema>;
type ReportProgressPayload = z.infer<typeof provisioningReportProgressSchema>;
type ReportProgressResult = z.infer<typeof provisioningReportProgressResponseSchema>;
type ProgressResult = z.infer<typeof provisioningProgressResponseSchema>;
type GenerateIsoPayload = z.infer<typeof provisioningGenerateIsoPayloadSchema>;
type GenerateIsoPayloadResult = z.infer<typeof provisioningGenerateIsoPayloadResponseSchema>;

interface IssueTokenInput {
  vmUuid: string;
}

interface IssueTokenResult {
  token: string;
  tokenId: string;
  expiresAt: string;
}

@Injectable()
export class ProvisioningService {
  private readonly defaultTenantId = 'default';
  private readonly defaultUserId = 'user-1';
  private readonly progressStore = new Map<string, ReportProgressResult[]>();
  private readonly profilesStore = new Map<string, UnattendProfileRecord>();
  private profileSequence = 0;
  private tokenSequence = 0;

  private isTokenAccepted(token: string): boolean {
    const normalized = String(token || '')
      .trim()
      .toLowerCase();
    if (!normalized) return false;
    return !normalized.startsWith('invalid');
  }

  private nextProfileId(): string {
    this.profileSequence += 1;
    return `profile-${this.profileSequence}`;
  }

  private nextTokenId(): string {
    this.tokenSequence += 1;
    return `token-${this.tokenSequence}`;
  }

  private clone<TValue>(value: TValue): TValue {
    return JSON.parse(JSON.stringify(value)) as TValue;
  }

  private setDefaultProfile(id: string): void {
    for (const [profileId, profile] of this.profilesStore.entries()) {
      if (profileId === id) {
        continue;
      }
      if (!profile.is_default) {
        continue;
      }
      this.profilesStore.set(profileId, {
        ...profile,
        is_default: false,
      });
    }
  }

  listProfiles(): UnattendProfileRecord[] {
    return [...this.profilesStore.values()].map((item) => this.clone(item));
  }

  createProfile(payload: CreateUnattendProfilePayload): UnattendProfileRecord {
    const id = this.nextProfileId();
    const now = new Date().toISOString();
    const isDefault = payload.is_default === true;

    if (isDefault) {
      this.setDefaultProfile(id);
    }

    const profile: UnattendProfileRecord = {
      id,
      name: payload.name,
      is_default: isDefault,
      config: payload.config,
      created_at: now,
      updated_at: now,
    };

    this.profilesStore.set(id, profile);
    return this.clone(profile);
  }

  updateProfile(id: string, payload: UpdateUnattendProfilePayload): UnattendProfileRecord | null {
    const normalizedId = String(id || '').trim();
    const current = this.profilesStore.get(normalizedId);
    if (!current) return null;

    const nextIsDefault = payload.is_default === true;
    if (nextIsDefault) {
      this.setDefaultProfile(normalizedId);
    }

    const updated: UnattendProfileRecord = {
      ...current,
      id: normalizedId,
      name: payload.name ?? current.name,
      config: payload.config ?? current.config,
      is_default: typeof payload.is_default === 'boolean' ? payload.is_default : current.is_default,
      updated_at: new Date().toISOString(),
    };

    this.profilesStore.set(normalizedId, updated);
    return this.clone(updated);
  }

  deleteProfile(id: string): boolean {
    return this.profilesStore.delete(String(id || '').trim());
  }

  getProfile(id: string): UnattendProfileRecord | null {
    const profile = this.profilesStore.get(String(id || '').trim());
    return profile ? this.clone(profile) : null;
  }

  issueToken(input: IssueTokenInput): IssueTokenResult {
    const tokenId = this.nextTokenId();
    const vmUuid = String(input.vmUuid || '').trim() || 'vm';

    return {
      token: `token-${vmUuid}-${tokenId}`,
      tokenId,
      expiresAt: new Date(Date.now() + 15 * 60_000).toISOString(),
    };
  }

  generateIsoPayload(payload: GenerateIsoPayload): GenerateIsoPayloadResult {
    const token = this.issueToken({
      vmUuid: payload.vm_uuid,
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

  validateToken(payload: ValidateTokenPayload): ValidateTokenResult | null {
    if (!this.isTokenAccepted(payload.token)) {
      return null;
    }

    return {
      valid: true,
      userId: this.defaultUserId,
      tenantId: this.defaultTenantId,
      bootstrap_url: null,
      app_url: null,
    };
  }

  reportProgress(payload: ReportProgressPayload): ReportProgressResult | null {
    if (!this.isTokenAccepted(payload.token)) {
      return null;
    }

    const normalizedVmUuid = payload.vm_uuid.trim();
    const updatedAt = new Date().toISOString();
    const entry: ReportProgressResult = {
      vm_uuid: normalizedVmUuid,
      step: payload.step,
      status: payload.status,
      details: payload.details,
      updated_at: updatedAt,
    };

    const existing = this.progressStore.get(normalizedVmUuid) ?? [];
    this.progressStore.set(normalizedVmUuid, [...existing, entry]);
    return entry;
  }

  getProgress(vmUuid: string): ProgressResult {
    const normalizedVmUuid = String(vmUuid || '').trim();
    const events = this.progressStore.get(normalizedVmUuid) ?? [];
    const updatedAt = events[events.length - 1]?.updated_at ?? new Date().toISOString();

    return {
      vm_uuid: normalizedVmUuid,
      events,
      updated_at: updatedAt,
    };
  }
}
