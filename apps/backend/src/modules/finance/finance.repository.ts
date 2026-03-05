import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import {
  resolveTypedStoreMigrationMode,
  type TypedStoreMigrationMode,
} from '../common/typed-store-migration-mode';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class FinanceRepository {
  private readonly prisma: PrismaService;
  private readonly migrationMode: TypedStoreMigrationMode;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.migrationMode = resolveTypedStoreMigrationMode({
      env: process.env,
      readPrecedenceOverrideEnvName: 'BOTMOX_FINANCE_READ_PRECEDENCE',
      dualWriteOverrideEnvName: 'BOTMOX_FINANCE_DUAL_WRITE',
    });
  }

  private asTypedRows(rows: Array<Record<string, unknown>>): Array<Record<string, unknown>> {
    return rows.map((row) => ({
      id: row.id,
      payload: (row.data as Prisma.JsonValue) ?? {},
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    }));
  }

  private async listLegacy(tenantId: string): Promise<Array<Record<string, unknown>>> {
    return softFailMissingStorageRead(
      () =>
        this.prisma.withTenantContext(tenantId, async (tx) => {
          return this.getFinanceClient(tx).findMany({
            where: { tenantId },
            orderBy: { updatedAt: 'desc' },
          });
        }),
      [],
    );
  }

  private async listTyped(tenantId: string): Promise<Array<Record<string, unknown>>> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select id, data, created_at as "createdAt", updated_at as "updatedAt"
          from public.finance_operations
          where tenant_id = ${tenantId}
          order by updated_at desc
        `),
      [],
    );
    return this.asTypedRows(rows);
  }

  private async findByIdLegacy(
    tenantId: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    return softFailMissingStorageRead(
      () =>
        this.prisma.withTenantContext(tenantId, async (tx) => {
          return this.getFinanceClient(tx).findFirst({
            where: {
              tenantId,
              id,
            },
          });
        }),
      null,
    );
  }

  private async findByIdTyped(
    tenantId: string,
    id: string,
  ): Promise<Record<string, unknown> | null> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select id, data, created_at as "createdAt", updated_at as "updatedAt"
          from public.finance_operations
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
    id: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      return this.getFinanceClient(tx).upsert({
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
    });
  }

  private async upsertTyped(
    input: {
      tenantId: string;
      id: string;
      payload: Prisma.InputJsonValue;
    },
    fallback: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    const payloadJson = JSON.stringify(input.payload ?? {});
    return softFailMissingStorage(async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into public.finance_operations (
            tenant_id,
            id,
            data,
            payload,
            created_at,
            updated_at
          ) values (
            ${input.tenantId},
            ${input.id},
            ${payloadJson}::jsonb,
            ${payloadJson}::jsonb,
            now(),
            now()
          )
          on conflict (tenant_id, id)
          do update set
            data = excluded.data,
            payload = excluded.payload,
            updated_at = now()
          returning id, data, created_at as "createdAt", updated_at as "updatedAt"
        `);
      const mapped = this.asTypedRows(rows);
      return mapped[0] ?? fallback;
    }, fallback);
  }

  private async deleteLegacy(tenantId: string, id: string): Promise<boolean> {
    const result = await this.prisma.withTenantContext(tenantId, async (tx) => {
      return this.getFinanceClient(tx).deleteMany({
        where: {
          tenantId,
          id,
        },
      });
    });
    return result.count > 0;
  }

  private async deleteTyped(tenantId: string, id: string): Promise<boolean> {
    const count = await softFailMissingStorage(
      () =>
        this.prisma.$executeRaw<number>(Prisma.sql`
          delete from public.finance_operations
          where tenant_id = ${tenantId}
            and id = ${id}
        `),
      0,
    );
    return count > 0;
  }

  private getFinanceClient(source: PrismaClient | Prisma.TransactionClient): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    deleteMany: (args: unknown) => Promise<{ count: number }>;
  } {
    return (source as unknown as { financeOperation: unknown }).financeOperation as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      deleteMany: (args: unknown) => Promise<{ count: number }>;
    };
  }

  async list(tenantId: string): Promise<Array<Record<string, unknown>>> {
    if (this.migrationMode.readPrecedence === 'typed-first') {
      const typedRows = await this.listTyped(tenantId);
      if (typedRows.length > 0) {
        return typedRows;
      }
      return this.listLegacy(tenantId);
    }

    const legacyRows = await this.listLegacy(tenantId);
    if (legacyRows.length > 0) {
      return legacyRows;
    }
    return this.listTyped(tenantId);
  }

  async findById(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    if (this.migrationMode.readPrecedence === 'typed-first') {
      const typedRow = await this.findByIdTyped(tenantId, id);
      if (typedRow) {
        return typedRow;
      }
      return this.findByIdLegacy(tenantId, id);
    }

    const legacyRow = await this.findByIdLegacy(tenantId, id);
    if (legacyRow) {
      return legacyRow;
    }
    return this.findByIdTyped(tenantId, id);
  }

  async upsert(input: {
    tenantId: string;
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

  async delete(tenantId: string, id: string): Promise<boolean> {
    const legacyDeleted = await this.deleteLegacy(tenantId, id);
    if (!this.migrationMode.dualWriteEnabled) {
      return legacyDeleted;
    }

    const typedDeleted = await this.deleteTyped(tenantId, id);
    return legacyDeleted || typedDeleted;
  }
}
