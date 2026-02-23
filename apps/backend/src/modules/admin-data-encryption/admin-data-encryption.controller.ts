import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Optional,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AuthService } from '../auth/auth.service';
import { getRequestIdentity } from '../auth/request-identity.util';
import { AdminDataEncryptionService } from './admin-data-encryption.service';

const rotateWorkspaceTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateWorkspaceTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateFinanceTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateFinanceTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateSettingsTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateSettingsTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateResourcesTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateResourcesTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotatePlaybooksTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotatePlaybooksTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateBotsTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateBotsTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateProvisioningTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateProvisioningTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateInfraTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateInfraTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateVmOpsTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateVmOpsTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateArtifactsTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateArtifactsTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateThemeTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateThemeTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateLicenseTenantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

const rotateLicenseTenantsSchema = z.object({
  tenant_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(1000),
  key_id: z.string().trim().min(1).max(200).optional(),
  limit_per_tenant: z.coerce.number().int().min(1).max(10000).optional(),
  dry_run: z.boolean().optional(),
  reason: z.string().trim().max(200).optional(),
});

@Controller('admin/data-encryption')
export class AdminDataEncryptionController {
  constructor(
    private readonly service: AdminDataEncryptionService,
    private readonly authService: AuthService,
    @Optional() private readonly adminAuditService?: AdminAuditService,
  ) {}

  private requireAdmin(
    req: Request,
    authorization: string | undefined,
  ): { userId: string; tenantId: string } {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
    const identity = getRequestIdentity(req);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
    }
    const headers = (req.headers || {}) as Record<string, unknown>;
    const forwarded = headers['x-forwarded-for'];
    const fromForwarded = Array.isArray(forwarded)
      ? String(forwarded[0] || '')
          .split(',')[0]
          ?.trim()
      : String(forwarded || '')
          .split(',')[0]
          ?.trim();
    const clientIp = String(fromForwarded || req.ip || 'unknown')
      .trim()
      .toLowerCase();
    this.authService.enforceAdminRateLimit?.({
      action: `admin.data-encryption.${String(req.method || 'GET').toLowerCase()}:${String(req.path || '').toLowerCase()}`,
      clientIp,
      actorUserId: identity.userId,
      principal: identity.tenantId,
    });
    return { userId: identity.userId, tenantId: identity.tenantId };
  }

  private assertTargetKey(expectedKeyId: string | undefined): string {
    const targetKeyId = this.service.getActiveKeyId();
    if (expectedKeyId && expectedKeyId !== targetKeyId) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_KEY_MISMATCH',
        message: `Active content key_id is "${targetKeyId}". Set server env before running rotation.`,
      });
    }
    return targetKeyId;
  }

  @Post('rotate-workspace-tenant')
  async rotateWorkspaceTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateWorkspaceTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);

    const summary = await this.service.rotateWorkspaceTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_workspace_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-workspace-tenants')
  async rotateWorkspaceTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateWorkspaceTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);

    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateWorkspaceTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_workspace_tenants',
        payload: {
          key_id: targetKeyId,
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-finance-tenant')
  async rotateFinanceTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateFinanceTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateFinanceTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_finance_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'finance',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-finance-tenants')
  async rotateFinanceTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateFinanceTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateFinanceTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_finance_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'finance',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'finance',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-settings-tenant')
  async rotateSettingsTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateSettingsTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateSettingsTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_settings_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'settings',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-settings-tenants')
  async rotateSettingsTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateSettingsTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateSettingsTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_settings_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'settings',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'settings',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-resources-tenant')
  async rotateResourcesTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateResourcesTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateResourcesTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_resources_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'resources',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-resources-tenants')
  async rotateResourcesTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateResourcesTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateResourcesTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_resources_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'resources',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'resources',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-playbooks-tenant')
  async rotatePlaybooksTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotatePlaybooksTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotatePlaybooksTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_playbooks_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'playbooks',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-playbooks-tenants')
  async rotatePlaybooksTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotatePlaybooksTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotatePlaybooksTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_playbooks_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'playbooks',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'playbooks',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-bots-tenant')
  async rotateBotsTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateBotsTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateBotsTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_bots_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'bots',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-bots-tenants')
  async rotateBotsTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateBotsTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateBotsTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_bots_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'bots',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'bots',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-provisioning-tenant')
  async rotateProvisioningTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateProvisioningTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateProvisioningTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_provisioning_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'provisioning',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-provisioning-tenants')
  async rotateProvisioningTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateProvisioningTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateProvisioningTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_provisioning_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'provisioning',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'provisioning',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-infra-tenant')
  async rotateInfraTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateInfraTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateInfraTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_infra_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'infra',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-infra-tenants')
  async rotateInfraTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateInfraTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateInfraTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_infra_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'infra',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'infra',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-vmops-tenant')
  async rotateVmOpsTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateVmOpsTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateVmOpsTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_vmops_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'vmops',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-vmops-tenants')
  async rotateVmOpsTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateVmOpsTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateVmOpsTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_vmops_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'vmops',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'vmops',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-theme-tenant')
  async rotateThemeTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateThemeTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateThemeTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_theme_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'theme',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-theme-tenants')
  async rotateThemeTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateThemeTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateThemeTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_theme_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'theme',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'theme',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-license-tenant')
  async rotateLicenseTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateLicenseTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateLicenseTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_license_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'license',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-license-tenants')
  async rotateLicenseTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateLicenseTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateLicenseTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_license_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'license',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'license',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }

  @Post('rotate-artifacts-tenant')
  async rotateArtifactsTenant(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateArtifactsTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANT_INVALID_BODY',
        message: 'Invalid data encryption rotate tenant payload',
        details: parsed.error.flatten(),
      });
    }

    this.assertTargetKey(parsed.data.key_id);
    const summary = await this.service.rotateArtifactsTenant({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_artifacts_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: summary.key_id,
          scope: 'artifacts',
          dry_run: summary.dry_run,
          reason: parsed.data.reason ?? null,
          requested: summary.requested,
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        },
      });
    }

    return {
      success: true,
      data: summary,
    };
  }

  @Post('rotate-artifacts-tenants')
  async rotateArtifactsTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = rotateArtifactsTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY',
        message: 'Invalid data encryption rotate tenants payload',
        details: parsed.error.flatten(),
      });
    }

    const targetKeyId = this.assertTargetKey(parsed.data.key_id);
    const tenantIds = Array.from(
      new Set(
        parsed.data.tenant_ids
          .map((value) =>
            String(value || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean),
      ),
    );

    const results: Array<Record<string, unknown>> = [];
    for (const tenantId of tenantIds) {
      try {
        const summary = await this.service.rotateArtifactsTenant({
          tenantId,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          status: 'success',
          ...summary,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successful = results.filter((row) => row.status === 'success').length;
    const failed = results.length - successful;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.data_encryption.rotate_artifacts_tenants',
        payload: {
          key_id: targetKeyId,
          scope: 'artifacts',
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successful,
          failed_tenants: failed,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: targetKeyId,
        scope: 'artifacts',
        dry_run: parsed.data.dry_run === true,
        requested_tenants: tenantIds.length,
        successful_tenants: successful,
        failed_tenants: failed,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedTotal,
        results,
      },
    };
  }
}
