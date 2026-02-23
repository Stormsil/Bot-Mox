import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class AdminAuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(input: {
    actorUserId?: string;
    actorTenantId?: string;
    action: string;
    targetTenantId?: string;
    payload?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.adminAuditEvent.create({
      data: {
        action: String(input.action || '').trim() || 'unknown.action',
        ...(input.actorUserId ? { actorUserId: input.actorUserId } : {}),
        ...(input.actorTenantId ? { actorTenantId: input.actorTenantId } : {}),
        ...(input.targetTenantId ? { targetTenantId: input.targetTenantId } : {}),
        payload: (input.payload ?? {}) as Prisma.InputJsonValue,
      },
    });
  }

  async list(input: {
    limit?: number;
    action?: string;
    targetTenantId?: string;
    actorUserId?: string;
  }): Promise<Record<string, unknown>[]> {
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(1000, Math.trunc(input.limit || 100)))
      : 100;

    const rows = await this.prisma.adminAuditEvent.findMany({
      where: {
        ...(String(input.action || '').trim() ? { action: String(input.action || '').trim() } : {}),
        ...(String(input.targetTenantId || '').trim()
          ? {
              targetTenantId: String(input.targetTenantId || '')
                .trim()
                .toLowerCase(),
            }
          : {}),
        ...(String(input.actorUserId || '').trim()
          ? { actorUserId: String(input.actorUserId || '').trim() }
          : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: limit,
    });

    return rows.map((row) => ({
      id: row.id,
      actor_user_id: row.actorUserId,
      actor_tenant_id: row.actorTenantId,
      action: row.action,
      target_tenant_id: row.targetTenantId,
      payload: row.payload,
      created_at: row.createdAt.toISOString(),
    }));
  }
}
