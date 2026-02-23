import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AuthService } from './auth.service';
import { getRequestIdentity } from './request-identity.util';

const passwordSchema = z
  .string()
  .min(8)
  .max(256)
  .regex(/[a-z]/, 'Password must include a lowercase letter')
  .regex(/[A-Z]/, 'Password must include an uppercase letter')
  .regex(/[0-9]/, 'Password must include a digit');

const adminCreateUserSchema = z.object({
  email: z.string().trim().email(),
  password: passwordSchema,
  tenant_id: z.string().trim().min(3).max(128).optional(),
  roles: z.array(z.string().trim().min(1).max(64)).max(16).optional(),
});

const signUpSchema = z.object({
  email: z.string().trim().email(),
  password: passwordSchema,
});

const signInSchema = z.object({
  login: z.string().trim().min(1).max(320),
  password: z.string().min(1).max(512),
});

const grantPremiumSchema = z.object({
  tenant_id: z.string().trim().min(3).max(128),
  lifetime: z.boolean().optional(),
  days: z.coerce.number().int().min(1).max(3650).optional(),
});

const resetPasswordSchema = z.object({
  user_id: z.string().trim().min(1).max(200),
  new_password: passwordSchema,
});

const setRolesSchema = z.object({
  user_id: z.string().trim().min(1).max(200),
  roles: z.array(z.string().trim().min(1).max(64)).min(1).max(16),
});

const setUserDisabledSchema = z.object({
  user_id: z.string().trim().min(1).max(200),
  disabled: z.boolean(),
});

