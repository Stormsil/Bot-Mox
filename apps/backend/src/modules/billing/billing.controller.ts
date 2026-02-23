import {
  BadRequestException,
  Body,
  Controller,
  ForbiddenException,
  Headers,
  InternalServerErrorException,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { isPrismaMissingStorageError } from '../common/prisma-soft-fail';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AuthService } from '../auth/auth.service';
import { getRequestIdentity } from '../auth/request-identity.util';

const activateMockPremiumSchema = z.object({
  lifetime: z.boolean().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
});
const adminMockPaymentSchema = z.object({
  tenant_id: z.string().trim().min(3).max(128),
  lifetime: z.boolean().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
  payment_ref: z.string().trim().min(1).max(200).optional(),
});

@Controller('billing')
export class BillingController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private getClientIp(req: Request): string {
    const headers = (req.headers || {}) as Record<string, unknown>;
    const forwarded = headers['x-forwarded-for'];
    const fromForwarded = Array.isArray(forwarded)
      ? String(forwarded[0] || '')
          .split(',')[0]
          ?.trim()
      : String(forwarded || '')
          .split(',')[0]
          ?.trim();
    const fromReq = String(req.ip || '').trim();
    return String(fromForwarded || fromReq || 'unknown')
      .trim()
      .toLowerCase();
  }

  private enforceAdminRateLimit(
    req: Request,
    action: string,
    actorUserId: string,
    principal?: string,
  ): void {
    this.authService.enforceAdminRateLimit?.({
      action,
      clientIp: this.getClientIp(req),
      actorUserId,
      ...(principal ? { principal } : {}),
    });
  }

  private ensureStubMode(): void {
    const billingMode = String(process.env.BILLING_MODE || 'stub')
      .trim()
      .toLowerCase();
    if (billingMode !== 'stub') {
      throw new BadRequestException({
        code: 'BILLING_MODE_NOT_STUB',
        message: 'Mock billing endpoint is available only when BILLING_MODE=stub',
      });
    }
  }

  private async logAuditBestEffort(input: Parameters<AdminAuditService['log']>[0]): Promise<void> {
    try {
      await this.adminAuditService.log(input);
    } catch (error) {
      if (isPrismaMissingStorageError(error)) {
        return;
      }
      throw new InternalServerErrorException({
        code: 'BILLING_AUDIT_LOG_FAILED',
        message: 'Billing action succeeded, but audit logging failed',
      });
    }
  }

  @Post('mock/activate')
  async activateMockPremium(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: { mode: 'stub'; tenant_id: string; access: unknown } }> {
    this.ensureAuthorization(authorization);
    this.ensureStubMode();

    const parsed = activateMockPremiumSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'BILLING_MOCK_ACTIVATE_INVALID_BODY',
        message: 'Invalid mock billing payload',
        details: parsed.error.flatten(),
      });
    }

    const identity = getRequestIdentity(req);
    const allowSelfActivate = String(process.env.BILLING_STUB_SELF_ACTIVATE || '')
      .trim()
      .toLowerCase();
    const selfActivateEnabled = ['1', 'true', 'yes', 'on'].includes(allowSelfActivate);
    const isAdmin = this.authService.isAdmin(identity.roles);
    if (!selfActivateEnabled && !isAdmin) {
      throw new ForbiddenException({
        code: 'BILLING_MOCK_SELF_ACTIVATE_DISABLED',
        message: 'Mock self-activation is disabled',
      });
    }
    if (isAdmin) {
      this.enforceAdminRateLimit(req, 'billing.mock.activate', identity.userId, identity.tenantId);
    }

    const access = await this.authService.grantPremium({
      tenantId: identity.tenantId,
      ...(parsed.data.lifetime !== undefined ? { lifetime: parsed.data.lifetime } : {}),
      ...(parsed.data.days !== undefined ? { days: parsed.data.days } : {}),
    });
    await this.logAuditBestEffort({
      actorUserId: identity.userId,
      actorTenantId: identity.tenantId,
      action: 'billing.mock.activate',
      targetTenantId: identity.tenantId,
      payload: {
        lifetime: parsed.data.lifetime ?? false,
        days: parsed.data.days ?? 30,
      },
    });

    return {
      success: true,
      data: {
        mode: 'stub',
        tenant_id: identity.tenantId,
        access,
      },
    };
  }

  @Post('trial/start')
  async startTrial(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: { tenant_id: string; access: unknown } }> {
    this.ensureAuthorization(authorization);

    const identity = getRequestIdentity(req);
    const access = await this.authService.startTrial({
      tenantId: identity.tenantId,
    });

    await this.logAuditBestEffort({
      actorUserId: identity.userId,
      actorTenantId: identity.tenantId,
      action: 'billing.trial.start',
      targetTenantId: identity.tenantId,
      payload: {},
    });

    return {
      success: true,
      data: {
        tenant_id: identity.tenantId,
        access,
      },
    };
  }

  @Post('admin/mock-payment')
  async adminMockPayment(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: { mode: 'stub'; tenant_id: string; access: unknown } }> {
    this.ensureAuthorization(authorization);
    this.ensureStubMode();

    const identity = getRequestIdentity(req);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new ForbiddenException({
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
    }

    const parsed = adminMockPaymentSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'BILLING_ADMIN_MOCK_PAYMENT_INVALID_BODY',
        message: 'Invalid admin mock payment payload',
        details: parsed.error.flatten(),
      });
    }
    this.enforceAdminRateLimit(
      req,
      'billing.admin.mock-payment',
      identity.userId,
      parsed.data.tenant_id,
    );

    const access = await this.authService.grantPremium({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.lifetime !== undefined ? { lifetime: parsed.data.lifetime } : {}),
      ...(parsed.data.days !== undefined ? { days: parsed.data.days } : {}),
    });
    await this.logAuditBestEffort({
      actorUserId: identity.userId,
      actorTenantId: identity.tenantId,
      action: 'billing.admin.mock_payment',
      targetTenantId: parsed.data.tenant_id,
      payload: {
        lifetime: parsed.data.lifetime ?? false,
        days: parsed.data.days ?? 30,
        payment_ref: parsed.data.payment_ref ?? null,
      },
    });

    return {
      success: true,
      data: {
        mode: 'stub',
        tenant_id: parsed.data.tenant_id,
        access,
      },
    };
  }
}
