import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import { softFailMissingStorage, softFailMissingStorageRead } from './prisma-soft-fail';

export interface JsonStoreListClientLike {
  findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
}

export interface JsonStoreFindClientLike {
  findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
}

export interface JsonStoreUpsertClientLike {
  upsert: (args: unknown) => Promise<Record<string, unknown>>;
}

export interface JsonStoreDeleteClientLike {
  deleteMany: (args: unknown) => Promise<{ count: number }>;
}
export class TenantJsonStoreRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(
    tenantId: string,
    options: {
      getClient: (tx: Prisma.TransactionClient) => JsonStoreListClientLike;
      where: Record<string, unknown>;
      orderBy?: Record<string, unknown>;
      fallback?: Array<Record<string, unknown>>;
    },
  ): Promise<Array<Record<string, unknown>>> {
    return softFailMissingStorageRead(
      () =>
        this.prisma.withTenantContext(tenantId, async (tx) => {
          return options.getClient(tx).findMany({
            where: options.where,
            ...(options.orderBy ? { orderBy: options.orderBy } : {}),
          });
        }),
      options.fallback ?? [],
    );
  }

  async findById(
    tenantId: string,
    options: {
      getClient: (tx: Prisma.TransactionClient) => JsonStoreFindClientLike;
      where: Record<string, unknown>;
      fallback?: Record<string, unknown> | null;
    },
  ): Promise<Record<string, unknown> | null> {
    return softFailMissingStorageRead(
      () =>
        this.prisma.withTenantContext(tenantId, async (tx) => {
          return options.getClient(tx).findFirst({
            where: options.where,
          });
        }),
      options.fallback ?? null,
    );
  }

  async upsert(
    tenantId: string,
    options: {
      getClient: (tx: Prisma.TransactionClient) => JsonStoreUpsertClientLike;
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      return options.getClient(tx).upsert({
        where: options.where,
        create: options.create,
        update: options.update,
      });
    });
  }

  async upsertSoftFail(
    tenantId: string,
    options: {
      getClient: (tx: Prisma.TransactionClient) => JsonStoreUpsertClientLike;
      where: Record<string, unknown>;
      create: Record<string, unknown>;
      update: Record<string, unknown>;
      fallback: Record<string, unknown>;
    },
  ): Promise<Record<string, unknown>> {
    return softFailMissingStorage(
      () =>
        this.prisma.withTenantContext(tenantId, async (tx) => {
          return options.getClient(tx).upsert({
            where: options.where,
            create: options.create,
            update: options.update,
          });
        }),
      options.fallback,
    );
  }

  async delete(
    tenantId: string,
    options: {
      getClient: (tx: Prisma.TransactionClient) => JsonStoreDeleteClientLike;
      where: Record<string, unknown>;
    },
  ): Promise<boolean> {
    const result = await this.prisma.withTenantContext(tenantId, async (tx) => {
      return options.getClient(tx).deleteMany({
        where: options.where,
      });
    });
    return result.count > 0;
  }
}
