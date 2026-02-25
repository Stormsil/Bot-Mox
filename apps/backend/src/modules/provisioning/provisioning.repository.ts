import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { softFailMissingStorageRead } from '../common/prisma-soft-fail';
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
    return (
      this.prisma.getPayloadCryptoClient<{ provisioningProfileItem: unknown }>() as {
        provisioningProfileItem: unknown;
      }
    ).provisioningProfileItem as {
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
    return (
      this.prisma.getPayloadCryptoClient<{ provisioningTokenItem: unknown }>() as {
        provisioningTokenItem: unknown;
      }
    ).provisioningTokenItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      delete: (args: unknown) => Promise<unknown>;
    };
  }

  private getProgressClient(): {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    create: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (
      this.prisma.getPayloadCryptoClient<{ provisioningProgressItem: unknown }>() as {
        provisioningProgressItem: unknown;
      }
    ).provisioningProgressItem as {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      create: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async listProfiles(tenantId: string): Promise<UnattendProfileRecord[]> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.getProfileClient().findMany({
          where: { tenantId },
          orderBy: { updatedAt: 'desc' },
        }),
      [],
    );
    return rows.map((row) => row.payload as UnattendProfileRecord);
  }

  async findProfileById(tenantId: string, id: string): Promise<UnattendProfileRecord | null> {
    const row = await softFailMissingStorageRead(
      () =>
        this.getProfileClient().findFirst({
          where: { tenantId, id },
        }),
      null,
    );
    return row ? (row.payload as UnattendProfileRecord) : null;
  }

  async upsertProfile(input: {
    tenantId: string;
    id: string;
    payload: Record<string, unknown> | UnattendProfileRecord;
  }): Promise<Record<string, unknown>> {
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
    return row.payload as Record<string, unknown>;
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
        payload: record,
        expiresAt: new Date(record.expiresAtMs),
      },
      update: {
        tenantId: record.tenantId,
        payload: record,
        expiresAt: new Date(record.expiresAtMs),
      },
    });
  }

  async findToken(token: string): Promise<ProvisioningTokenRecord | null> {
    const row = await softFailMissingStorageRead(
      () =>
        this.getTokenClient().findFirst({
          where: {
            token,
          },
        }),
      null,
    );
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
    payload: Record<string, unknown> | ReportProgressResult;
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

  async listProgressByVm(
    tenantId: string,
    vmUuid: string,
  ): Promise<Array<Record<string, unknown>>> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.getProgressClient().findMany({
          where: {
            tenantId,
            vmUuid,
          },
          orderBy: {
            updatedAt: 'asc',
          },
        }),
      [],
    );
    return rows.map((row) => row.payload as Record<string, unknown>);
  }
}
