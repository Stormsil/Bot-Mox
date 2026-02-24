import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AdminProjectsRepository } from './admin-projects.repository';

@Injectable()
export class AdminProjectsService {
  constructor(private readonly repository: AdminProjectsRepository) {}

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new BadRequestException({
        code: 'TENANT_ID_REQUIRED',
        message: 'tenant_id is required',
      });
    }
    return normalized;
  }

  private resolveTargetTenantIds(input: {
    scope: 'tenant' | 'wave' | 'all';
    tenantId?: string;
    tenantIds?: string[];
    batchSize?: number;
  }): Promise<string[]> | string[] {
    if (input.scope === 'tenant') {
      return [this.normalizeTenantId(String(input.tenantId || ''))];
    }
    if (Array.isArray(input.tenantIds) && input.tenantIds.length > 0) {
      return Array.from(
        new Set(input.tenantIds.map((tenantId) => this.normalizeTenantId(tenantId))),
      );
    }
    return (async () => {
      const known = await this.repository.listKnownTenants();
      const batchSize = Number.isFinite(input.batchSize)
        ? Math.max(1, Math.min(10_000, Math.trunc(input.batchSize || 100)))
        : 100;
      return Array.from(new Set(known.slice(0, batchSize)));
    })();
  }

  async createRelease(input: {
    projectKey: string;
    version: string;
    status?: string;
    artifacts?: unknown;
    metadata?: unknown;
    createdBy: string;
  }): Promise<Record<string, unknown>> {
    const release = await this.repository.createRelease({
      projectKey: String(input.projectKey || '').trim(),
      version: String(input.version || '').trim(),
      status: String(input.status || 'active').trim() || 'active',
      artifacts: (input.artifacts ?? []) as Prisma.InputJsonValue,
      metadata: (input.metadata ?? {}) as Prisma.InputJsonValue,
      createdBy: String(input.createdBy || '').trim() || 'unknown-user',
    });

    return {
      id: release.id,
      project_key: release.projectKey,
      version: release.version,
      status: release.status,
      created_at: release.createdAt.toISOString(),
      updated_at: release.updatedAt.toISOString(),
    };
  }

  async listReleases(input: {
    projectKey?: string;
    status?: string;
    page?: number;
    limit?: number;
    sort?: 'updated_at' | 'created_at' | 'version' | 'project_key' | 'status';
    order?: 'asc' | 'desc';
  }): Promise<Record<string, unknown>> {
    const page = Number.isFinite(input.page) ? Math.max(1, Math.trunc(input.page || 1)) : 1;
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(1_000, Math.trunc(input.limit || 100)))
      : 100;
    const sort = input.sort || 'updated_at';
    const order = input.order || 'desc';

    const rows = await this.repository.listReleases({
      ...(String(input.projectKey || '').trim()
        ? { projectKey: String(input.projectKey || '').trim() }
        : {}),
      ...(String(input.status || '').trim() ? { status: String(input.status || '').trim() } : {}),
      page,
      limit,
      sort,
      order,
    });

    return {
      items: rows.items.map((release) => ({
        id: release.id,
        project_key: release.projectKey,
        version: release.version,
        status: release.status,
        created_at: release.createdAt.toISOString(),
        updated_at: release.updatedAt.toISOString(),
      })),
      total: rows.total,
      page,
      limit,
      sort,
      order,
    };
  }

  async rollout(input: {
    projectKey: string;
    releaseId: string;
    scope: 'tenant' | 'wave' | 'all';
    tenantId?: string;
    wave?: string;
    batchSize?: number;
    tenantIds?: string[];
    notes?: string;
    updatedBy: string;
  }): Promise<Record<string, unknown>> {
    const release = await this.repository.getReleaseById(input.releaseId);
    if (!release) {
      throw new NotFoundException({
        code: 'RELEASE_NOT_FOUND',
        message: 'Release not found',
      });
    }

    const projectKey = String(input.projectKey || '').trim();
    if (!projectKey || release.projectKey !== projectKey) {
      throw new BadRequestException({
        code: 'ROLLOUT_PROJECT_MISMATCH',
        message: 'release_id does not belong to project_key',
      });
    }

    const normalizedScope = input.scope;
    if (normalizedScope === 'wave' && !String(input.wave || '').trim()) {
      throw new BadRequestException({
        code: 'ROLLOUT_WAVE_REQUIRED',
        message: 'wave is required when scope=wave',
      });
    }

    const resolvedTargetTenantIds = await this.resolveTargetTenantIds({
      scope: input.scope,
      ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
      ...(input.tenantIds !== undefined ? { tenantIds: input.tenantIds } : {}),
      ...(input.batchSize !== undefined ? { batchSize: input.batchSize } : {}),
    });
    const targetTenantIds = Array.isArray(resolvedTargetTenantIds) ? resolvedTargetTenantIds : [];

    const wave = String(input.wave || '').trim() || null;
    const notes = String(input.notes || '').trim() || null;

    const results = [] as Array<{ tenant_id: string; rollout_id: string; status: string }>;
    for (const tenantId of targetTenantIds) {
      const rollout = await this.repository.upsertRollout({
        tenantId,
        projectKey,
        releaseId: release.id,
        status: 'rolled_out',
        wave,
        notes,
        updatedBy: String(input.updatedBy || '').trim() || 'unknown-user',
      });
      results.push({
        tenant_id: rollout.tenantId,
        rollout_id: rollout.id,
        status: rollout.status,
      });
    }

    return {
      project_key: projectKey,
      release_id: release.id,
      scope: input.scope,
      wave,
      count: results.length,
      tenants: results,
    };
  }

  async rollback(input: {
    projectKey: string;
    scope: 'tenant' | 'wave' | 'all';
    tenantId?: string;
    wave?: string;
    batchSize?: number;
    tenantIds?: string[];
    notes?: string;
    updatedBy: string;
  }): Promise<Record<string, unknown>> {
    const projectKey = String(input.projectKey || '').trim();
    if (!projectKey) {
      throw new BadRequestException({
        code: 'PROJECT_KEY_REQUIRED',
        message: 'project_key is required',
      });
    }

    if (input.scope === 'wave' && !String(input.wave || '').trim()) {
      throw new BadRequestException({
        code: 'ROLLBACK_WAVE_REQUIRED',
        message: 'wave is required when scope=wave',
      });
    }

    const resolvedTargetTenantIds = await this.resolveTargetTenantIds({
      scope: input.scope,
      ...(input.tenantId !== undefined ? { tenantId: input.tenantId } : {}),
      ...(input.tenantIds !== undefined ? { tenantIds: input.tenantIds } : {}),
      ...(input.batchSize !== undefined ? { batchSize: input.batchSize } : {}),
    });
    const targetTenantIds = Array.isArray(resolvedTargetTenantIds) ? resolvedTargetTenantIds : [];

    const wave = String(input.wave || '').trim() || null;
    const notes = String(input.notes || '').trim() || null;
    const updatedBy = String(input.updatedBy || '').trim() || 'unknown-user';

    const results = [] as Array<{
      tenant_id: string;
      status: 'rolled_back' | 'skipped';
      reason?: string;
      from_release_id?: string;
      to_release_id?: string;
      rollout_id?: string;
    }>;

    for (const tenantId of targetTenantIds) {
      const current = await this.repository.getRolloutByTenantProject({
        tenantId,
        projectKey,
      });
      if (!current) {
        results.push({
          tenant_id: tenantId,
          status: 'skipped',
          reason: 'no_rollout',
        });
        continue;
      }

      const previousRelease = await this.repository.getPreviousRelease({
        projectKey,
        currentReleaseId: current.releaseId,
        currentReleaseCreatedAt: current.release.createdAt,
      });
      if (!previousRelease) {
        results.push({
          tenant_id: tenantId,
          status: 'skipped',
          reason: 'no_previous_release',
          from_release_id: current.releaseId,
        });
        continue;
      }

      const rollout = await this.repository.upsertRollout({
        tenantId,
        projectKey,
        releaseId: previousRelease.id,
        status: 'rolled_back',
        wave,
        notes,
        updatedBy,
      });
      results.push({
        tenant_id: tenantId,
        status: 'rolled_back',
        from_release_id: current.releaseId,
        to_release_id: previousRelease.id,
        rollout_id: rollout.id,
      });
    }

    return {
      project_key: projectKey,
      scope: input.scope,
      wave,
      count: results.length,
      rolled_back: results.filter((row) => row.status === 'rolled_back').length,
      skipped: results.filter((row) => row.status === 'skipped').length,
      tenants: results,
    };
  }

  async rolloutStaged(input: {
    projectKey: string;
    releaseId: string;
    testTenantId: string;
    tenantIds?: string[];
    batchSize?: number;
    wave?: string;
    notes?: string;
    updatedBy: string;
  }): Promise<Record<string, unknown>> {
    const testTenantId = this.normalizeTenantId(input.testTenantId);
    const normalizedWave =
      String(input.wave || '').trim() || `staged-${new Date().toISOString().slice(0, 10)}`;
    const normalizedNotes = String(input.notes || '').trim();
    const resolvedWaveTargets = await this.resolveTargetTenantIds({
      scope: Array.isArray(input.tenantIds) && input.tenantIds.length > 0 ? 'wave' : 'all',
      ...(Array.isArray(input.tenantIds) && input.tenantIds.length > 0
        ? { tenantIds: input.tenantIds }
        : {}),
      ...(input.batchSize !== undefined ? { batchSize: input.batchSize } : {}),
    });
    const waveTenantIds = (Array.isArray(resolvedWaveTargets) ? resolvedWaveTargets : []).filter(
      (tenantId) => tenantId !== testTenantId,
    );

    const canary = await this.rollout({
      projectKey: input.projectKey,
      releaseId: input.releaseId,
      scope: 'tenant',
      tenantId: testTenantId,
      ...(normalizedNotes ? { notes: `${normalizedNotes} [staged:canary]` } : {}),
      updatedBy: input.updatedBy,
    });

    const wave =
      waveTenantIds.length > 0
        ? await this.rollout({
            projectKey: input.projectKey,
            releaseId: input.releaseId,
            scope: 'wave',
            tenantIds: waveTenantIds,
            wave: normalizedWave,
            ...(normalizedNotes ? { notes: `${normalizedNotes} [staged:wave]` } : {}),
            updatedBy: input.updatedBy,
          })
        : {
            project_key: String(input.projectKey || '').trim(),
            release_id: String(input.releaseId || '').trim(),
            scope: 'wave',
            wave: normalizedWave,
            count: 0,
            tenants: [],
          };

    return {
      project_key: String(input.projectKey || '').trim(),
      release_id: String(input.releaseId || '').trim(),
      staged: true,
      canary_tenant_id: testTenantId,
      wave: normalizedWave,
      wave_target_count: waveTenantIds.length,
      phases: {
        canary,
        wave,
      },
      total_updated:
        Number(
          ((canary as { count?: number })?.count || 0) + ((wave as { count?: number })?.count || 0),
        ) || 0,
    };
  }

  async listRolloutStatus(input: {
    projectKey?: string;
    tenantId?: string;
    status?: string;
    page?: number;
    limit?: number;
    sort?: 'updated_at' | 'rolled_out_at' | 'tenant_id' | 'project_key' | 'status' | 'wave';
    order?: 'asc' | 'desc';
  }): Promise<Record<string, unknown>> {
    const page = Number.isFinite(input.page) ? Math.max(1, Math.trunc(input.page || 1)) : 1;
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(1_000, Math.trunc(input.limit || 100)))
      : 100;
    const sort = input.sort || 'updated_at';
    const order = input.order || 'desc';

    const rows = await this.repository.listRolloutStatus({
      ...(String(input.projectKey || '').trim()
        ? { projectKey: String(input.projectKey || '').trim() }
        : {}),
      ...(input.tenantId ? { tenantId: this.normalizeTenantId(input.tenantId) } : {}),
      ...(String(input.status || '').trim() ? { status: String(input.status || '').trim() } : {}),
      page,
      limit,
      sort,
      order,
    });

    return {
      items: rows.items.map((row) => ({
        id: row.id,
        tenant_id: row.tenantId,
        project_key: row.projectKey,
        release_id: row.releaseId,
        status: row.status,
        wave: row.wave,
        notes: row.notes,
        rolled_out_at: row.rolledOutAt.toISOString(),
        updated_at: row.updatedAt.toISOString(),
        release: {
          project_key: row.release.projectKey,
          version: row.release.version,
          status: row.release.status,
        },
      })),
      total: rows.total,
      page,
      limit,
      sort,
      order,
    };
  }
}
