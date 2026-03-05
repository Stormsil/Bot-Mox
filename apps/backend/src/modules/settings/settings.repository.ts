import { Injectable } from '@nestjs/common';
import { Prisma, type PrismaClient } from '@prisma/client';
import { softFailMissingStorage, softFailMissingStorageRead } from '../common/prisma-soft-fail';
import {
  resolveTypedStoreMigrationMode,
  type TypedStoreMigrationMode,
} from '../common/typed-store-migration-mode';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class SettingsRepository {
  private readonly prisma: PrismaService;
  private readonly migrationMode: TypedStoreMigrationMode;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.migrationMode = resolveTypedStoreMigrationMode({
      env: process.env,
      readPrecedenceOverrideEnvName: 'BOTMOX_SETTINGS_READ_PRECEDENCE',
      dualWriteOverrideEnvName: 'BOTMOX_SETTINGS_DUAL_WRITE',
    });
  }

  private toTypedRow(payload: Prisma.JsonValue): Record<string, unknown> {
    return { payload: payload as unknown as Record<string, unknown> };
  }

  private async findByPathLegacy(
    tenantId: string,
    path: string,
  ): Promise<Record<string, unknown> | null> {
    return softFailMissingStorageRead(
      () =>
        this.prisma.withTenantContext(tenantId, async (tx) => {
          return this.getSettingsItemClient(tx).findFirst({
            where: { tenantId, path },
          });
        }),
      null,
    );
  }

  private async findByPathTyped(
    tenantId: string,
    path: string,
  ): Promise<Record<string, unknown> | null> {
    const rows = await softFailMissingStorageRead(
      () =>
        this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          select data -> ${path} as payload
          from public.app_settings
          where tenant_id = ${tenantId}
          limit 1
        `),
      [],
    );
    const payload = rows[0]?.payload as Prisma.JsonValue | undefined;
    if (payload === undefined || payload === null) {
      return null;
    }
    return this.toTypedRow(payload);
  }

  private async upsertLegacy(input: {
    tenantId: string;
    path: string;
    payload: Prisma.InputJsonValue;
  }): Promise<Record<string, unknown>> {
    const fallback = {
      tenantId: input.tenantId,
      path: input.path,
      payload: input.payload,
    };
    return softFailMissingStorage(
      () =>
        this.prisma.withTenantContext(input.tenantId, async (tx) => {
          return this.getSettingsItemClient(tx).upsert({
            where: {
              tenantId_path: {
                tenantId: input.tenantId,
                path: input.path,
              },
            },
            create: {
              tenantId: input.tenantId,
              path: input.path,
              payload: input.payload,
            },
            update: {
              tenantId: input.tenantId,
              path: input.path,
              payload: input.payload,
            },
          });
        }),
      fallback,
    );
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
    return softFailMissingStorage(async () => {
      const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>(Prisma.sql`
          insert into public.app_settings (
            tenant_id,
            data,
            updated_at
          ) values (
            ${input.tenantId},
            jsonb_build_object(${input.path}, ${payloadJson}::jsonb),
            now()
          )
          on conflict (tenant_id)
          do update set
            data = coalesce(public.app_settings.data, '{}'::jsonb) ||
              jsonb_build_object(${input.path}, ${payloadJson}::jsonb),
            updated_at = now()
          returning data -> ${input.path} as payload
        `);
      const payload = rows[0]?.payload as Prisma.JsonValue | undefined;
      if (payload === undefined || payload === null) {
        return fallback;
      }
      return this.toTypedRow(payload);
    }, fallback);
  }

  private getSettingsItemClient(source: PrismaClient | Prisma.TransactionClient): {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (source as unknown as { settingsItem: unknown }).settingsItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async findByPath(tenantId: string, path: string): Promise<Record<string, unknown> | null> {
    if (this.migrationMode.readPrecedence === 'typed-first') {
      const typedRow = await this.findByPathTyped(tenantId, path);
      if (typedRow) {
        return typedRow;
      }
      return this.findByPathLegacy(tenantId, path);
    }

    const legacyRow = await this.findByPathLegacy(tenantId, path);
    if (legacyRow) {
      return legacyRow;
    }
    return this.findByPathTyped(tenantId, path);
  }

  async upsert(input: {
    tenantId: string;
    path: string;
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
}
