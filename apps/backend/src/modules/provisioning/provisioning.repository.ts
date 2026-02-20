import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';
import type {
  ProvisioningTokenRecord,
  ReportProgressResult,
  UnattendProfileRecord,
} from './provisioning.service';

@Injectable()
export class ProvisioningRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getProfileClient(): {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    delete: (args: unknown) => Promise<unknown>;
  } {
    return (this.prisma as unknown as { provisioningProfileItem: unknown })
      .provisioningProfileItem as {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      delete: (args: unknown) => Promise<unknown>;
    };
  }

  private getTokenClient(): {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    delete: (args: unknown) => Promise<unknown>;
  } {
    return (this.prisma as unknown as { provisioningTokenItem: unknown }).provisioningTokenItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      delete: (args: unknown) => Promise<unknown>;
    };
  }

  private getProgressClient(): {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    create: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (this.prisma as unknown as { provisioningProgressItem: unknown })
      .provisioningProgressItem as {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      create: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async listProfiles(tenantId: string): Promise<UnattendProfileRecord[]> {
    const rows = await this.getProfileClient().findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
    });
    return rows.map((row) => row.payload as UnattendProfileRecord);
  }

  async findProfileById(tenantId: string, id: string): Promise<UnattendProfileRecord | null> {
    const row = await this.getProfileClient().findFirst({
      where: { tenantId, id },
    });
    return row ? (row.payload as UnattendProfileRecord) : null;
  }

  async upsertProfile(input: {
    tenantId: string;
    id: string;
    payload: UnattendProfileRecord;
  }): Promise<UnattendProfileRecord> {
    const row = await this.getProfileClient().upsert({
      where: {
        tenantId_id: {
          tenantId: input.tenantId,
          id: input.id,
        },
      },
      create: {
        tenantId: input.tenantId,
        id: input.id,
        payload: input.payload as unknown as Prisma.InputJsonValue,
      },
      update: {
        payload: input.payload as unknown as Prisma.InputJsonValue,
      },
    });
    return row.payload as UnattendProfileRecord;
  }

  async deleteProfile(tenantId: string, id: string): Promise<void> {
    await this.getProfileClient().delete({
      where: {
        tenantId_id: {
          tenantId,
          id,
        },
      },
    });
  }

  async upsertToken(record: ProvisioningTokenRecord): Promise<void> {
    await this.getTokenClient().upsert({
      where: {
        token: record.token,
      },
      create: {
        token: record.token,
        tenantId: record.tenantId,
        payload: record as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(record.expiresAtMs),
      },
      update: {
        tenantId: record.tenantId,
        payload: record as unknown as Prisma.InputJsonValue,
        expiresAt: new Date(record.expiresAtMs),
      },
    });
  }

  async findToken(token: string): Promise<ProvisioningTokenRecord | null> {
    const row = await this.getTokenClient().findFirst({
      where: {
        token,
      },
    });
    return row ? (row.payload as ProvisioningTokenRecord) : null;
  }

  async deleteToken(token: string): Promise<void> {
    await this.getTokenClient().delete({
      where: {
        token,
      },
    });
  }

  async appendProgress(input: {
    tenantId: string;
    id: string;
    vmUuid: string;
    payload: ReportProgressResult;
  }): Promise<void> {
    await this.getProgressClient().create({
      data: {
        tenantId: input.tenantId,
        id: input.id,
        vmUuid: input.vmUuid,
        payload: input.payload as unknown as Prisma.InputJsonValue,
      },
    });
  }

  async listProgressByVm(tenantId: string, vmUuid: string): Promise<ReportProgressResult[]> {
    const rows = await this.getProgressClient().findMany({
      where: {
        tenantId,
        vmUuid,
      },
      orderBy: {
        updatedAt: 'asc',
      },
    });
    return rows.map((row) => row.payload as ReportProgressResult);
  }
}
