import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class PlaybooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getPlaybookItemClient(source: PrismaClient | Prisma.TransactionClient): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  } {
    return (source as unknown as { playbookItem: unknown }).playbookItem as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }

  async list(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return softFailMissingStorageRead(() => this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getPlaybookItemClient(tx).findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
      });
    }), []);
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return softFailMissingStorageRead(() => this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getPlaybookItemClient(tx).findFirst({
        where: {
          tenantId,
          id,
        },
      });
    }), null);
  }

  async upsert(input: {
    tenantId: string;
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      return this.getPlaybookItemClient(tx).upsert({
        where: {
          tenantId_id: {
            tenantId: input.tenantId,
            id: input.id,
          },
        },
        create: {
          id: input.id,
          tenantId: input.tenantId,
          payload: input.payload,
        },
        update: {
          tenantId: input.tenantId,
          payload: input.payload,
        },
      });
    });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getPlaybookItemClient(tx).deleteMany({
        where: {
          tenantId,
          id,
        },
      });
    });
    return result.count > 0;
  }
}
