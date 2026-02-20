import type { licenseLeaseResponseSchema } from '@botmox/api-contract';
import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
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
    return (this.prisma as unknown as { licenseLeaseItem: unknown }).licenseLeaseItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async findById(tenantId: string, id: string): Promise<PersistedLease | null> {
    const row = await this.getLicenseLeaseItemClient().findFirst({
      where: {
        tenantId,
        id,
      },
    });
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
        payload: input.payload as unknown as Prisma.InputJsonValue,
      },
      update: {
        payload: input.payload as unknown as Prisma.InputJsonValue,
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
    const rows = await this.getLicenseLeaseItemClient().findMany({
      where: { tenantId: input.tenantId },
    });

    const now = Date.now();
    for (const row of rows) {
      const payload = row.payload as PersistedLease | undefined;
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
