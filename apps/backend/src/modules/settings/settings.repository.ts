import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getSettingsItemClient(source: PrismaClient | Prisma.TransactionClient): {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (source as unknown as { settingsItem: unknown }).settingsItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async findByPath(tenantId: string, path: string): Promise<Record<string, unknown> | null> {
    return softFailMissingStorageRead(() => this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getSettingsItemClient(tx).findFirst({
        where: {
          tenantId,
          path,
        },
      });
    }), null);
  }

  async upsert(input: {
    tenantId: string;
    path: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return softFailMissingStorage(() => this.prisma.withTenantContext(input.tenantId, async (tx) => {
      return this.getSettingsItemClient(tx).upsert({
        where: {
          tenantId_path: {
            tenantId: input.tenantId,
            path: input.path,
          },
        },
        create: {
          tenantId: input.tenantId,
          path: input.path,
          payload: input.payload,
        },
        update: {
          tenantId: input.tenantId,
          path: input.path,
          payload: input.payload,
        },
      });
    }), {
      tenantId: input.tenantId,
      path: input.path,
      payload: input.payload,
    });
  }
}
