import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class ThemeAssetsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getThemeAssetItemClient(): {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (this.prisma as unknown as { themeAssetItem: unknown }).themeAssetItem as {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async listByTenant(tenantId: string): Promise<Record<string, unknown>[]> {
    return this.getThemeAssetItemClient().findMany({
      where: {
        tenantId,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return this.getThemeAssetItemClient().findFirst({
      where: {
        tenantId,
        id,
      },
    });
  }

  async upsert(input: {
    tenantId: string;
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.getThemeAssetItemClient().upsert({
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
  }
}
