import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class ThemeAssetsRepository {
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

  private readNumber(payload: Record<string, unknown>, key: string): number | null {
    const value = payload[key];
    if (typeof value === 'number' && Number.isFinite(value)) {
      return value;
    }
    return null;
  }

  private buildTypedPayload(row: Record<string, unknown>): Record<string, unknown> {
    const payload = this.asObject(row.data);
    if (typeof row.object_key === 'string') payload.object_key = row.object_key;
    if (typeof row.mime_type === 'string') payload.mime_type = row.mime_type;
    if (typeof row.size_bytes === 'number') payload.size_bytes = row.size_bytes;
    if (typeof row.width === 'number' || row.width === null) payload.width = row.width;
    if (typeof row.height === 'number' || row.height === null) payload.height = row.height;
    if (typeof row.status === 'string') payload.status = row.status;
    if (typeof row.image_url === 'string' || row.image_url === null)
      payload.image_url = row.image_url;
    if (typeof row.image_url_expires_at_ms === 'number' || row.image_url_expires_at_ms === null) {
      payload.image_url_expires_at_ms = row.image_url_expires_at_ms;
    }
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
            object_key,
            mime_type,
            size_bytes,
            width,
            height,
            status,
            image_url,
            image_url_expires_at_ms,
            created_at as "createdAt",
            updated_at as "updatedAt"
          from public.theme_background_assets
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
            object_key,
            mime_type,
            size_bytes,
            width,
            height,
            status,
            image_url,
            image_url_expires_at_ms,
            created_at as "createdAt",
            updated_at as "updatedAt"
          from public.theme_background_assets
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
    const typedObjectKey = this.readString(payloadObject, 'object_key');
    const typedMimeType = this.readString(payloadObject, 'mime_type');
    const typedSizeBytes = this.readNumber(payloadObject, 'size_bytes');
    const typedWidth = this.readNumber(payloadObject, 'width');
    const typedHeight = this.readNumber(payloadObject, 'height');
    const typedStatus = this.readString(payloadObject, 'status');
    const typedImageUrl = this.readString(payloadObject, 'image_url');
    const typedImageUrlExpiresAtMs = this.readNumber(payloadObject, 'image_url_expires_at_ms');

    const operation = async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into public.theme_background_assets (
            tenant_id,
            id,
            data,
            object_key,
            mime_type,
            size_bytes,
            width,
            height,
            status,
            image_url,
            image_url_expires_at_ms,
            created_at,
            updated_at
          ) values (
            ${input.tenantId},
            ${input.id},
            ${payloadJson}::jsonb,
            ${typedObjectKey},
            ${typedMimeType},
            ${typedSizeBytes},
            ${typedWidth},
            ${typedHeight},
            ${typedStatus},
            ${typedImageUrl},
            ${typedImageUrlExpiresAtMs},
            now(),
            now()
          )
          on conflict (tenant_id, id)
          do update set
            data = excluded.data,
            object_key = excluded.object_key,
            mime_type = excluded.mime_type,
            size_bytes = excluded.size_bytes,
            width = excluded.width,
            height = excluded.height,
            status = excluded.status,
            image_url = excluded.image_url,
            image_url_expires_at_ms = excluded.image_url_expires_at_ms,
            updated_at = now()
          returning
            id,
            data,
            object_key,
            mime_type,
            size_bytes,
            width,
            height,
            status,
            image_url,
            image_url_expires_at_ms,
            created_at as "createdAt",
            updated_at as "updatedAt"
        `);
      const mapped = this.asTypedRows(rows);
      return mapped[0] ?? fallback;
    };
    return operation();
  }

  async listByTenant(tenantId: string): Promise<Record<string, unknown>[]> {
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
}
