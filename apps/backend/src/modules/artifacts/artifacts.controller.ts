import {
  artifactAssignmentPathSchema,
  artifactAssignmentQuerySchema,
  artifactAssignSchema,
  artifactReleaseCreateSchema,
  artifactResolveDownloadSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';
import { ArtifactsService, ArtifactsServiceError } from './artifacts.service';

@Controller('artifacts')
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  @Post('releases')
  async createRelease(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const identity = getRequestIdentity(req);
    const parsed = artifactReleaseCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST_BODY',
        message: 'Invalid artifact release request body',
        details: parsed.error.flatten(),
      });
    }

    const release = await this.artifactsService.createRelease({
      tenantId: identity.tenantId,
      payload: parsed.data,
    });
    return {
      success: true,
      data: release,
    };
  }

  @Post('assign')
  async assignRelease(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const identity = getRequestIdentity(req);
    const parsed = artifactAssignSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST_BODY',
        message: 'Invalid artifact assignment request body',
        details: parsed.error.flatten(),
      });
    }

    try {
      const assignment = await this.artifactsService.assignRelease({
        tenantId: identity.tenantId,
        payload: parsed.data,
      });
      return {
        success: true,
        data: assignment,
      };
    } catch (error) {
      if (error instanceof ArtifactsServiceError && error.status === 404) {
        throw new NotFoundException({
          code: 'ARTIFACT_RELEASE_NOT_FOUND',
          message: error.message,
        });
      }
      if (error instanceof ArtifactsServiceError && error.status === 409) {
        throw new ConflictException({
          code: 'ARTIFACT_SCOPE_MISMATCH',
          message: error.message,
        });
      }
      throw error;
    }
  }

  @Get('assign/:userId/:module')
  async getEffectiveAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const identity = getRequestIdentity(req);

    const parsedPath = artifactAssignmentPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException({
        code: 'INVALID_PATH_PARAMS',
        message: 'Invalid artifact assignment path params',
        details: parsedPath.error.flatten(),
      });
    }
    const parsedQuery = artifactAssignmentQuerySchema.safeParse(query ?? {});
    if (!parsedQuery.success) {
      throw new BadRequestException({
        code: 'INVALID_QUERY_PARAMS',
        message: 'Invalid artifact assignment query params',
        details: parsedQuery.error.flatten(),
      });
    }

    const assignment = await this.artifactsService.getEffectiveAssignment({
      tenantId: identity.tenantId,
      userId: parsedPath.data.userId,
      module: parsedPath.data.module,
      platform: parsedQuery.data.platform,
      channel: parsedQuery.data.channel,
    });
    return {
      success: true,
      data: assignment,
    };
  }

  @Post('resolve-download')
  @HttpCode(200)
  async resolveDownload(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const identity = getRequestIdentity(req);
    const parsed = artifactResolveDownloadSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'INVALID_REQUEST_BODY',
        message: 'Invalid artifact resolve-download request body',
        details: parsed.error.flatten(),
      });
    }

    const resolved = await this.artifactsService.resolveDownload({
      tenantId: identity.tenantId,
      leaseToken: parsed.data.lease_token,
      vmUuid: parsed.data.vm_uuid,
      module: parsed.data.module,
      platform: parsed.data.platform,
      channel: parsed.data.channel,
    });
    if (!resolved) {
      throw new NotFoundException({
        code: 'ARTIFACT_RESOLUTION_NOT_FOUND',
        message: 'Artifact assignment not found',
      });
    }

    return {
      success: true,
      data: resolved,
    };
  }
}
