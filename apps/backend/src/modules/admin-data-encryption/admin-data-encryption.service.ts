import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { DataAtRestCrypto } from '../common/data-at-rest-crypto';
import { PrismaService } from '../db/prisma.service';

type WorkspaceRow = {
  id: string;
  kind: string;
  payload: Prisma.JsonValue;
};

type RotateTenantSummary = {
  tenant_id: string;
  key_id: string;
  scope:
    | 'workspace'
    | 'finance'
    | 'settings'
    | 'resources'
    | 'playbooks'
    | 'bots'
    | 'artifacts'
    | 'theme'
    | 'license'
    | 'provisioning'
    | 'infra'
    | 'vmops';
  dry_run: boolean;
  requested: number;
  planned: number;
  rotated: number;
  skipped: number;
  failed: number;
};

@Injectable()
export class AdminDataEncryptionService {
  private readonly crypto = new DataAtRestCrypto();

  constructor(private readonly prisma: PrismaService) {}

  getActiveKeyId(): string {
    return this.crypto.getActiveKeyId();
  }

  async listWorkspaceTenantIds(limit = 1000): Promise<string[]> {
    const normalizedLimit = Number.isFinite(limit)
      ? Math.max(1, Math.min(10000, Math.trunc(limit)))
      : 1000;
    const rows = await this.prisma.withSystemContext(async () => {
      return this.prisma.$queryRaw<Array<{ tenant_id: string }>>`
        select distinct tenant_id
        from public.workspace_items
        where tenant_id is not null and tenant_id <> ''
        order by tenant_id asc
        limit ${normalizedLimit}
      `;
    });
    return rows
      .map((row) =>
        String(row.tenant_id || '')
          .trim()
          .toLowerCase(),
      )
      .filter(Boolean);
  }

