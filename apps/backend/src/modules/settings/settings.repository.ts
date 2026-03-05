import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class SettingsRepository {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private resolveNamespace(path: string): string {
    const normalized = String(path || '').trim();
    if (!normalized) {
      return 'root';
    }
    const [head] = normalized.split('/');
    const candidate = String(head || '').trim();
    return candidate || 'root';
  }

  private resolveValueType(value: Prisma.InputJsonValue): string {
    if (Array.isArray(value)) {
      return 'array';
    }
    if (value === null) {
      return 'null';
    }
    const kind = typeof value;
    if (kind === 'string' || kind === 'number' || kind === 'boolean') {
      return kind;
    }
    return 'object';
  }

  private buildTypedPathPayload(
    row: Record<string, unknown>,
    path: string,
  ): Prisma.JsonValue | null {
    const rowPath = typeof row.path === 'string' ? row.path : null;
    const rowValue = row.value as Prisma.JsonValue | undefined;
    if (rowPath === path && rowValue !== undefined && rowValue !== null) {
      return rowValue;
    }
    return null;
  }

  private toTypedRow(payload: Prisma.JsonValue): Record<string, unknown> {
    return { payload: payload as unknown as Record<string, unknown> };
  }

  private async findByPathTyped(
    tenantId: string,
    path: string,
  ): Promise<Record<string, unknown> | null> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select path, value, namespace, value_type
          from public.app_settings
          where tenant_id = ${tenantId}
            and path = ${path}
          limit 1
        `),
      [],
    );

    const payload = rows[0] ? this.buildTypedPathPayload(rows[0], path) : null;
    if (payload === undefined || payload === null) {
      return null;
    }
    return this.toTypedRow(payload);
  }

  private async upsertTyped(
    input: {
      tenantId: string;
      path: string;
      payload: Prisma.InputJsonValue;
    },
    fallback: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const payloadJson = JSON.stringify(input.payload ?? {});
    const namespace = this.resolveNamespace(input.path);
    const valueType = this.resolveValueType(input.payload);
    const operation = async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into public.app_settings (
            tenant_id,
            path,
            value,
            namespace,
            value_type,
            updated_at
          ) values (
            ${input.tenantId},
            ${input.path},
            ${payloadJson}::jsonb,
            ${namespace},
            ${valueType},
            now()
          )
          on conflict (tenant_id, path)
          do update set
            path = excluded.path,
            value = excluded.value,
            namespace = excluded.namespace,
            value_type = excluded.value_type,
            updated_at = now()
          returning path, value, namespace, value_type
        `);

      const payload = rows[0] ? this.buildTypedPathPayload(rows[0], input.path) : null;
      if (payload === undefined || payload === null) {
        return fallback;
      }
      return this.toTypedRow(payload);
    };
    return operation();
  }

  async findByPath(tenantId: string, path: string): Promise<Record<string, unknown> | null> {
    return this.findByPathTyped(tenantId, path);
  }

  async upsert(input: {
    tenantId: string;
    path: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    const typedFallback = {
      tenantId: input.tenantId,
      path: input.path,
      payload: input.payload,
    };
    return this.upsertTyped(input, typedFallback);
  }
}
