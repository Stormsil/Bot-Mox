import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class PlaybooksRepository {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private readString(payload: Record<string, unknown>, key: string): string | null {
    const value = payload[key];
    if (typeof value !== 'string') {
      return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }

  private readBoolean(payload: Record<string, unknown>, key: string): boolean | null {
    const value = payload[key];
    return typeof value === 'boolean' ? value : null;
  }

  private buildTypedPayload(row: Record<string, unknown>): Record<string, unknown> {
    const payload = this.asObject(row.data);
    if (typeof row.name === 'string') payload.name = row.name;
    if (typeof row.content === 'string') payload.content = row.content;
    if (typeof row.is_default === 'boolean') payload.is_default = row.is_default;
    if (typeof row.status === 'string') payload.status = row.status;
    if (typeof row.version === 'string') payload.version = row.version;
    return payload;
  }

  private asTypedRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.map((row) => ({
      id: row.id,
      payload: this.buildTypedPayload(row),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  private async listTyped(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select
            id,
            data,
            name,
            content,
            is_default,
            status,
            version,
            created_at as "createdAt",
            updated_at as "updatedAt"
          from public.playbooks
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
            data,
            name,
            content,
            is_default,
            status,
            version,
            created_at as "createdAt",
            updated_at as "updatedAt"
          from public.playbooks
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
    const payloadObject = this.asObject(input.payload);
    const payloadJson = JSON.stringify(input.payload ?? {});
    const typedName = this.readString(payloadObject, 'name');
    const typedContent = this.readString(payloadObject, 'content');
    const typedIsDefault = this.readBoolean(payloadObject, 'is_default');
    const typedStatus = this.readString(payloadObject, 'status');
    const typedVersion = this.readString(payloadObject, 'version');

    const operation = async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into public.playbooks (
            tenant_id,
            id,
            data,
            name,
            content,
            is_default,
            status,
            version,
            created_at,
            updated_at
          ) values (
            ${input.tenantId},
            ${input.id},
            ${payloadJson}::jsonb,
            ${typedName},
            ${typedContent},
            ${typedIsDefault},
            ${typedStatus},
            ${typedVersion},
            now(),
            now()
          )
          on conflict (tenant_id, id)
          do update set
            data = excluded.data,
            name = excluded.name,
            content = excluded.content,
            is_default = excluded.is_default,
            status = excluded.status,
            version = excluded.version,
            updated_at = now()
          returning
            id,
            data,
            name,
            content,
            is_default,
            status,
            version,
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
        delete from public.playbooks
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
    const typedFallback = {
      id: input.id,
      payload: input.payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.upsertTyped(input, typedFallback);
  }

  async delete(tenantId: string, id: string): Promise<boolean> {
    return this.deleteTyped(tenantId, id);
  }
}
