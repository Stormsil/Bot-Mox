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
  UnauthorizedException,
} from '@nestjs/common';
import { ArtifactsService, ArtifactsServiceError } from './artifacts.service';

@Controller('artifacts')
export class ArtifactsController {
  constructor(private readonly artifactsService: ArtifactsService) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  @Post('releases')
  createRelease(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsed = artifactReleaseCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const release = this.artifactsService.createRelease({
      tenantId: 'default',
      payload: parsed.data,
    });
    return {
      success: true,
      data: release,
    };
  }

  @Post('assign')
  assignRelease(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsed = artifactAssignSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    try {
      const assignment = this.artifactsService.assignRelease({
        tenantId: 'default',
        payload: parsed.data,
      });
      return {
        success: true,
        data: assignment,
      };
    } catch (error) {
      if (error instanceof ArtifactsServiceError && error.status === 404) {
        throw new NotFoundException(error.message);
      }
      if (error instanceof ArtifactsServiceError && error.status === 409) {
        throw new ConflictException(error.message);
      }
      throw error;
    }
  }

  @Get('assign/:userId/:module')
  getEffectiveAssignment(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);

    const parsedPath = artifactAssignmentPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }
    const parsedQuery = artifactAssignmentQuerySchema.safeParse(query ?? {});
    if (!parsedQuery.success) {
      throw new BadRequestException(parsedQuery.error.flatten());
    }

    const assignment = this.artifactsService.getEffectiveAssignment({
      tenantId: 'default',
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
  resolveDownload(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsed = artifactResolveDownloadSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const resolved = this.artifactsService.resolveDownload({
      tenantId: 'default',
      leaseToken: parsed.data.lease_token,
      vmUuid: parsed.data.vm_uuid,
      module: parsed.data.module,
      platform: parsed.data.platform,
      channel: parsed.data.channel,
    });
    if (!resolved) {
      throw new NotFoundException('Artifact assignment not found');
    }

    return {
      success: true,
      data: resolved,
    };
  }
}
