import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DataAtRestCrypto } from '../common/data-at-rest-crypto';
import { PrismaService } from '../db/prisma.service';
import type { ArtifactAssignmentRecord, ArtifactReleaseRecord } from './artifacts.service';

@Injectable()
export class ArtifactsRepository {
  private readonly atRestCrypto = new DataAtRestCrypto();

  constructor(private readonly prisma: PrismaService) {}

  private readAnyEnvelope(payload: Prisma.JsonValue): unknown {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const wrapped = (payload as Record<string, unknown>).__enc_payload_v1;
      return wrapped ?? payload;
    }
    return payload;
  }

  private decryptRecord<T>(payload: Prisma.JsonValue): T {
    const envelope = this.readAnyEnvelope(payload);
    const decrypted = this.atRestCrypto.decryptJson<T>(envelope);
    return (decrypted ?? payload) as T;
  }

  private encryptRecord(payload: Record<string, unknown>): Prisma.InputJsonValue {
    return {
      __enc_payload_v1: this.atRestCrypto.encryptJson(payload),
    } as unknown as Prisma.InputJsonValue;
  }

  private getReleaseClient(): {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (this.prisma as unknown as { artifactReleaseItem: unknown }).artifactReleaseItem as {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  private getAssignmentClient(): {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (this.prisma as unknown as { artifactAssignmentItem: unknown })
      .artifactAssignmentItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async getNextReleaseId(tenantId: string): Promise<number> {
    const row = await this.getReleaseClient().findFirst({
      where: { tenantId },
      orderBy: { id: 'desc' },
    });
    return Number((row?.id as number | undefined) ?? 0) + 1;
  }

  async findReleaseById(tenantId: string, id: number): Promise<ArtifactReleaseRecord | null> {
    const row = await this.getReleaseClient().findFirst({
      where: {
        tenantId,
        id,
      },
    });
    if (!row) return null;
    return this.decryptRecord<ArtifactReleaseRecord>(row.payload as Prisma.JsonValue);
  }

  async upsertRelease(input: {
    tenantId: string;
    id: number;
    payload: ArtifactReleaseRecord;
  }): Promise<ArtifactReleaseRecord> {
    const row = await this.getReleaseClient().upsert({
      where: {
        tenantId_id: {
          tenantId: input.tenantId,
          id: input.id,
        },
      },
      create: {
        tenantId: input.tenantId,
        id: input.id,
        payload: this.encryptRecord(input.payload as unknown as Record<string, unknown>),
      },
      update: {
        payload: this.encryptRecord(input.payload as unknown as Record<string, unknown>),
      },
    });
    return this.decryptRecord<ArtifactReleaseRecord>(row.payload as Prisma.JsonValue);
  }

  async getNextAssignmentId(tenantId: string): Promise<number> {
    const row = await this.getAssignmentClient().findFirst({
      where: { tenantId },
      orderBy: { id: 'desc' },
    });
    return Number((row?.id as number | undefined) ?? 0) + 1;
  }

  async findAssignmentByScope(input: {
    tenantId: string;
    module: string;
    platform: string;
    channel: string;
    userKey: string;
  }): Promise<ArtifactAssignmentRecord | null> {
    const row = await this.getAssignmentClient().findFirst({
      where: {
        tenantId: input.tenantId,
        module: input.module,
        platform: input.platform,
        channel: input.channel,
        userKey: input.userKey,
      },
    });
    if (!row) return null;
    return this.decryptRecord<ArtifactAssignmentRecord>(row.payload as Prisma.JsonValue);
  }

  async upsertAssignmentByScope(input: {
    tenantId: string;
    id: number;
    module: string;
    platform: string;
    channel: string;
    userKey: string;
    payload: ArtifactAssignmentRecord;
  }): Promise<ArtifactAssignmentRecord> {
    const row = await this.getAssignmentClient().upsert({
      where: {
        tenantId_module_platform_channel_userKey: {
          tenantId: input.tenantId,
          module: input.module,
          platform: input.platform,
          channel: input.channel,
          userKey: input.userKey,
        },
      },
      create: {
        tenantId: input.tenantId,
        id: input.id,
        module: input.module,
        platform: input.platform,
        channel: input.channel,
        userKey: input.userKey,
        payload: this.encryptRecord(input.payload as unknown as Record<string, unknown>),
      },
      update: {
        id: input.id,
        payload: this.encryptRecord(input.payload as unknown as Record<string, unknown>),
      },
    });
    return this.decryptRecord<ArtifactAssignmentRecord>(row.payload as Prisma.JsonValue);
  }
}
