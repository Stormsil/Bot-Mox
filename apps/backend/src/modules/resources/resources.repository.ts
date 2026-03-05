import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class ResourcesRepository {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private resolveTypedTable(kind: string): string | null {
    if (kind === 'licenses') return 'resources_licenses';
    if (kind === 'proxies') return 'resources_proxies';
    if (kind === 'subscriptions') return 'resources_subscriptions';
    return null;
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

  private toInteger(value: unknown): number | null {
    if (typeof value === 'number' && Number.isFinite(value)) {
      return Math.trunc(value);
    }
    if (typeof value === 'string' && value.trim().length > 0) {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
    }
    return null;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === 'boolean') {
      return value;
    }
    if (typeof value === 'string') {
      const normalized = value.trim().toLowerCase();
      if (
        normalized === 'true' ||
        normalized === '1' ||
        normalized === 'yes' ||
        normalized === 'on'
      ) {
        return true;
      }
      if (
        normalized === 'false' ||
        normalized === '0' ||
        normalized === 'no' ||
        normalized === 'off'
      ) {
        return false;
      }
    }
    return null;
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

  private resolveResourceTypedColumns(payloadValue: Prisma.InputJsonValue): {
    type: string | null;
    status: string | null;
    botId: string | null;
    country: string | null;
    countryCode: string | null;
    ip: string | null;
    port: number | null;
    expiresAt: Date | null;
    daysRemaining: number | null;
    isExpiringSoon: boolean | null;
  } {
    const payload = this.asRecord(payloadValue);
    return {
      type: this.toTrimmedString(payload.type),
      status: this.toTrimmedString(payload.status),
      botId: this.toTrimmedString(this.pickFirstDefined(payload, ['bot_id', 'botId'])),
      country: this.toTrimmedString(payload.country),
      countryCode: this.toTrimmedString(
        this.pickFirstDefined(payload, ['country_code', 'countryCode']),
      ),
      ip: this.toTrimmedString(payload.ip),
      port: this.toInteger(payload.port),
      expiresAt: this.toDateValue(this.pickFirstDefined(payload, ['expires_at', 'expiresAt'])),
      daysRemaining: this.toInteger(
        this.pickFirstDefined(payload, ['days_remaining', 'daysRemaining']),
      ),
      isExpiringSoon: this.toBoolean(
        this.pickFirstDefined(payload, ['is_expiring_soon', 'isExpiringSoon']),
      ),
    };
  }

  private asTypedRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.map((row) => {
      const typedType = this.toTrimmedString(row.type);
      const typedStatus = this.toTrimmedString(row.status);
      const typedBotId = this.toTrimmedString(row.botId);
      const typedCountry = this.toTrimmedString(row.country);
      const typedCountryCode = this.toTrimmedString(row.countryCode);
      const typedIp = this.toTrimmedString(row.ip);
      const typedPort = this.toInteger(row.port);
      const typedExpiresAt = this.toEpochMillis(row.expiresAt);
      const typedDaysRemaining = this.toInteger(row.daysRemaining);
      const typedIsExpiringSoon = this.toBoolean(row.isExpiringSoon);

      return {
        id: row.id,
        payload: {
          ...(typedType ? { type: typedType } : {}),
          ...(typedStatus ? { status: typedStatus } : {}),
          ...(typedBotId ? { bot_id: typedBotId } : {}),
          ...(typedCountry ? { country: typedCountry } : {}),
          ...(typedCountryCode ? { country_code: typedCountryCode } : {}),
          ...(typedIp ? { ip: typedIp } : {}),
          ...(typedPort !== null ? { port: typedPort } : {}),
          ...(typedExpiresAt !== null ? { expires_at: typedExpiresAt } : {}),
          ...(typedDaysRemaining !== null ? { days_remaining: typedDaysRemaining } : {}),
          ...(typedIsExpiringSoon !== null ? { is_expiring_soon: typedIsExpiringSoon } : {}),
        } as Prisma.JsonValue,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
      };
    });
  }

  private async listTyped(tenantId: string, kind: string): Promise<Array<Record<string, unknown>>> {
    const table = this.resolveTypedTable(kind);
    if (!table) {
      return [];
    }

    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select
            id,
            type,
            status,
            bot_id as "botId",
            country,
            country_code as "countryCode",
            ip,
            port,
            expires_at as "expiresAt",
            days_remaining as "daysRemaining",
            is_expiring_soon as "isExpiringSoon",
            created_at as "createdAt",
            updated_at as "updatedAt"
          from ${Prisma.raw(`public.${table}`)}
          where tenant_id = ${tenantId}
          order by updated_at desc
        `),
      [],
    );
    return this.asTypedRows(rows);
  }

  private async findByIdTyped(
    tenantId: string,
    kind: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const table = this.resolveTypedTable(kind);
    if (!table) {
      return null;
    }

    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select
            id,
            type,
            status,
            bot_id as "botId",
            country,
            country_code as "countryCode",
            ip,
            port,
            expires_at as "expiresAt",
            days_remaining as "daysRemaining",
            is_expiring_soon as "isExpiringSoon",
            created_at as "createdAt",
            updated_at as "updatedAt"
          from ${Prisma.raw(`public.${table}`)}
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
      kind: string;
      id: string;
      payload: Prisma.InputJsonValue;
    },
    fallback: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const table = this.resolveTypedTable(input.kind);
    if (!table) {
      return fallback;
    }

    const typedColumns = this.resolveResourceTypedColumns(input.payload);
    const operation = async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into ${Prisma.raw(`public.${table}`)} (
            tenant_id,
            id,
            type,
            status,
            bot_id,
            country,
            country_code,
            ip,
            port,
            expires_at,
            days_remaining,
            is_expiring_soon,
            created_at,
            updated_at
          ) values (
            ${input.tenantId},
            ${input.id},
            ${typedColumns.type},
            ${typedColumns.status},
            ${typedColumns.botId},
            ${typedColumns.country},
            ${typedColumns.countryCode},
            ${typedColumns.ip},
            ${typedColumns.port},
            ${typedColumns.expiresAt},
            ${typedColumns.daysRemaining},
            ${typedColumns.isExpiringSoon},
            now(),
            now()
          )
          on conflict (tenant_id, id)
          do update set
            type = excluded.type,
            status = excluded.status,
            bot_id = excluded.bot_id,
            country = excluded.country,
            country_code = excluded.country_code,
            ip = excluded.ip,
            port = excluded.port,
            expires_at = excluded.expires_at,
            days_remaining = excluded.days_remaining,
            is_expiring_soon = excluded.is_expiring_soon,
            updated_at = now()
          returning
            id,
            type,
            status,
            bot_id as "botId",
            country,
            country_code as "countryCode",
            ip,
            port,
            expires_at as "expiresAt",
            days_remaining as "daysRemaining",
            is_expiring_soon as "isExpiringSoon",
            created_at as "createdAt",
            updated_at as "updatedAt"
        `);
      const mapped = this.asTypedRows(rows);
      return mapped[0] ?? fallback;
    };
    return operation();
  }

  private async deleteTyped(tenantId: string, kind: string, id: string): Promise<boolean> {
    const table = this.resolveTypedTable(kind);
    if (!table) {
      return false;
    }

    const operation = () =>
      this.prisma.$executeRaw<number>(Prisma.sql`
        delete from ${Prisma.raw(`public.${table}`)}
        where tenant_id = ${tenantId}
          and id = ${id}
      `);
    const count = await operation();

    return count > 0;
  }

  async list(tenantId: string, kind: string): Promise<Array<Record<string, unknown>>> {
    return this.listTyped(tenantId, kind);
  }

  async findById(
    tenantId: string,
    kind: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    return this.findByIdTyped(tenantId, kind, id);
  }

  async upsert(input: {
    tenantId: string;
    kind: string;
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.upsertTyped(input, {
      id: input.id,
      payload: input.payload,
    });
  }

  async delete(tenantId: string, kind: string, id: string): Promise<boolean> {
    return this.deleteTyped(tenantId, kind, id);
  }

  async deleteLinkedToBot(tenantId: string, botId: string): Promise<number> {
    const normalizedBotId = String(botId || '').trim();
    if (!normalizedBotId) {
      return 0;
    }

    const typedProxiesDeleted = await softFailMissingStorage(
      () =>
        this.prisma.$executeRaw<number>(Prisma.sql`
          delete from public.resources_proxies
          where tenant_id = ${tenantId}
            and bot_id = ${normalizedBotId}
        `),
      0,
    );

    const typedSubscriptionsDeleted = await softFailMissingStorage(
      () =>
        this.prisma.$executeRaw<number>(Prisma.sql`
          delete from public.resources_subscriptions
          where tenant_id = ${tenantId}
            and bot_id = ${normalizedBotId}
        `),
      0,
    );

    const typedLicensesDeleted = await softFailMissingStorage(
      () =>
        this.prisma.$executeRaw<number>(Prisma.sql`
          delete from public.resources_licenses
          where tenant_id = ${tenantId}
            and bot_id = ${normalizedBotId}
        `),
      0,
    );

    return typedProxiesDeleted + typedSubscriptionsDeleted + typedLicensesDeleted;
  }
}
