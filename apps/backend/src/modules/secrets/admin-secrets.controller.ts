import {
  adminSecretRotateTenantSchema,
  adminSecretRotateTenantsSchema,
} from '@botmox/api-contract';
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
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AuthService } from '../auth/auth.service';
import { getRequestIdentity } from '../auth/request-identity.util';
import { SecretsService } from './secrets.service';

@Controller('admin/secrets')
export class AdminSecretsController {
  constructor(
    private readonly secretsService: SecretsService,
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
      action: `admin.secrets.${String(req.method || 'GET').toLowerCase()}:${String(req.path || '').toLowerCase()}`,
      clientIp,
      actorUserId: identity.userId,
      principal: identity.tenantId,
    });

    return { userId: identity.userId, tenantId: identity.tenantId };
  }

  @Post('rotate-tenant')
  async rotateTenantSecrets(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = adminSecretRotateTenantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_SECRETS_ROTATE_INVALID_BODY',
        message: 'Invalid tenant secret rotate payload',
        details: parsed.error.flatten(),
      });
    }

    const summary = await this.secretsService.rotateTenantSecrets({
      tenantId: parsed.data.tenant_id,
      keyId: parsed.data.key_id,
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
    });

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.secrets.rotate_tenant',
        targetTenantId: parsed.data.tenant_id,
        payload: {
          key_id: parsed.data.key_id,
          dry_run: parsed.data.dry_run === true,
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

  @Post('rotate-tenants')
  async rotateManyTenants(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = adminSecretRotateTenantsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_SECRETS_ROTATE_MANY_INVALID_BODY',
        message: 'Invalid tenant batch secret rotate payload',
        details: parsed.error.flatten(),
      });
    }

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

    const results: Array<{
      tenant_id: string;
      status: 'success' | 'failed';
      planned?: number;
      rotated?: number;
      skipped?: number;
      failed?: number;
      error?: string;
    }> = [];

    for (const tenantId of tenantIds) {
      try {
        const summary = await this.secretsService.rotateTenantSecrets({
          tenantId,
          keyId: parsed.data.key_id,
          ...(parsed.data.limit_per_tenant !== undefined
            ? { limit: parsed.data.limit_per_tenant }
            : {}),
          ...(parsed.data.dry_run === true ? { dryRun: true } : {}),
        });
        results.push({
          tenant_id: tenantId,
          status: 'success',
          planned: summary.planned,
          rotated: summary.rotated,
          skipped: summary.skipped,
          failed: summary.failed,
        });
      } catch (error) {
        results.push({
          tenant_id: tenantId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'unknown_error',
        });
      }
    }

    const successCount = results.filter((row) => row.status === 'success').length;
    const failedCount = results.length - successCount;
    const plannedTotal = results.reduce((acc, row) => acc + Number(row.planned ?? 0), 0);
    const rotatedTotal = results.reduce((acc, row) => acc + Number(row.rotated ?? 0), 0);
    const skippedTotal = results.reduce((acc, row) => acc + Number(row.skipped ?? 0), 0);
    const failedSecretsTotal = results.reduce((acc, row) => acc + Number(row.failed ?? 0), 0);

    if (this.adminAuditService) {
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        actorTenantId: actor.tenantId,
        action: 'admin.secrets.rotate_tenants',
        payload: {
          key_id: parsed.data.key_id,
          dry_run: parsed.data.dry_run === true,
          reason: parsed.data.reason ?? null,
          requested_tenants: tenantIds.length,
          successful_tenants: successCount,
          failed_tenants: failedCount,
          planned_total: plannedTotal,
          rotated_total: rotatedTotal,
          skipped_total: skippedTotal,
          failed_total: failedSecretsTotal,
        },
      });
    }

    return {
      success: true,
      data: {
        key_id: parsed.data.key_id,
        requested_tenants: tenantIds.length,
        successful_tenants: successCount,
        failed_tenants: failedCount,
        dry_run: parsed.data.dry_run === true,
        planned_total: plannedTotal,
        rotated_total: rotatedTotal,
        skipped_total: skippedTotal,
        failed_total: failedSecretsTotal,
        results,
      },
    };
  }
}
