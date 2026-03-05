import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class BotsRepository {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private asRecord(value: unknown): Record<string, unknown> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }
    return value as Record<string, unknown>;
  }

  private toTrimmedString(value: unknown): string | null {
    if (typeof value !== 'string') {
      return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
  }

  private toOptionalJsonObject(value: unknown): Prisma.InputJsonValue | null {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return null;
    }
    return value as Prisma.InputJsonValue;
  }

  private toDateValue(value: unknown): Date | null {
    if (value instanceof Date) {
      return Number.isNaN(value.getTime()) ? null : value;
    }
    if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        const fromNumeric = new Date(numeric);
        if (!Number.isNaN(fromNumeric.getTime())) {
          return fromNumeric;
        }
      }
      const fromString = new Date(value);
      return Number.isNaN(fromString.getTime()) ? null : fromString;
    }
    return null;
  }

  private toEpochMillis(value: unknown): number | null {
    const parsed = this.toDateValue(value);
    return parsed ? parsed.getTime() : null;
  }

  private pickFirstDefined(payload: Record<string, unknown>, keys: string[]): unknown {
    for (const key of keys) {
      if (Object.hasOwn(payload, key)) {
        return payload[key];
      }
    }
    return undefined;
  }

  private resolveBotTypedColumns(payloadValue: Prisma.InputJsonValue): {
    status: string | null;
    lifecycle: Prisma.InputJsonValue | null;
    platform: string | null;
    profile: string | null;
    version: string | null;
    lastSeenAt: Date | null;
  } {
    const payload = this.asRecord(payloadValue);
    const rawLastSeen = this.pickFirstDefined(payload, ['last_seen_at', 'lastSeenAt', 'last_seen']);
    return {
      status: this.toTrimmedString(payload.status),
      lifecycle: this.toOptionalJsonObject(payload.lifecycle),
      platform: this.toTrimmedString(payload.platform),
      profile: this.toTrimmedString(payload.profile),
      version: this.toTrimmedString(payload.version),
      lastSeenAt: this.toDateValue(rawLastSeen),
    };
  }

  private asTypedRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.map((row) => {
      const typedStatus = this.toTrimmedString(row.status);
      const typedLifecycle = this.toOptionalJsonObject(row.lifecycle);
      const typedPlatform = this.toTrimmedString(row.platform);
      const typedProfile = this.toTrimmedString(row.profile);
      const typedVersion = this.toTrimmedString(row.version);
      const typedLastSeenAt = this.toEpochMillis(row.lastSeenAt);

      return {
        id: row.id,
        payload: {
          ...(typedStatus ? { status: typedStatus } : {}),
          ...(typedLifecycle ? { lifecycle: typedLifecycle } : {}),
          ...(typedPlatform ? { platform: typedPlatform } : {}),
          ...(typedProfile ? { profile: typedProfile } : {}),
          ...(typedVersion ? { version: typedVersion } : {}),
          ...(typedLastSeenAt !== null ? { last_seen_at: typedLastSeenAt } : {}),
        } as Prisma.JsonValue,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  private async listTyped(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select
            id,
            status,
            lifecycle,
            platform,
            profile,
            version,
            last_seen_at as "lastSeenAt",
            created_at as "createdAt",
            updated_at as "updatedAt"
          from public.bots
          where tenant_id = ${tenantId}
          order by updated_at desc
        `),
      [],
    );
    return this.asTypedRows(rows);
  }

  private async findByIdTyped(
    tenantId: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select
            id,
            status,
            lifecycle,
            platform,
            profile,
            version,
            last_seen_at as "lastSeenAt",
            created_at as "createdAt",
            updated_at as "updatedAt"
          from public.bots
          where tenant_id = ${tenantId}
            and id = ${id}
          limit 1
        `),
      [],
    );
    return rows[0] ? (this.asTypedRows(rows)[0] ?? null) : null;
  }

  private async upsertTyped(
    input: {
      tenantId: string;
      id: string;
      payload: Prisma.InputJsonValue;
    },
    fallback: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const typedColumns = this.resolveBotTypedColumns(input.payload);
    const lifecycleJson = JSON.stringify(typedColumns.lifecycle ?? {});
    const operation = async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into public.bots (
            tenant_id,
            id,
            status,
            lifecycle,
            platform,
            profile,
            version,
            last_seen_at,
            created_at,
            updated_at
          ) values (
            ${input.tenantId},
            ${input.id},
            ${typedColumns.status},
            ${lifecycleJson}::jsonb,
            ${typedColumns.platform},
            ${typedColumns.profile},
            ${typedColumns.version},
            ${typedColumns.lastSeenAt},
            now(),
            now()
          )
          on conflict (tenant_id, id)
          do update set
            status = excluded.status,
            lifecycle = excluded.lifecycle,
            platform = excluded.platform,
            profile = excluded.profile,
            version = excluded.version,
            last_seen_at = excluded.last_seen_at,
            updated_at = now()
          returning
            id,
            status,
            lifecycle,
            platform,
            profile,
            version,
            last_seen_at as "lastSeenAt",
            created_at as "createdAt",
            updated_at as "updatedAt"
        `);
      const mapped = this.asTypedRows(rows);
      return mapped[0] ?? fallback;
    };
    return operation();
  }

  private async deleteTyped(tenantId: string, id: string): Promise<boolean> {
    const operation = () =>
      this.prisma.$executeRaw<number>(Prisma.sql`
        delete from public.bots
        where tenant_id = ${tenantId}
          and id = ${id}
      `);
    const count = await operation();
    return count > 0;
  }

  async list(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return this.listTyped(tenantId);
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return this.findByIdTyped(tenantId, id);
  }

  async upsert(input: {
    tenantId: string;
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.upsertTyped(input, {
      id: input.id,
      payload: input.payload,
    });
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    return this.deleteTyped(tenantId, id);
  }
}
