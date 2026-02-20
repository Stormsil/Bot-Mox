import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class WorkspaceRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getWorkspaceItemClient(): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  } {
    return (this.prisma as unknown as { workspaceItem: unknown }).workspaceItem as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }

  async list(tenantId: string, kind: string): Promise<Array<Record<string, unknown>>> {
    return this.getWorkspaceItemClient().findMany({
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
    return this.getWorkspaceItemClient().findFirst({
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
    return this.getWorkspaceItemClient().upsert({
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
    const result = await this.getWorkspaceItemClient().deleteMany({
      where: {
        tenantId,
        kind,
        id,
      },
    });
    return result.count > 0;
  }
}
