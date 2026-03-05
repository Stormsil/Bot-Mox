import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import {
  resolveTypedStoreMigrationMode,
  type TypedStoreMigrationMode,
} from '../common/typed-store-migration-mode';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class WorkspaceRepository {
  private readonly prisma: PrismaService;
  private readonly migrationMode: TypedStoreMigrationMode;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.migrationMode = resolveTypedStoreMigrationMode({
      env: process.env,
      readPrecedenceOverrideEnvName: 'BOTMOX_WORKSPACE_READ_PRECEDENCE',
      dualWriteOverrideEnvName: 'BOTMOX_WORKSPACE_DUAL_WRITE',
    });
  }

  private resolveTypedTable(kind: string): string | null {
    if (kind === 'notes') return 'workspace_notes';
    if (kind === 'calendar') return 'workspace_calendar_events';
    if (kind === 'kanban') return 'workspace_kanban_tasks';
    return null;
  }

  private asTypedRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.map((row) => ({
      id: row.id,
      payload: (row.data as Prisma.JsonValue) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  private async listLegacy(
    tenantId: string,
    kind: string,
  ): Promise<Array<Record<string, unknown>>> {
    return softFailMissingStorageRead(
      () =>
        this.prisma.withTenantContext(tenantId, async (tx) => {
          return this.getWorkspaceItemClient(tx).findMany({
            where: { tenantId, kind },
            orderBy: { updatedAt: 'desc' },
          });
        }),
      [],
    );
  }

  private async listTyped(tenantId: string, kind: string): Promise<Array<Record<string, unknown>>> {
    const table = this.resolveTypedTable(kind);
    if (!table) {
      return [];
    }

    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select id, data, created_at as "createdAt", updated_at as "updatedAt"
          from ${Prisma.raw(`public.${table}`)}
          where tenant_id = ${tenantId}
          order by updated_at desc
        `),
      [],
    );

    return this.asTypedRows(rows);
  }

  private async findByIdLegacy(
    tenantId: string,
    kind: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    return softFailMissingStorageRead(
      () =>
        this.prisma.withTenantContext(tenantId, async (tx) => {
          return this.getWorkspaceItemClient(tx).findFirst({
            where: { tenantId, kind, id },
          });
        }),
      null,
    );
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
          select id, data, created_at as "createdAt", updated_at as "updatedAt"
          from ${Prisma.raw(`public.${table}`)}
          where tenant_id = ${tenantId}
            and id = ${id}
          limit 1
        `),
      [],
    );

    return rows[0] ? (this.asTypedRows(rows)[0] ?? null) : null;
  }

  private async upsertLegacy(input: {
    tenantId: string;
    kind: string;
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      return this.getWorkspaceItemClient(tx).upsert({
        where: {
          tenantId_kind_id: {
            tenantId: input.tenantId,
            kind: input.kind,
            id: input.id,
          },
        },
        create: {
          id: input.id,
          tenantId: input.tenantId,
          kind: input.kind,
          payload: input.payload,
        },
        update: {
          tenantId: input.tenantId,
          kind: input.kind,
          payload: input.payload,
        },
      });
    });
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

    const payloadJson = JSON.stringify(input.payload ?? {});
    return softFailMissingStorage(async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into ${Prisma.raw(`public.${table}`)} (
            tenant_id,
            id,
            data,
            created_at,
            updated_at
          ) values (
            ${input.tenantId},
            ${input.id},
            ${payloadJson}::jsonb,
            now(),
            now()
          )
          on conflict (tenant_id, id)
          do update set
            data = excluded.data,
            updated_at = now()
          returning id, data, created_at as "createdAt", updated_at as "updatedAt"
        `);
      const mapped = this.asTypedRows(rows);
      return mapped[0] ?? fallback;
    }, fallback);
  }

  private async deleteLegacy(tenantId: string, kind: string, id: string): Promise<boolean> {
    const result = await this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getWorkspaceItemClient(tx).deleteMany({
        where: { tenantId, kind, id },
      });
    });
    return result.count > 0;
  }

  private async deleteTyped(tenantId: string, kind: string, id: string): Promise<boolean> {
    const table = this.resolveTypedTable(kind);
    if (!table) {
      return false;
    }

    const count = await softFailMissingStorage(
      () =>
        this.prisma.$executeRaw<number>(Prisma.sql`
          delete from ${Prisma.raw(`public.${table}`)}
          where tenant_id = ${tenantId}
            and id = ${id}
        `),
      0,
    );
    return count > 0;
  }

  private getWorkspaceItemClient(source: PrismaClient | Prisma.TransactionClient): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  } {
    return (source as unknown as { workspaceItem: unknown }).workspaceItem as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }

  async list(tenantId: string, kind: string): Promise<Array<Record<string, unknown>>> {
    if (this.migrationMode.readPrecedence === 'typed-first') {
      const typedRows = await this.listTyped(tenantId, kind);
      if (typedRows.length > 0) {
        return typedRows;
      }
      return this.listLegacy(tenantId, kind);
    }

    const legacyRows = await this.listLegacy(tenantId, kind);
    if (legacyRows.length > 0) {
      return legacyRows;
    }
    return this.listTyped(tenantId, kind);
  }

  async findById(
    tenantId: string,
    kind: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    if (this.migrationMode.readPrecedence === 'typed-first') {
      const typedRow = await this.findByIdTyped(tenantId, kind, id);
      if (typedRow) {
        return typedRow;
      }
      return this.findByIdLegacy(tenantId, kind, id);
    }

    const legacyRow = await this.findByIdLegacy(tenantId, kind, id);
    if (legacyRow) {
      return legacyRow;
    }
    return this.findByIdTyped(tenantId, kind, id);
  }

  async upsert(input: {
    tenantId: string;
    kind: string;
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    const legacyRow = await this.upsertLegacy(input);
    if (!this.migrationMode.dualWriteEnabled) {
      return legacyRow;
    }

    if (this.migrationMode.readPrecedence === 'typed-first') {
      return this.upsertTyped(input, legacyRow);
    }

    await this.upsertTyped(input, legacyRow);
    return legacyRow;
  }

  async delete(tenantId: string, kind: string, id: string): Promise<boolean> {
    const legacyDeleted = await this.deleteLegacy(tenantId, kind, id);
    if (!this.migrationMode.dualWriteEnabled) {
      return legacyDeleted;
    }

    const typedDeleted = await this.deleteTyped(tenantId, kind, id);
    return legacyDeleted || typedDeleted;
  }
}
