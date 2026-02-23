import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class ResourcesRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getResourceItemClient(source: PrismaClient | Prisma.TransactionClient): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  } {
    return (source as unknown as { resourceItem: unknown }).resourceItem as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }

  async list(tenantId: string, kind: string): Promise<Array<Record<string, unknown>>> {
    return softFailMissingStorageRead(() => this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getResourceItemClient(tx).findMany({
        where: {
          tenantId,
          kind,
        },
        orderBy: { updatedAt: 'desc' },
      });
    }), []);
  }

  async findById(
    tenantId: string,
    kind: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    return softFailMissingStorageRead(() => this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getResourceItemClient(tx).findFirst({
        where: {
          tenantId,
          kind,
          id,
        },
      });
    }), null);
  }

  async upsert(input: {
    tenantId: string;
    kind: string;
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      return this.getResourceItemClient(tx).upsert({
        where: {
          tenantId_kind_id: {
            tenantId: input.tenantId,
            kind: input.kind,
            id: input.id,
          },
        },
        create: {
          id: input.id,
          tenantId: input.tenantId,
          kind: input.kind,
          payload: input.payload,
        },
        update: {
          tenantId: input.tenantId,
          kind: input.kind,
          payload: input.payload,
        },
      });
    });
  }

  async delete(tenantId: string, kind: string, id: string): Promise<boolean> {
    const result = await this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getResourceItemClient(tx).deleteMany({
        where: {
          tenantId,
          kind,
          id,
        },
      });
    });
    return result.count > 0;
  }
}
