import {
  adminProjectCreateReleaseSchema,
  adminProjectReleaseListQuerySchema,
  adminProjectRollbackSchema,
  adminProjectRolloutSchema,
  adminProjectRolloutStatusQuerySchema,
  adminProjectStagedRolloutSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Optional,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AuthService } from '../auth/auth.service';
import { getRequestIdentity } from '../auth/request-identity.util';
import { AdminProjectsService } from './admin-projects.service';

@Controller('admin/projects')
export class AdminProjectsController {
  constructor(
    private readonly adminProjectsService: AdminProjectsService,
    private readonly authService: AuthService,
    @Optional() private readonly adminAuditService?: AdminAuditService,
  ) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private requireAdminRequest(req: Request): { userId: string } {
    const identity = getRequestIdentity(req);
    const normalizedRoles = identity.roles.map((role) =>
      String(role || '')
        .trim()
        .toLowerCase(),
    );
    if (
      !normalizedRoles.includes('admin') &&
      !normalizedRoles.includes('owner') &&
      !normalizedRoles.includes('service_role')
    ) {
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
      action: `admin.projects.${String(req.method || 'GET').toLowerCase()}:${String(req.path || '').toLowerCase()}`,
      clientIp,
      actorUserId: identity.userId,
      principal: identity.tenantId,
    });

