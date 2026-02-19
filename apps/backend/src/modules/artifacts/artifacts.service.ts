import { Injectable } from '@nestjs/common';

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
  private readonly defaultTenantId = 'default';
  private readonly releaseStore = new Map<number, ArtifactReleaseRecord>();
  private readonly assignmentStore = new Map<string, ArtifactAssignmentRecord>();
  private releaseIdSeq = 0;
  private assignmentIdSeq = 0;

  private normalizeTenantId(tenantId: string | undefined): string {
    return String(tenantId || this.defaultTenantId).trim() || this.defaultTenantId;
  }

  private normalizeString(value: string | undefined, fallback = ''): string {
    return String(value || fallback).trim();
  }

  private assignmentKey(input: {
    tenantId: string;
    module: string;
    platform: string;
    channel: string;
    userId: string | null;
  }): string {
    return [
      this.normalizeTenantId(input.tenantId),
      this.normalizeString(input.module).toLowerCase(),
      this.normalizeString(input.platform).toLowerCase(),
      this.normalizeString(input.channel).toLowerCase(),
      this.normalizeString(input.userId || '__default__').toLowerCase(),
    ].join(':');
  }

  createRelease(input: ArtifactReleaseCreateInput): ArtifactReleaseRecord {
    this.releaseIdSeq += 1;
    const release: ArtifactReleaseRecord = {
      id: this.releaseIdSeq,
      tenant_id: this.normalizeTenantId(input.tenantId),
      module: this.normalizeString(input.payload.module),
      platform: this.normalizeString(input.payload.platform).toLowerCase(),
      channel: this.normalizeString(input.payload.channel, 'stable').toLowerCase(),
      version: this.normalizeString(input.payload.version),
      object_key: this.normalizeString(input.payload.object_key),
      sha256: this.normalizeString(input.payload.sha256).toLowerCase(),
      size_bytes: Number(input.payload.size_bytes),
      status: input.payload.status,
    };
    this.releaseStore.set(release.id, release);
    return release;
  }

  assignRelease(input: ArtifactAssignInput): ArtifactAssignmentRecord {
    const releaseId = Number(input.payload.release_id);
    const release = this.releaseStore.get(releaseId);
    if (!release || release.tenant_id !== this.normalizeTenantId(input.tenantId)) {
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
    const key = this.assignmentKey({
      tenantId: input.tenantId,
      module: normalizedModule,
      platform: normalizedPlatform,
      channel: normalizedChannel,
      userId,
    });
    const existing = this.assignmentStore.get(key);
    const record: ArtifactAssignmentRecord = {
      id: existing?.id || ++this.assignmentIdSeq,
      tenant_id: this.normalizeTenantId(input.tenantId),
      module: normalizedModule,
      platform: normalizedPlatform,
      channel: normalizedChannel,
      user_id: userId,
      release_id: releaseId,
      is_default: !userId,
    };
    this.assignmentStore.set(key, record);
    return record;
  }

  getEffectiveAssignment(input: ArtifactAssignmentLookupInput): ArtifactEffectiveAssignment {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const normalizedModule = this.normalizeString(input.module);
    const normalizedPlatform = this.normalizeString(input.platform, 'windows').toLowerCase();
    const normalizedChannel = this.normalizeString(input.channel, 'stable').toLowerCase();
    const normalizedUserId = this.normalizeString(input.userId) || null;

    const userAssignment = normalizedUserId
      ? this.assignmentStore.get(
          this.assignmentKey({
            tenantId: normalizedTenantId,
            module: normalizedModule,
            platform: normalizedPlatform,
            channel: normalizedChannel,
            userId: normalizedUserId,
          }),
        ) || null
      : null;

    const defaultAssignment =
      this.assignmentStore.get(
        this.assignmentKey({
          tenantId: normalizedTenantId,
          module: normalizedModule,
          platform: normalizedPlatform,
          channel: normalizedChannel,
          userId: null,
        }),
      ) || null;

    return {
      user_assignment: userAssignment,
      default_assignment: defaultAssignment,
      effective_assignment: userAssignment || defaultAssignment,
    };
  }

  resolveDownload(input: ArtifactResolveDownloadInput): {
    download_url: string;
    url_expires_at: number;
    release_id: number;
    version: string;
    sha256: string;
    size_bytes: number;
  } | null {
    const assignment = this.getEffectiveAssignment({
      tenantId: input.tenantId,
      userId: 'lease-user',
      module: input.module,
      platform: input.platform,
      channel: input.channel,
    }).effective_assignment;

    if (!assignment) {
      return null;
    }
    const release = this.releaseStore.get(assignment.release_id);
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
