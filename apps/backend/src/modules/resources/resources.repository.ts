import { Injectable } from '@nestjs/common';
import type { Prisma, PrismaClient } from '@prisma/client';
import { TenantJsonStoreRepository } from '../common/prisma-json-store.repository';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class ResourcesRepository {
  private readonly jsonStore: TenantJsonStoreRepository;

  constructor(prisma: PrismaService) {
    this.jsonStore = new TenantJsonStoreRepository(prisma);
  }

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
    return this.jsonStore.list(tenantId, {
      getClient: (tx) => this.getResourceItemClient(tx),
      where: {
        tenantId,
        kind,
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(
    tenantId: string,
    kind: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    return this.jsonStore.findById(tenantId, {
      getClient: (tx) => this.getResourceItemClient(tx),
      where: {
        tenantId,
        kind,
        id,
      },
    });
  }

  async upsert(input: {
    tenantId: string;
    kind: string;
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.jsonStore.upsert(input.tenantId, {
      getClient: (tx) => this.getResourceItemClient(tx),
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
  }

  async delete(tenantId: string, kind: string, id: string): Promise<boolean> {
    return this.jsonStore.delete(tenantId, {
      getClient: (tx) => this.getResourceItemClient(tx),
      where: {
        tenantId,
        kind,
        id,
      },
    });
  }
}
