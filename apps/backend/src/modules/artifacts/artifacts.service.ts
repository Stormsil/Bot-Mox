import { Injectable } from '@nestjs/common';
import type { LicenseRepository } from '../license/license.repository';
import { ArtifactsRepository } from './artifacts.repository';

export interface ArtifactReleaseCreateInput {
  tenantId: string;
  payload: {
    module: string;
    platform: string;
    channel: string;
    version: string;
    object_key: string;
    sha256: string;
    size_bytes: number;
    status: 'draft' | 'active' | 'disabled' | 'archived';
  };
}

export interface ArtifactAssignInput {
  tenantId: string;
  payload: {
    user_id?: string | undefined;
    module: string;
    platform: string;
    channel: string;
    release_id: number;
  };
}

export interface ArtifactAssignmentLookupInput {
  tenantId: string;
  userId: string;
  module: string;
  platform: string;
  channel: string;
}

export interface ArtifactResolveDownloadInput {
  tenantId: string;
  leaseToken: string;
  vmUuid: string;
  module: string;
  platform: string;
  channel: string;
}

export interface ArtifactReleaseRecord {
  id: number;
  tenant_id: string;
  module: string;
  platform: string;
  channel: string;
  version: string;
  object_key: string;
  sha256: string;
  size_bytes: number;
  status: 'draft' | 'active' | 'disabled' | 'archived';
}

export interface ArtifactAssignmentRecord {
  id: number;
  tenant_id: string;
  module: string;
  platform: string;
  channel: string;
  user_id: string | null;
  release_id: number;
  is_default: boolean;
}

export interface ArtifactEffectiveAssignment {
  user_assignment: ArtifactAssignmentRecord | null;
  default_assignment: ArtifactAssignmentRecord | null;
  effective_assignment: ArtifactAssignmentRecord | null;
}

export class ArtifactsServiceError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ArtifactsServiceError';
  }
}

@Injectable()
export class ArtifactsService {
  constructor(
    private readonly repository: ArtifactsRepository,
    private readonly licenseRepository: Pick<LicenseRepository, 'findActiveByToken'>,
  ) {}

  private normalizeTenantId(tenantId: string | undefined): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  private normalizeString(value: string | undefined, fallback = ''): string {
    return String(value || fallback).trim();
  }

  private buildRelease(input: {
    tenantId: string;
    id: number;
    payload: ArtifactReleaseCreateInput['payload'];
  }) {
    return {
      id: input.id,
      tenant_id: this.normalizeTenantId(input.tenantId),
      module: this.normalizeString(input.payload.module),
      platform: this.normalizeString(input.payload.platform).toLowerCase(),
      channel: this.normalizeString(input.payload.channel, 'stable').toLowerCase(),
      version: this.normalizeString(input.payload.version),
      object_key: this.normalizeString(input.payload.object_key),
      sha256: this.normalizeString(input.payload.sha256).toLowerCase(),
      size_bytes: Number(input.payload.size_bytes),
      status: input.payload.status,
    } satisfies ArtifactReleaseRecord;
  }

