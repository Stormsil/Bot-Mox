import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AuthService } from '../auth/auth.service';
import { getRequestIdentity } from '../auth/request-identity.util';
import { AdminAccessService } from './admin-access.service';

const listQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  q: z.string().trim().max(200).optional(),
});

const grantSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
  lifetime: z.boolean().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
});

const revokeSchema = z.object({
  tenant_id: z.string().trim().min(1).max(200),
});

const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  action: z.string().trim().min(1).max(200).optional(),
  tenant_id: z.string().trim().min(1).max(200).optional(),
  actor_user_id: z.string().trim().min(1).max(200).optional(),
});

const bulkUsersSchema = z.object({
  action: z.enum(['grant_premium_30d', 'revoke_premium', 'disable', 'enable', 'force_logout']),
  user_ids: z.array(z.string().trim().min(1).max(200)).min(1).max(500),
});

@Controller('admin/access')
export class AdminAccessController {
  constructor(
    private readonly adminAccessService: AdminAccessService,
    private readonly authService: AuthService,
    private readonly adminAuditService: AdminAuditService,
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
      action: `admin.access.${String(req.method || 'GET').toLowerCase()}:${String(req.path || '').toLowerCase()}`,
      clientIp,
      actorUserId: identity.userId,
      principal: identity.tenantId,
    });

    return { userId: identity.userId, tenantId: identity.tenantId };
  }

  @Get('tenants')
  async listTenants(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.requireAdmin(req, authorization);

    const parsed = listQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_ACCESS_LIST_INVALID_QUERY',
        message: 'Invalid admin access list query',
        details: parsed.error.flatten(),
      });
    }

    return {
      success: true,
      data: await this.adminAccessService.listTenants({
        ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
        ...(parsed.data.q !== undefined ? { query: parsed.data.q } : {}),
      }),
    };
  }

  @Get('users')
  async listUsers(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.requireAdmin(req, authorization);

    const parsed = listQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_ACCESS_USERS_INVALID_QUERY',
        message: 'Invalid admin users list query',
        details: parsed.error.flatten(),
      });
    }

    const users = await this.authService.listUsers({
      ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
      ...(parsed.data.q !== undefined ? { query: parsed.data.q } : {}),
    });
    const tenantAccessMap = await this.adminAccessService.getTenantAccessMap(
      users.map((user) => user.tenantId || ''),
    );

    return {
      success: true,
      data: users.map((user) => ({
        id: user.id,
        email: user.email,
        tenant_id: user.tenantId,
        roles: user.roles,
        created_at: user.createdAt,
        last_sign_in_at: user.lastSignInAt,
        banned_until: user.bannedUntil,
        disabled: user.disabled,
        access: user.tenantId ? (tenantAccessMap.get(user.tenantId) ?? null) : null,
      })),
    };
  }

  @Post('grant-premium')
  async grantPremium(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);

    const parsed = grantSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_ACCESS_GRANT_INVALID_BODY',
        message: 'Invalid grant premium payload',
        details: parsed.error.flatten(),
      });
    }

    const access = await this.authService.grantPremium({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.lifetime !== undefined ? { lifetime: parsed.data.lifetime } : {}),
      ...(parsed.data.days !== undefined ? { days: parsed.data.days } : {}),
    });
    await this.adminAuditService.log({
      actorUserId: actor.userId,
      actorTenantId: actor.tenantId,
      action: 'admin.access.grant_premium',
      targetTenantId: parsed.data.tenant_id,
      payload: {
        lifetime: parsed.data.lifetime ?? false,
        days: parsed.data.days ?? 30,
      },
    });

    return {
      success: true,
      data: {
        tenant_id: parsed.data.tenant_id,
        access,
      },
    };
  }

  @Post('revoke-premium')
  async revokePremium(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);

    const parsed = revokeSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_ACCESS_REVOKE_INVALID_BODY',
        message: 'Invalid revoke premium payload',
        details: parsed.error.flatten(),
      });
    }

    const access = await this.authService.revokePremium({
      tenantId: parsed.data.tenant_id,
    });
    await this.adminAuditService.log({
      actorUserId: actor.userId,
      actorTenantId: actor.tenantId,
      action: 'admin.access.revoke_premium',
      targetTenantId: parsed.data.tenant_id,
      payload: {},
    });

    return {
      success: true,
      data: {
        tenant_id: parsed.data.tenant_id,
        access,
      },
    };
  }

  @Get('audit')
  async audit(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.requireAdmin(req, authorization);
    const parsed = auditQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_ACCESS_AUDIT_INVALID_QUERY',
        message: 'Invalid audit query',
        details: parsed.error.flatten(),
      });
    }
    return {
      success: true,
      data: await this.adminAuditService.list({
        ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
        ...(parsed.data.action !== undefined ? { action: parsed.data.action } : {}),
        ...(parsed.data.tenant_id !== undefined ? { targetTenantId: parsed.data.tenant_id } : {}),
        ...(parsed.data.actor_user_id !== undefined
          ? { actorUserId: parsed.data.actor_user_id }
          : {}),
      }),
    };
  }

  @Post('users/bulk')
  async bulkUsers(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const actor = this.requireAdmin(req, authorization);
    const parsed = bulkUsersSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_ACCESS_BULK_USERS_INVALID_BODY',
        message: 'Invalid bulk users payload',
        details: parsed.error.flatten(),
      });
    }

    const action = parsed.data.action;
    const userIds = Array.from(
      new Set(parsed.data.user_ids.map((value) => String(value || '').trim())),
    );
    const results: Array<{
      user_id: string;
      status: 'success' | 'failed';
      tenant_id?: string | null;
      error?: string;
    }> = [];

    for (const userId of userIds) {
      try {
        const user = await this.authService.getUserById(userId);
        if (!user) {
          results.push({
            user_id: userId,
            status: 'failed',
            error: 'User not found',
          });
          continue;
        }

        if (action === 'grant_premium_30d') {
          if (!user.tenantId) {
            throw new Error('User has no tenant_id');
          }
          await this.authService.grantPremium({
            tenantId: user.tenantId,
            days: 30,
          });
          await this.adminAuditService.log({
            actorUserId: actor.userId,
            actorTenantId: actor.tenantId,
            action: 'admin.access.bulk.grant_premium',
            targetTenantId: user.tenantId,
            payload: {
              user_id: user.id,
              days: 30,
            },
          });
        } else if (action === 'revoke_premium') {
          if (!user.tenantId) {
            throw new Error('User has no tenant_id');
          }
          await this.authService.revokePremium({
            tenantId: user.tenantId,
          });
          await this.adminAuditService.log({
            actorUserId: actor.userId,
            actorTenantId: actor.tenantId,
            action: 'admin.access.bulk.revoke_premium',
            targetTenantId: user.tenantId,
            payload: {
              user_id: user.id,
            },
          });
        } else if (action === 'disable') {
          await this.authService.setUserDisabled({
            userId: user.id,
            disabled: true,
          });
          await this.adminAuditService.log({
            actorUserId: actor.userId,
            actorTenantId: actor.tenantId,
            action: 'auth.admin.bulk.disable_user',
            ...(user.tenantId ? { targetTenantId: user.tenantId } : {}),
            payload: {
              user_id: user.id,
            },
          });
        } else if (action === 'enable') {
          await this.authService.setUserDisabled({
            userId: user.id,
            disabled: false,
          });
          await this.adminAuditService.log({
            actorUserId: actor.userId,
            actorTenantId: actor.tenantId,
            action: 'auth.admin.bulk.enable_user',
            ...(user.tenantId ? { targetTenantId: user.tenantId } : {}),
            payload: {
              user_id: user.id,
            },
          });
        } else if (action === 'force_logout') {
          await this.authService.forceUserLogout({
            userId: user.id,
          });
          await this.adminAuditService.log({
            actorUserId: actor.userId,
            actorTenantId: actor.tenantId,
            action: 'auth.admin.bulk.force_logout',
            ...(user.tenantId ? { targetTenantId: user.tenantId } : {}),
            payload: {
              user_id: user.id,
            },
          });
        }

        results.push({
          user_id: user.id,
          status: 'success',
          tenant_id: user.tenantId,
        });
      } catch (error) {
        results.push({
          user_id: userId,
          status: 'failed',
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    const successCount = results.filter((row) => row.status === 'success').length;
    const failedCount = results.length - successCount;
    await this.adminAuditService.log({
      actorUserId: actor.userId,
      actorTenantId: actor.tenantId,
      action: 'admin.access.bulk.summary',
      payload: {
        action,
        requested: userIds.length,
        success: successCount,
        failed: failedCount,
      },
    });

    return {
      success: true,
      data: {
        action,
        requested: userIds.length,
        success: successCount,
        failed: failedCount,
        results,
      },
    };
  }
}
