import type { licenseLeaseResponseSchema } from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';
import type { z } from 'zod';
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
  constructor(private readonly prisma: PrismaService) {}

  private getLicenseLeaseItemClient(): {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (
      this.prisma.getPayloadCryptoClient<{ licenseLeaseItem: unknown }>() as {
        licenseLeaseItem: unknown;
      }
    ).licenseLeaseItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async findById(tenantId: string, id: string): Promise<PersistedLease | null> {
    const row = await softFailMissingStorageRead(
      () =>
        this.getLicenseLeaseItemClient().findFirst({
          where: {
            tenantId,
            id,
          },
        }),
      null,
    );
    if (!row) {
      return null;
    }
    return row.payload as PersistedLease;
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
        payload: input.payload,
      },
      update: {
        payload: input.payload,
      },
    });
    return row.payload as PersistedLease;
  }

  async findActiveByToken(input: {
    tenantId: string;
    token: string;
    vmUuid: string;
    module: string;
  }): Promise<PersistedLease['lease'] | null> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.getLicenseLeaseItemClient().findMany({
          where: { tenantId: input.tenantId },
        }),
      [],
    );

    const now = Date.now();
    for (const row of rows) {
      const payload = row.payload as PersistedLease;
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