  async createRelease(input: ArtifactReleaseCreateInput): Promise<ArtifactReleaseRecord> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const nextId = await this.repository.getNextReleaseId(normalizedTenantId);
    const release = this.buildRelease({
      tenantId: normalizedTenantId,
      id: nextId,
      payload: input.payload,
    });
    return this.repository.upsertRelease({
      tenantId: normalizedTenantId,
      id: nextId,
      payload: release,
    });
  }

  async assignRelease(input: ArtifactAssignInput): Promise<ArtifactAssignmentRecord> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const release = await this.repository.findReleaseById(
      normalizedTenantId,
      Number(input.payload.release_id),
    );
    if (!release || release.tenant_id !== normalizedTenantId) {
      throw new ArtifactsServiceError(404, 'Artifact release not found');
    }

    const normalizedModule = this.normalizeString(input.payload.module);
    const normalizedPlatform = this.normalizeString(input.payload.platform).toLowerCase();
    const normalizedChannel = this.normalizeString(input.payload.channel, 'stable').toLowerCase();
    if (
      release.module.toLowerCase() !== normalizedModule.toLowerCase() ||
      release.platform.toLowerCase() !== normalizedPlatform ||
      release.channel.toLowerCase() !== normalizedChannel
    ) {
      throw new ArtifactsServiceError(409, 'Release scope does not match assignment scope');
    }

    const userId = this.normalizeString(input.payload.user_id || '') || null;
    const userKey = this.normalizeString(userId || '__default__').toLowerCase();
    const existing = await this.repository.findAssignmentByScope({
      tenantId: normalizedTenantId,
      module: normalizedModule,
      platform: normalizedPlatform,
      channel: normalizedChannel,
      userKey,
    });
    const id = existing?.id ?? (await this.repository.getNextAssignmentId(normalizedTenantId));
    const record: ArtifactAssignmentRecord = {
      id,
      tenant_id: normalizedTenantId,
      module: normalizedModule,
      platform: normalizedPlatform,
      channel: normalizedChannel,
      user_id: userId,
      release_id: Number(input.payload.release_id),
      is_default: !userId,
    };
    return this.repository.upsertAssignmentByScope({
      tenantId: normalizedTenantId,
      id,
      module: normalizedModule,
      platform: normalizedPlatform,
      channel: normalizedChannel,
      userKey,
      payload: record,
    });
  }

  async getEffectiveAssignment(
    input: ArtifactAssignmentLookupInput,
  ): Promise<ArtifactEffectiveAssignment> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const normalizedModule = this.normalizeString(input.module);
    const normalizedPlatform = this.normalizeString(input.platform, 'windows').toLowerCase();
    const normalizedChannel = this.normalizeString(input.channel, 'stable').toLowerCase();
    const normalizedUserKey = this.normalizeString(input.userId || '').toLowerCase();

    const [userAssignment, defaultAssignment] = await Promise.all([
      this.repository.findAssignmentByScope({
        tenantId: normalizedTenantId,
        module: normalizedModule,
        platform: normalizedPlatform,
        channel: normalizedChannel,
        userKey: normalizedUserKey,
      }),
      this.repository.findAssignmentByScope({
        tenantId: normalizedTenantId,
        module: normalizedModule,
        platform: normalizedPlatform,
        channel: normalizedChannel,
        userKey: '__default__',
      }),
    ]);

    return {
      user_assignment: userAssignment,
      default_assignment: defaultAssignment,
      effective_assignment: userAssignment || defaultAssignment,
    };
  }

  async resolveDownload(input: ArtifactResolveDownloadInput): Promise<{
    download_url: string;
    url_expires_at: number;
    release_id: number;
    version: string;
    sha256: string;
    size_bytes: number;
  } | null> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const normalizedModule = this.normalizeString(input.module);
    const normalizedPlatform = this.normalizeString(input.platform, 'windows').toLowerCase();
    const normalizedChannel = this.normalizeString(input.channel, 'stable').toLowerCase();

    const lease = await this.licenseRepository.findActiveByToken({
      tenantId: normalizedTenantId,
      token: this.normalizeString(input.leaseToken),
      vmUuid: this.normalizeString(input.vmUuid),
      module: normalizedModule,
    });
    if (!lease) {
      return null;
    }

    const assignment =
      (
        await this.getEffectiveAssignment({
          tenantId: normalizedTenantId,
          userId: 'lease-user',
          module: normalizedModule,
          platform: normalizedPlatform,
          channel: normalizedChannel,
        })
      ).effective_assignment ?? null;

    if (!assignment) {
      return null;
    }

    const release = await this.repository.findReleaseById(
      normalizedTenantId,
      assignment.release_id,
    );

    if (!release || release.status !== 'active') {
      return null;
    }

    const expiresAt = Date.now() + 5 * 60 * 1000;
    return {
      download_url: `https://artifacts.local/download/${encodeURIComponent(release.object_key)}?vm=${encodeURIComponent(input.vmUuid)}&lease=${encodeURIComponent(input.leaseToken)}`,
      url_expires_at: expiresAt,
      release_id: release.id,
      version: release.version,
      sha256: release.sha256,
      size_bytes: release.size_bytes,
    };
  }
}
