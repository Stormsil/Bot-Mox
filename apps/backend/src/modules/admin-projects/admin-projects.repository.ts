import { Injectable } from '@nestjs/common';
import type { Prisma, ProjectCatalogRelease, TenantProjectRollout } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class AdminProjectsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async createRelease(input: {
    projectKey: string;
    version: string;
    status: string;
    artifacts: Prisma.InputJsonValue;
    metadata: Prisma.InputJsonValue;
    createdBy: string;
  }): Promise<ProjectCatalogRelease> {
    return this.prisma.projectCatalogRelease.create({
      data: {
        projectKey: input.projectKey,
        version: input.version,
        status: input.status,
        artifacts: input.artifacts,
        metadata: input.metadata,
        createdBy: input.createdBy,
      },
    });
  }

  async getReleaseById(releaseId: string): Promise<ProjectCatalogRelease | null> {
    return this.prisma.projectCatalogRelease.findUnique({
      where: { id: releaseId },
    });
  }

  async listReleases(input: {
    projectKey?: string;
    status?: string;
    page: number;
    limit: number;
    sort: 'updated_at' | 'created_at' | 'version' | 'project_key' | 'status';
    order: 'asc' | 'desc';
  }): Promise<{ items: ProjectCatalogRelease[]; total: number }> {
    const where = {
      ...(input.projectKey ? { projectKey: input.projectKey } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.projectCatalogRelease.findMany({
        where,
        orderBy:
          input.sort === 'created_at'
            ? { createdAt: input.order }
            : input.sort === 'version'
              ? { version: input.order }
              : input.sort === 'project_key'
                ? { projectKey: input.order }
                : input.sort === 'status'
                  ? { status: input.order }
                  : { updatedAt: input.order },
        skip: (input.page - 1) * input.limit,
        take: input.limit,
      }),
      this.prisma.projectCatalogRelease.count({ where }),
    ]);
    return {
      items,
      total,
    };
  }

  async upsertRollout(input: {
    tenantId: string;
    projectKey: string;
    releaseId: string;
    status: string;
    wave: string | null;
    notes: string | null;
    updatedBy: string;
  }): Promise<TenantProjectRollout> {
    return this.prisma.withSystemContext(async () => {
      return this.prisma.tenantProjectRollout.upsert({
        where: {
          tenantId_projectKey: {
            tenantId: input.tenantId,
            projectKey: input.projectKey,
          },
        },
        update: {
          releaseId: input.releaseId,
          status: input.status,
          wave: input.wave,
          notes: input.notes,
          rolledOutAt: new Date(),
          updatedBy: input.updatedBy,
        },
        create: {
          tenantId: input.tenantId,
          projectKey: input.projectKey,
          releaseId: input.releaseId,
          status: input.status,
          wave: input.wave,
          notes: input.notes,
          rolledOutAt: new Date(),
          updatedBy: input.updatedBy,
        },
      });
    });
  }

  async getRolloutByTenantProject(input: {
    tenantId: string;
    projectKey: string;
  }): Promise<(TenantProjectRollout & { release: ProjectCatalogRelease }) | null> {
    return this.prisma.withSystemContext(async () => {
      return this.prisma.tenantProjectRollout.findUnique({
        where: {
          tenantId_projectKey: {
            tenantId: input.tenantId,
            projectKey: input.projectKey,
          },
        },
        include: {
          release: true,
        },
      });
    });
  }

  async getPreviousRelease(input: {
    projectKey: string;
    currentReleaseId: string;
    currentReleaseCreatedAt: Date;
  }): Promise<ProjectCatalogRelease | null> {
    return this.prisma.projectCatalogRelease.findFirst({
      where: {
        projectKey: input.projectKey,
        id: {
          not: input.currentReleaseId,
        },
        createdAt: {
          lt: input.currentReleaseCreatedAt,
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }

  async listKnownTenants(): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<Array<{ tenant_id: string }>>`
      SELECT tenant_id FROM public.agents
      UNION
      SELECT tenant_id FROM public.settings_items
      UNION
      SELECT tenant_id FROM public.bot_entities
      UNION
      SELECT tenant_id FROM public.resource_items
      ORDER BY tenant_id ASC
    `;
    return rows
      .map((row) =>
        String(row.tenant_id || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
  }

  async listRolloutStatus(input: {
    projectKey?: string;
    tenantId?: string;
    status?: string;
    page: number;
    limit: number;
    sort: 'updated_at' | 'rolled_out_at' | 'tenant_id' | 'project_key' | 'status' | 'wave';
    order: 'asc' | 'desc';
  }): Promise<{
    items: Array<TenantProjectRollout & { release: ProjectCatalogRelease }>;
    total: number;
  }> {
    const where = {
      ...(input.projectKey ? { projectKey: input.projectKey } : {}),
      ...(input.tenantId ? { tenantId: input.tenantId } : {}),
      ...(input.status ? { status: input.status } : {}),
    };
    const [items, total] = await this.prisma.withSystemContext(async () => {
      return this.prisma.$transaction([
        this.prisma.tenantProjectRollout.findMany({
          where,
          include: {
            release: true,
          },
          orderBy:
            input.sort === 'rolled_out_at'
              ? { rolledOutAt: input.order }
              : input.sort === 'tenant_id'
                ? { tenantId: input.order }
                : input.sort === 'project_key'
                  ? { projectKey: input.order }
                  : input.sort === 'status'
                    ? { status: input.order }
                    : input.sort === 'wave'
                      ? { wave: input.order }
                      : { updatedAt: input.order },
          skip: (input.page - 1) * input.limit,
          take: input.limit,
        }),
        this.prisma.tenantProjectRollout.count({ where }),
      ]);
    });
    return {
      items,
      total,
    };
  }
}
