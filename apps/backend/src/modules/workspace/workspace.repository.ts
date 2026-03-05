import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class WorkspaceRepository {
  private readonly prisma: PrismaService;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
  }

  private resolveTypedTable(kind: string): string | null {
    if (kind === 'notes') return 'workspace_notes';
    if (kind === 'calendar') return 'workspace_calendar_events';
    if (kind === 'kanban') return 'workspace_kanban_tasks';
    return null;
  }

  private asObject(value: unknown): Record<string, unknown> {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      return value as Record<string, unknown>;
    }
    return {};
  }

  private readString(payload: Record<string, unknown>, key: string): string | null {
    const value = payload[key];
    if (typeof value === 'string') {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : null;
    }
    return null;
  }

  private readJsonValue(payload: Record<string, unknown>, key: string): Prisma.JsonValue {
    const value = payload[key];
    if (value === undefined) {
      return null;
    }
    return value as Prisma.JsonValue;
  }

  private buildTypedPayload(row: Record<string, unknown>): Record<string, unknown> {
    const payload = this.asObject(row.data);
    if (typeof row.kind === 'string' && row.kind.trim().length > 0) payload.kind = row.kind;
    if (typeof row.title === 'string') payload.title = row.title;
    if (typeof row.content === 'string') payload.content = row.content;
    if (typeof row.preview === 'string') payload.preview = row.preview;
    if (row.tags !== undefined && row.tags !== null) payload.tags = row.tags;
    if (row.blocks !== undefined && row.blocks !== null) payload.blocks = row.blocks;
    if (typeof row.status === 'string') payload.status = row.status;
    if (typeof row.priority === 'string') payload.priority = row.priority;
    if (row.start_at !== undefined && row.start_at !== null) payload.start_at = row.start_at;
    if (row.end_at !== undefined && row.end_at !== null) payload.end_at = row.end_at;
    if (row.due_at !== undefined && row.due_at !== null) payload.due_at = row.due_at;
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
            data,
            kind,
            title,
            content,
            preview,
            tags,
            blocks,
            status,
            priority,
            start_at,
            end_at,
            due_at,
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
            data,
            kind,
            title,
            content,
            preview,
            tags,
            blocks,
            status,
            priority,
            start_at,
            end_at,
            due_at,
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

    const payloadObject = this.asObject(input.payload);
    const payloadJson = JSON.stringify(input.payload ?? {});
    const typedKind = this.readString(payloadObject, 'kind') ?? input.kind;
    const typedTitle = this.readString(payloadObject, 'title');
    const typedContent = this.readString(payloadObject, 'content');
    const typedPreview = this.readString(payloadObject, 'preview');
    const typedTags = this.readJsonValue(payloadObject, 'tags');
    const typedBlocks = this.readJsonValue(payloadObject, 'blocks');
    const typedStatus = this.readString(payloadObject, 'status');
    const typedPriority = this.readString(payloadObject, 'priority');
    const typedStartAt = this.readString(payloadObject, 'start_at');
    const typedEndAt = this.readString(payloadObject, 'end_at');
    const typedDueAt = this.readString(payloadObject, 'due_at');

    const operation = async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into ${Prisma.raw(`public.${table}`)} (
            tenant_id,
            id,
            data,
            kind,
            title,
            content,
            preview,
            tags,
            blocks,
            status,
            priority,
            start_at,
            end_at,
            due_at,
            created_at,
            updated_at
          ) values (
            ${input.tenantId},
            ${input.id},
            ${payloadJson}::jsonb,
            ${typedKind},
            ${typedTitle},
            ${typedContent},
            ${typedPreview},
            ${JSON.stringify(typedTags)}::jsonb,
            ${JSON.stringify(typedBlocks)}::jsonb,
            ${typedStatus},
            ${typedPriority},
            ${typedStartAt}::timestamptz,
            ${typedEndAt}::timestamptz,
            ${typedDueAt}::timestamptz,
            now(),
            now()
          )
          on conflict (tenant_id, id)
          do update set
            data = excluded.data,
            kind = excluded.kind,
            title = excluded.title,
            content = excluded.content,
            preview = excluded.preview,
            tags = excluded.tags,
            blocks = excluded.blocks,
            status = excluded.status,
            priority = excluded.priority,
            start_at = excluded.start_at,
            end_at = excluded.end_at,
            due_at = excluded.due_at,
            updated_at = now()
          returning
            id,
            data,
            kind,
            title,
            content,
            preview,
            tags,
            blocks,
            status,
            priority,
            start_at,
            end_at,
            due_at,
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
    const typedFallback = {
      id: input.id,
      payload: input.payload,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    return this.upsertTyped(input, typedFallback);
  }

  async delete(tenantId: string, kind: string, id: string): Promise<boolean> {
    return this.deleteTyped(tenantId, kind, id);
  }
}