const forceLogoutSchema = z.object({
  user_id: z.string().trim().min(1).max(200),
});

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly adminAuditService: AdminAuditService,
  ) {}

  private async resolveIdentity(authorization: string | undefined): Promise<{
    uid: string;
    email: string;
    roles: string[];
    tenantId: string;
    access?: unknown;
  }> {
    const identity = await this.authService.verifyBearerToken(authorization);
    if (!identity) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
    return identity;
  }

  private getClientIp(req: Request): string {
    const forwarded = req.headers['x-forwarded-for'];
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

  @Get('verify')
  async verify(@Headers('authorization') authorization: string | undefined): Promise<{
    success: true;
    data: { valid: true };
  }> {
    await this.resolveIdentity(authorization);
    return {
      success: true,
      data: { valid: true },
    };
  }

  @Get('whoami')
  async whoami(@Headers('authorization') authorization: string | undefined): Promise<{
    success: true;
    data: {
      uid: string;
      email: string;
      roles: string[];
      tenant_id: string;
      tenant_type: 'user';
      access?: unknown;
    };
  }> {
    const identity = await this.resolveIdentity(authorization);
    return {
      success: true,
      data: {
        uid: identity.uid,
        email: identity.email,
        roles: identity.roles,
        tenant_id: identity.tenantId,
        tenant_type: 'user',
        ...(identity.access !== undefined ? { access: identity.access } : {}),
      },
    };
  }

  @Post('signup')
  @HttpCode(200)
  async signup(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: { access_token: string; uid: string; email: string; tenant_id: string; access: unknown };
  }> {
    const parsed = signUpSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AUTH_SIGNUP_INVALID_BODY',
        message: 'Invalid signup payload',
        details: parsed.error.flatten(),
      });
    }

    this.authService.enforcePublicAuthRateLimit({
      scope: 'signup',
      clientIp: this.getClientIp(req),
      principal: parsed.data.email,
    });

    await this.authService.createUserWithTenant({
      email: parsed.data.email,
      password: parsed.data.password,
      roles: ['user'],
    });
    const signedIn = await this.authService.signInWithPassword({
      login: parsed.data.email,
      password: parsed.data.password,
    });

    return {
      success: true,
      data: {
        access_token: signedIn.accessToken,
        uid: signedIn.identity.uid,
        email: signedIn.identity.email,
        tenant_id: signedIn.identity.tenantId,
        access: signedIn.identity.access,
      },
    };
  }

  @Post('signin')
  @HttpCode(200)
  async signin(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: { access_token: string; uid: string; email: string; tenant_id: string; access: unknown };
  }> {
    const parsed = signInSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AUTH_SIGNIN_INVALID_BODY',
        message: 'Invalid signin payload',
        details: parsed.error.flatten(),
      });
    }

    this.authService.enforcePublicAuthRateLimit({
      scope: 'signin',
      clientIp: this.getClientIp(req),
      principal: parsed.data.login,
    });

    const signedIn = await this.authService.signInWithPassword({
      login: parsed.data.login,
      password: parsed.data.password,
    });
    return {
      success: true,
      data: {
        access_token: signedIn.accessToken,
        uid: signedIn.identity.uid,
        email: signedIn.identity.email,
        tenant_id: signedIn.identity.tenantId,
        access: signedIn.identity.access,
      },
    };
  }

  @Post('admin/signin')
  @HttpCode(200)
  async adminSignin(
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: { access_token: string; uid: string; email: string; tenant_id: string; access: unknown };
  }> {
    const parsed = signInSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AUTH_ADMIN_SIGNIN_INVALID_BODY',
        message: 'Invalid admin signin payload',
        details: parsed.error.flatten(),
      });
    }

    this.authService.enforceAdminRateLimit?.({
      action: 'auth.admin.signin',
      clientIp: this.getClientIp(req),
      principal: parsed.data.login,
    });

    const signedIn = await this.authService.signInWithPassword({
      login: parsed.data.login,
      password: parsed.data.password,
    });

    if (!this.authService.isAdmin(signedIn.identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_INVALID_CREDENTIALS',
        message: 'Invalid admin credentials',
      });
    }

    return {
      success: true,
      data: {
        access_token: signedIn.accessToken,
        uid: signedIn.identity.uid,
        email: signedIn.identity.email,
        tenant_id: signedIn.identity.tenantId,
        access: signedIn.identity.access,
      },
    };
  }

  @Get('admin/whoami')
  async adminWhoami(@Headers('authorization') authorization: string | undefined): Promise<{
    success: true;
    data: {
      uid: string;
      email: string;
      roles: string[];
      tenant_id: string;
      tenant_type: 'user';
      access?: unknown;
    };
  }> {
    const identity = await this.resolveIdentity(authorization);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_INVALID_CREDENTIALS',
        message: 'Invalid admin credentials',
      });
    }

    return {
      success: true,
      data: {
        uid: identity.uid,
        email: identity.email,
        roles: identity.roles,
        tenant_id: identity.tenantId,
        tenant_type: 'user',
        ...(identity.access !== undefined ? { access: identity.access } : {}),
      },
    };
  }

  @Post('admin/create-user')
  async adminCreateUser(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: { id: string; email: string; tenant_id: string };
  }> {
    await this.resolveIdentity(authorization);
    const identity = getRequestIdentity(req);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
    }

    const parsed = adminCreateUserSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AUTH_CREATE_USER_INVALID_BODY',
        message: 'Invalid admin create user payload',
        details: parsed.error.flatten(),
      });
    }
    this.enforceAdminRateLimit(req, 'auth.admin.create-user', identity.userId, parsed.data.email);

    const created = await this.authService.createUserWithTenant({
      email: parsed.data.email,
      password: parsed.data.password,
      ...(parsed.data.tenant_id !== undefined ? { tenantId: parsed.data.tenant_id } : {}),
      ...(parsed.data.roles !== undefined ? { roles: parsed.data.roles } : {}),
    });
    await this.adminAuditService.log({
      actorUserId: identity.userId,
      actorTenantId: identity.tenantId,
      action: 'auth.admin.create_user',
      targetTenantId: created.tenantId,
      payload: {
        email: created.email,
      },
    });

    return {
      success: true,
      data: {
        id: created.id,
        email: created.email,
        tenant_id: created.tenantId,
      },
    };
  }

  @Post('admin/grant-premium')
  async adminGrantPremium(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: { tenant_id: string; access: unknown } }> {
    await this.resolveIdentity(authorization);
    const identity = getRequestIdentity(req);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
    }

    const parsed = grantPremiumSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AUTH_GRANT_PREMIUM_INVALID_BODY',
        message: 'Invalid grant premium payload',
        details: parsed.error.flatten(),
      });
    }
    this.enforceAdminRateLimit(
      req,
      'auth.admin.grant-premium',
      identity.userId,
      parsed.data.tenant_id,
    );

    const access = await this.authService.grantPremium({
      tenantId: parsed.data.tenant_id,
      ...(parsed.data.lifetime !== undefined ? { lifetime: parsed.data.lifetime } : {}),
      ...(parsed.data.days !== undefined ? { days: parsed.data.days } : {}),
    });
    await this.adminAuditService.log({
      actorUserId: identity.userId,
      actorTenantId: identity.tenantId,
      action: 'auth.admin.grant_premium',
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

  @Post('admin/reset-password')
  async adminResetPassword(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: { user_id: string } }> {
    await this.resolveIdentity(authorization);
    const identity = getRequestIdentity(req);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
    }

    const parsed = resetPasswordSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AUTH_RESET_PASSWORD_INVALID_BODY',
        message: 'Invalid reset password payload',
        details: parsed.error.flatten(),
      });
    }
    this.enforceAdminRateLimit(
      req,
      'auth.admin.reset-password',
      identity.userId,
      parsed.data.user_id,
    );

    await this.authService.resetUserPassword({
      userId: parsed.data.user_id,
      newPassword: parsed.data.new_password,
    });
    await this.adminAuditService.log({
      actorUserId: identity.userId,
      actorTenantId: identity.tenantId,
      action: 'auth.admin.reset_password',
      payload: {
        user_id: parsed.data.user_id,
      },
    });

    return {
      success: true,
      data: {
        user_id: parsed.data.user_id,
      },
    };
  }

  @Post('admin/set-roles')
  async adminSetRoles(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: { user_id: string; roles: string[] } }> {
    await this.resolveIdentity(authorization);
    const identity = getRequestIdentity(req);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
    }

    const parsed = setRolesSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AUTH_SET_ROLES_INVALID_BODY',
        message: 'Invalid set roles payload',
        details: parsed.error.flatten(),
      });
    }
    this.enforceAdminRateLimit(req, 'auth.admin.set-roles', identity.userId, parsed.data.user_id);

    const result = await this.authService.setUserRoles({
      userId: parsed.data.user_id,
      roles: parsed.data.roles,
    });
    await this.adminAuditService.log({
      actorUserId: identity.userId,
      actorTenantId: identity.tenantId,
      action: 'auth.admin.set_roles',
      payload: {
        user_id: result.userId,
        roles: result.roles,
      },
    });

    return {
      success: true,
      data: {
        user_id: result.userId,
        roles: result.roles,
      },
    };
  }

  @Post('admin/set-user-disabled')
  async adminSetUserDisabled(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: { user_id: string; disabled: boolean } }> {
    await this.resolveIdentity(authorization);
    const identity = getRequestIdentity(req);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
    }

    const parsed = setUserDisabledSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AUTH_SET_USER_DISABLED_INVALID_BODY',
        message: 'Invalid set user disabled payload',
        details: parsed.error.flatten(),
      });
    }
    this.enforceAdminRateLimit(
      req,
      'auth.admin.set-user-disabled',
      identity.userId,
      parsed.data.user_id,
    );

    const result = await this.authService.setUserDisabled({
      userId: parsed.data.user_id,
      disabled: parsed.data.disabled,
    });
    await this.adminAuditService.log({
      actorUserId: identity.userId,
      actorTenantId: identity.tenantId,
      action: 'auth.admin.set_user_disabled',
      payload: {
        user_id: result.userId,
        disabled: result.disabled,
      },
    });

    return {
      success: true,
      data: {
        user_id: result.userId,
        disabled: result.disabled,
      },
    };
  }

  @Post('admin/force-logout')
  async adminForceLogout(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: { user_id: string } }> {
    await this.resolveIdentity(authorization);
    const identity = getRequestIdentity(req);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
    }

    const parsed = forceLogoutSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AUTH_FORCE_LOGOUT_INVALID_BODY',
        message: 'Invalid force logout payload',
        details: parsed.error.flatten(),
      });
    }
    this.enforceAdminRateLimit(
      req,
      'auth.admin.force-logout',
      identity.userId,
      parsed.data.user_id,
    );

    const result = await this.authService.forceUserLogout({
      userId: parsed.data.user_id,
    });
    await this.adminAuditService.log({
      actorUserId: identity.userId,
      actorTenantId: identity.tenantId,
      action: 'auth.admin.force_logout',
      payload: {
        user_id: result.userId,
      },
    });

    return {
      success: true,
      data: {
        user_id: result.userId,
      },
    };
  }
}
