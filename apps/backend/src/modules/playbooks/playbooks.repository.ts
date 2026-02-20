import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class PlaybooksRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getPlaybookItemClient(): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  } {
    return (this.prisma as unknown as { playbookItem: unknown }).playbookItem as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }

  async list(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return this.getPlaybookItemClient().findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return this.getPlaybookItemClient().findFirst({
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
    return this.getPlaybookItemClient().upsert({
      where: {
        tenantId_id: {
          tenantId: input.tenantId,
          id: input.id,
        },
      },
      create: {
        id: input.id,
        tenantId: input.tenantId,
        payload: input.payload,
      },
      update: {
        tenantId: input.tenantId,
        payload: input.payload,
      },
    });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    const result = await this.getPlaybookItemClient().deleteMany({
      where: {
        tenantId,
        id,
      },
    });
    return result.count > 0;
  }
}