  private async listWorkspaceRows(tenantId: string, limit: number): Promise<WorkspaceRow[]> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.workspaceItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          kind: true,
          payload: true,
        },
      });
      return rows as WorkspaceRow[];
    });
  }

  private async listFinanceRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.financeOperation.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
        },
      });
      return rows as Array<{ id: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listSettingsRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ path: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.settingsItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          path: true,
          payload: true,
        },
      });
      return rows as Array<{ path: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listResourceRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: string; kind: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.resourceItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          kind: true,
          payload: true,
        },
      });
      return rows as Array<{ id: string; kind: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listPlaybookRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.playbookItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
        },
      });
      return rows as Array<{ id: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listBotRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.botEntity.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
        },
      });
      return rows as Array<{ id: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listProvisioningProfileRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.provisioningProfileItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
        },
      });
      return rows as Array<{ id: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listArtifactReleaseRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: number; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.artifactReleaseItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
        },
      });
      return rows as Array<{ id: number; payload: Prisma.JsonValue }>;
    });
  }

  private async listArtifactAssignmentRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: number; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.artifactAssignmentItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
        },
      });
      return rows as Array<{ id: number; payload: Prisma.JsonValue }>;
    });
  }

  private async listThemeAssetRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.themeAssetItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
        },
      });
      return rows as Array<{ id: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listLicenseLeaseRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.licenseLeaseItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
        },
      });
      return rows as Array<{ id: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listProvisioningProgressRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.provisioningProgressItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
        },
      });
      return rows as Array<{ id: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listProvisioningTokenRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ token: string; payload: Prisma.JsonValue }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.provisioningTokenItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          token: true,
          payload: true,
        },
      });
      return rows as Array<{ token: string; payload: Prisma.JsonValue }>;
    });
  }

  private async listInfraVmConfigRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ vmid: string; content: string }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.infraVmConfigItem.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          vmid: true,
          content: true,
        },
      });
      return rows.map((row) => ({
        vmid: String(row.vmid || ''),
        content: String(row.content || ''),
      }));
    });
  }

  private async listVmOpsCommandRows(
    tenantId: string,
    limit: number,
  ): Promise<Array<{ id: string; payload: Prisma.JsonValue; result: Prisma.JsonValue | null }>> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      const rows = await tx.agentCommand.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: limit,
        select: {
          id: true,
          payload: true,
          result: true,
        },
      });
      return rows as Array<{
        id: string;
        payload: Prisma.JsonValue;
        result: Prisma.JsonValue | null;
      }>;
    });
  }

  private readWrappedEnvelope(payload: Prisma.JsonValue): unknown | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }
    const wrapped = (payload as Record<string, unknown>).__enc_payload_v1;
    return wrapped ?? null;
  }

  private readAnyEnvelope(payload: Prisma.JsonValue): unknown {
    const wrapped = this.readWrappedEnvelope(payload);
    return wrapped ?? payload;
  }

  async rotateWorkspaceTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listWorkspaceRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.workspaceItem.update({
              where: {
                tenantId_kind_id: {
                  tenantId,
                  kind: row.kind,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'workspace',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateFinanceTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listFinanceRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.financeOperation.update({
              where: {
                tenantId_id: {
                  tenantId,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'finance',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateSettingsTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listSettingsRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.settingsItem.update({
              where: {
                tenantId_path: {
                  tenantId,
                  path: row.path,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'settings',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateResourcesTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listResourceRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.resourceItem.update({
              where: {
                tenantId_kind_id: {
                  tenantId,
                  kind: row.kind,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'resources',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotatePlaybooksTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listPlaybookRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.playbookItem.update({
              where: {
                tenantId_id: {
                  tenantId,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'playbooks',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateBotsTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listBotRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.botEntity.update({
              where: {
                tenantId_id: {
                  tenantId,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'bots',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateThemeTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listThemeAssetRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.themeAssetItem.update({
              where: {
                tenantId_id: {
                  tenantId,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'theme',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateArtifactsTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const releaseRows = await this.listArtifactReleaseRows(tenantId, limit);
    const assignmentRows = await this.listArtifactAssignmentRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of releaseRows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.artifactReleaseItem.update({
              where: {
                tenantId_id: {
                  tenantId,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    for (const row of assignmentRows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.artifactAssignmentItem.update({
              where: {
                tenantId_id: {
                  tenantId,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'artifacts',
      dry_run: dryRun,
      requested: releaseRows.length + assignmentRows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateLicenseTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listLicenseLeaseRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.licenseLeaseItem.update({
              where: {
                tenantId_id: {
                  tenantId,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'license',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateProvisioningTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const profileRows = await this.listProvisioningProfileRows(tenantId, limit);
    const progressRows = await this.listProvisioningProgressRows(tenantId, limit);
    const tokenRows = await this.listProvisioningTokenRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of profileRows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.provisioningProfileItem.update({
              where: {
                tenantId_id: {
                  tenantId,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    for (const row of progressRows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.provisioningProgressItem.update({
              where: {
                tenantId_id: {
                  tenantId,
                  id: row.id,
                },
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    for (const row of tokenRows) {
      try {
        const wrapperEnvelope = this.readWrappedEnvelope(row.payload);
        const currentKid = wrapperEnvelope ? this.crypto.readEnvelopeKeyId(wrapperEnvelope) : null;
        if (wrapperEnvelope && currentKid === targetKeyId) {
          skipped += 1;
          continue;
        }

        const decryptedPayload = wrapperEnvelope
          ? this.crypto.decryptJson<Record<string, unknown>>(wrapperEnvelope)
          : null;
        const plaintextPayload =
          decryptedPayload && typeof decryptedPayload === 'object'
            ? decryptedPayload
            : (row.payload as Record<string, unknown>);
        planned += 1;

        if (!dryRun) {
          const nextPayload = {
            __enc_payload_v1: this.crypto.encryptJson(plaintextPayload),
          };
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.provisioningTokenItem.update({
              where: {
                token: row.token,
              },
              data: {
                payload: nextPayload as unknown as Prisma.InputJsonValue,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'provisioning',
      dry_run: dryRun,
      requested: profileRows.length + progressRows.length + tokenRows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateInfraTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listInfraVmConfigRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        let plaintextContent: string | null = null;
        try {
          const parsed = JSON.parse(row.content) as unknown;
          const currentKid = this.crypto.readEnvelopeKeyId(parsed);
          if (currentKid === targetKeyId) {
            skipped += 1;
            continue;
          }
          plaintextContent = this.crypto.decryptString(parsed);
        } catch {
          plaintextContent = row.content;
        }
        if (plaintextContent === null) {
          skipped += 1;
          continue;
        }
        planned += 1;

        if (!dryRun) {
          const nextContent = JSON.stringify(this.crypto.encryptString(plaintextContent));
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.infraVmConfigItem.update({
              where: {
                tenantId_vmid: {
                  tenantId,
                  vmid: row.vmid,
                },
              },
              data: {
                content: nextContent,
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'infra',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }

  async rotateVmOpsTenant(input: {
    tenantId: string;
    limit?: number;
    dryRun?: boolean;
  }): Promise<RotateTenantSummary> {
    const tenantId = String(input.tenantId || '')
      .trim()
      .toLowerCase();
    if (!tenantId) {
      throw new Error('tenant_id is required');
    }
    const limit = Number.isFinite(input.limit)
      ? Math.max(1, Math.min(10000, Math.trunc(input.limit || 1000)))
      : 1000;
    const dryRun = input.dryRun === true;
    const targetKeyId = this.crypto.getActiveKeyId();
    const rows = await this.listVmOpsCommandRows(tenantId, limit);

    let planned = 0;
    let rotated = 0;
    let skipped = 0;
    let failed = 0;

    for (const row of rows) {
      try {
        let rowChanged = false;
        let nextPayload: Prisma.InputJsonValue | undefined;
        let nextResult: Prisma.InputJsonValue | undefined;

        const payloadEnvelope = this.readAnyEnvelope(row.payload);
        const payloadKid = this.crypto.readEnvelopeKeyId(payloadEnvelope);
        if (payloadKid !== targetKeyId) {
          const decryptedPayload = this.crypto.decryptJson(payloadEnvelope);
          const payloadPlain = decryptedPayload === null ? row.payload : decryptedPayload;
          nextPayload = this.crypto.encryptJson(payloadPlain) as unknown as Prisma.InputJsonValue;
          rowChanged = true;
        }

        if (row.result !== null) {
          const resultEnvelope = this.readAnyEnvelope(row.result);
          const resultKid = this.crypto.readEnvelopeKeyId(resultEnvelope);
          if (resultKid !== targetKeyId) {
            const decryptedResult = this.crypto.decryptJson(resultEnvelope);
            const resultPlain = decryptedResult === null ? row.result : decryptedResult;
            nextResult = this.crypto.encryptJson(resultPlain) as unknown as Prisma.InputJsonValue;
            rowChanged = true;
          }
        }

        if (!rowChanged) {
          skipped += 1;
          continue;
        }

        planned += 1;
        if (!dryRun) {
          await this.prisma.withTenantContext(tenantId, async (tx) => {
            await tx.agentCommand.update({
              where: { id: row.id },
              data: {
                ...(nextPayload !== undefined ? { payload: nextPayload } : {}),
                ...(nextResult !== undefined ? { result: nextResult } : {}),
              },
            });
          });
          rotated += 1;
        }
      } catch {
        failed += 1;
      }
    }

    return {
      tenant_id: tenantId,
      key_id: targetKeyId,
      scope: 'vmops',
      dry_run: dryRun,
      requested: rows.length,
      planned,
      rotated,
      skipped,
      failed,
    };
  }
}