    return { userId: identity.userId };
  }

  @Post('catalog/releases')
  async createRelease(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const actor = this.requireAdminRequest(req);

    const parsed = adminProjectCreateReleaseSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_PROJECTS_CREATE_RELEASE_INVALID_BODY',
        message: 'Invalid release payload',
        details: parsed.error.flatten(),
      });
    }

    const created = await this.adminProjectsService.createRelease({
      projectKey: parsed.data.project_key,
      version: parsed.data.version,
      ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
      ...(parsed.data.artifacts !== undefined ? { artifacts: parsed.data.artifacts } : {}),
      ...(parsed.data.metadata !== undefined ? { metadata: parsed.data.metadata } : {}),
      createdBy: actor.userId,
    });
    if (this.adminAuditService) {
      const createdRecord =
        created && typeof created === 'object' ? (created as Record<string, unknown>) : {};
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        action: 'admin.projects.create_release',
        payload: {
          project_key: parsed.data.project_key,
          version: parsed.data.version,
          release_id: String(createdRecord.id || '').trim() || null,
        },
      });
    }
    return {
      success: true,
      data: created,
    };
  }

  @Get('catalog/releases')
  async listReleases(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    this.requireAdminRequest(req);

    const parsed = adminProjectReleaseListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_PROJECTS_LIST_RELEASES_INVALID_QUERY',
        message: 'Invalid release list query',
        details: parsed.error.flatten(),
      });
    }

    return {
      success: true,
      data: await this.adminProjectsService.listReleases({
        ...(parsed.data.project_key !== undefined ? { projectKey: parsed.data.project_key } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.page !== undefined ? { page: parsed.data.page } : {}),
        ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
        ...(parsed.data.sort !== undefined ? { sort: parsed.data.sort } : {}),
        ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
      }),
    };
  }

  @Post('rollout')
  async rollout(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const actor = this.requireAdminRequest(req);

    const parsed = adminProjectRolloutSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_PROJECTS_ROLLOUT_INVALID_BODY',
        message: 'Invalid rollout payload',
        details: parsed.error.flatten(),
      });
    }

    const rollout = await this.adminProjectsService.rollout({
      projectKey: parsed.data.project_key,
      releaseId: parsed.data.release_id,
      scope: parsed.data.scope,
      ...(parsed.data.tenant_id !== undefined ? { tenantId: parsed.data.tenant_id } : {}),
      ...(parsed.data.wave !== undefined ? { wave: parsed.data.wave } : {}),
      ...(parsed.data.batch_size !== undefined ? { batchSize: parsed.data.batch_size } : {}),
      ...(parsed.data.tenant_ids !== undefined ? { tenantIds: parsed.data.tenant_ids } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      updatedBy: actor.userId,
    });
    if (this.adminAuditService) {
      const rolloutRecord =
        rollout && typeof rollout === 'object' ? (rollout as Record<string, unknown>) : {};
      const parsedCount = Number(rolloutRecord.count ?? 0);
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        action: 'admin.projects.rollout',
        payload: {
          project_key: parsed.data.project_key,
          release_id: parsed.data.release_id,
          scope: parsed.data.scope,
          wave: parsed.data.wave ?? null,
          count: Number.isFinite(parsedCount) ? parsedCount : 0,
        },
      });
    }
    return {
      success: true,
      data: rollout,
    };
  }

  @Post('rollout/staged')
  async rolloutStaged(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const actor = this.requireAdminRequest(req);

    const parsed = adminProjectStagedRolloutSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_PROJECTS_STAGED_ROLLOUT_INVALID_BODY',
        message: 'Invalid staged rollout payload',
        details: parsed.error.flatten(),
      });
    }

    const rollout = await this.adminProjectsService.rolloutStaged({
      projectKey: parsed.data.project_key,
      releaseId: parsed.data.release_id,
      testTenantId: parsed.data.test_tenant_id,
      ...(parsed.data.tenant_ids !== undefined ? { tenantIds: parsed.data.tenant_ids } : {}),
      ...(parsed.data.batch_size !== undefined ? { batchSize: parsed.data.batch_size } : {}),
      ...(parsed.data.wave !== undefined ? { wave: parsed.data.wave } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      updatedBy: actor.userId,
    });
    if (this.adminAuditService) {
      const rolloutRecord =
        rollout && typeof rollout === 'object' ? (rollout as Record<string, unknown>) : {};
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        action: 'admin.projects.rollout.staged',
        payload: {
          project_key: parsed.data.project_key,
          release_id: parsed.data.release_id,
          test_tenant_id: parsed.data.test_tenant_id,
          wave: parsed.data.wave ?? null,
          total_updated: Number(rolloutRecord.total_updated ?? 0) || 0,
        },
      });
    }

    return {
      success: true,
      data: rollout,
    };
  }

  @Post('rollback')
  async rollback(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const actor = this.requireAdminRequest(req);

    const parsed = adminProjectRollbackSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_PROJECTS_ROLLBACK_INVALID_BODY',
        message: 'Invalid rollback payload',
        details: parsed.error.flatten(),
      });
    }

    const rollback = await this.adminProjectsService.rollback({
      projectKey: parsed.data.project_key,
      scope: parsed.data.scope,
      ...(parsed.data.tenant_id !== undefined ? { tenantId: parsed.data.tenant_id } : {}),
      ...(parsed.data.wave !== undefined ? { wave: parsed.data.wave } : {}),
      ...(parsed.data.batch_size !== undefined ? { batchSize: parsed.data.batch_size } : {}),
      ...(parsed.data.tenant_ids !== undefined ? { tenantIds: parsed.data.tenant_ids } : {}),
      ...(parsed.data.notes !== undefined ? { notes: parsed.data.notes } : {}),
      updatedBy: actor.userId,
    });
    if (this.adminAuditService) {
      const rollbackRecord =
        rollback && typeof rollback === 'object' ? (rollback as Record<string, unknown>) : {};
      await this.adminAuditService.log({
        actorUserId: actor.userId,
        action: 'admin.projects.rollback',
        payload: {
          project_key: parsed.data.project_key,
          scope: parsed.data.scope,
          wave: parsed.data.wave ?? null,
          rolled_back: Number(rollbackRecord.rolled_back ?? 0) || 0,
          skipped: Number(rollbackRecord.skipped ?? 0) || 0,
        },
      });
    }
    return {
      success: true,
      data: rollback,
    };
  }

  @Get('rollout/status')
  async status(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    this.requireAdminRequest(req);

    const parsed = adminProjectRolloutStatusQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'ADMIN_PROJECTS_ROLLOUT_STATUS_INVALID_QUERY',
        message: 'Invalid rollout status query',
        details: parsed.error.flatten(),
      });
    }

    return {
      success: true,
      data: await this.adminProjectsService.listRolloutStatus({
        ...(parsed.data.project_key !== undefined ? { projectKey: parsed.data.project_key } : {}),
        ...(parsed.data.tenant_id !== undefined ? { tenantId: parsed.data.tenant_id } : {}),
        ...(parsed.data.status !== undefined ? { status: parsed.data.status } : {}),
        ...(parsed.data.page !== undefined ? { page: parsed.data.page } : {}),
        ...(parsed.data.limit !== undefined ? { limit: parsed.data.limit } : {}),
        ...(parsed.data.sort !== undefined ? { sort: parsed.data.sort } : {}),
        ...(parsed.data.order !== undefined ? { order: parsed.data.order } : {}),
      }),
    };
  }
}
