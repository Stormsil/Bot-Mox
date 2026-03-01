import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { TenantJsonStoreRepository } from '../common/prisma-json-store.repository';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class BotsRepository {
  private readonly jsonStore: TenantJsonStoreRepository;

  constructor(prisma: PrismaService) {
    this.jsonStore = new TenantJsonStoreRepository(prisma);
  }

  private getBotClient(source: PrismaClient | Prisma.TransactionClient): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  } {
    return (source as unknown as { botEntity: unknown }).botEntity as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }

  async list(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return this.jsonStore.list(tenantId, {
      getClient: (tx) => this.getBotClient(tx),
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return this.jsonStore.findById(tenantId, {
      getClient: (tx) => this.getBotClient(tx),
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
    return this.jsonStore.upsert(input.tenantId, {
      getClient: (tx) => this.getBotClient(tx),
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

  async delete(tenantId: string, id: string): Promise<boolean> {
    return this.jsonStore.delete(tenantId, {
      getClient: (tx) => this.getBotClient(tx),
      where: {
        tenantId,
        id,
      },
    });
  }
}
