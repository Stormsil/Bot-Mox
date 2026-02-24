import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class ThemeAssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getThemeAssetItemClient(source: PrismaClient | Prisma.TransactionClient): {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (source as unknown as { themeAssetItem: unknown }).themeAssetItem as {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async listByTenant(tenantId: string): Promise<Record<string, unknown>[]> {
    return softFailMissingStorageRead(() => this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getThemeAssetItemClient(tx).findMany({
        where: {
          tenantId,
        },
        orderBy: {
          updatedAt: 'desc',
        },
      });
    }), []);
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return softFailMissingStorageRead(() => this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getThemeAssetItemClient(tx).findFirst({
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
      return this.getThemeAssetItemClient(tx).upsert({
        where: {
          tenantId_id: {
            tenantId: input.tenantId,
            id: input.id,
          },
        },
        create: {
          tenantId: input.tenantId,
          id: input.id,
          payload: input.payload,
        },
        update: {
          payload: input.payload,
        },
      });
    });
  }
}
