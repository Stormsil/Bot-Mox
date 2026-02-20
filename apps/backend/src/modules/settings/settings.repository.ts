import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class SettingsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getSettingsItemClient(): {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (this.prisma as unknown as { settingsItem: unknown }).settingsItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async findByPath(tenantId: string, path: string): Promise<Record<string, unknown> | null> {
    return this.getSettingsItemClient().findFirst({
      where: {
        tenantId,
        path,
      },
    });
  }

  async upsert(input: {
    tenantId: string;
    path: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.getSettingsItemClient().upsert({
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
  }
}
