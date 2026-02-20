import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class BotsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getBotClient(): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  } {
    return (this.prisma as unknown as { botEntity: unknown }).botEntity as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }

  async list(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return this.getBotClient().findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return this.getBotClient().findFirst({
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
    return this.getBotClient().upsert({
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
    const result = await this.getBotClient().deleteMany({
      where: {
        tenantId,
        id,
      },
    });
    return result.count > 0;
  }
}
