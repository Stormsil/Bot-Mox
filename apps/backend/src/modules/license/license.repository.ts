import type { licenseLeaseResponseSchema } from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { DataAtRestCrypto } from '../common/data-at-rest-crypto';
import { softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

type LeaseResponse = z.infer<typeof licenseLeaseResponseSchema>;

export interface PersistedLease {
  lease: LeaseResponse;
  status: 'active' | 'revoked';
  revoked_at?: number;
}

@Injectable()
export class LicenseRepository {
  private readonly atRestCrypto = new DataAtRestCrypto();

  constructor(private readonly prisma: PrismaService) {}

  private readAnyEnvelope(payload: Prisma.JsonValue): unknown {
    if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
      const wrapped = (payload as Record<string, unknown>).__enc_payload_v1;
      return wrapped ?? payload;
    }
    return payload;
  }

  private decryptLeasePayload(payload: Prisma.JsonValue): PersistedLease | null {
    const envelope = this.readAnyEnvelope(payload);
    const decrypted = this.atRestCrypto.decryptJson<PersistedLease>(envelope);
    return decrypted ?? (payload as unknown as PersistedLease);
  }

  private encryptLeasePayload(payload: PersistedLease): Prisma.InputJsonValue {
    return {
      __enc_payload_v1: this.atRestCrypto.encryptJson(payload),
    } as unknown as Prisma.InputJsonValue;
  }

  private getLicenseLeaseItemClient(): {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (this.prisma as unknown as { licenseLeaseItem: unknown }).licenseLeaseItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async findById(tenantId: string, id: string): Promise<PersistedLease | null> {
    const row = await softFailMissingStorageRead(() => this.getLicenseLeaseItemClient().findFirst({
      where: {
        tenantId,
        id,
      },
    }), null);
    if (!row) {
      return null;
    }
    return this.decryptLeasePayload(row.payload as Prisma.JsonValue);
  }

  async upsert(input: {
    tenantId: string;
    id: string;
    payload: PersistedLease;
  }): Promise<PersistedLease> {
    const row = await this.getLicenseLeaseItemClient().upsert({
      where: {
        tenantId_id: {
          tenantId: input.tenantId,
          id: input.id,
        },
      },
      create: {
        tenantId: input.tenantId,
        id: input.id,
        payload: this.encryptLeasePayload(input.payload),
      },
      update: {
        payload: this.encryptLeasePayload(input.payload),
      },
    });
    return this.decryptLeasePayload(row.payload as Prisma.JsonValue) as PersistedLease;
  }

  async findActiveByToken(input: {
    tenantId: string;
    token: string;
    vmUuid: string;
    module: string;
  }): Promise<PersistedLease['lease'] | null> {
    const rows = await softFailMissingStorageRead(() => this.getLicenseLeaseItemClient().findMany({
      where: { tenantId: input.tenantId },
    }), []);

    const now = Date.now();
    for (const row of rows) {
      const payload = this.decryptLeasePayload(row.payload as Prisma.JsonValue);
      if (!payload || payload.status !== 'active') {
        continue;
      }
      const lease = payload.lease;
      if (!lease) {
        continue;
      }
      if (lease.token !== input.token) {
        continue;
      }
      if (lease.vm_uuid !== input.vmUuid) {
        continue;
      }
      if (lease.module !== input.module) {
        continue;
      }
      if (Number(lease.expires_at || 0) <= now) {
        continue;
      }
      return lease;
    }

    return null;
  }
}
