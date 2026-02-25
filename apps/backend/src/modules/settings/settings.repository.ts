import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { TenantJsonStoreRepository } from '../common/prisma-json-store.repository';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class SettingsRepository {
  private readonly jsonStore: TenantJsonStoreRepository;

  constructor(prisma: PrismaService) {
    this.jsonStore = new TenantJsonStoreRepository(prisma);
  }

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
    return this.jsonStore.findById(tenantId, {
      getClient: (tx) => this.getSettingsItemClient(tx),
      where: { tenantId, path },
    });
  }

  async upsert(input: {
    tenantId: string;
    path: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.jsonStore.upsertSoftFail(input.tenantId, {
      getClient: (tx) => this.getSettingsItemClient(tx),
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
      fallback: {
        tenantId: input.tenantId,
        path: input.path,
        payload: input.payload,
      },
    });
  }
}
