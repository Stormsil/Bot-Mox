import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class FinanceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getFinanceClient(): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  } {
    return (this.prisma as unknown as { financeOperation: unknown }).financeOperation as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }

  async list(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return this.getFinanceClient().findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return this.getFinanceClient().findFirst({
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
    return this.getFinanceClient().upsert({
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
    const result = await this.getFinanceClient().deleteMany({
      where: {
        tenantId,
        id,
      },
    });
    return result.count > 0;
  }
}
