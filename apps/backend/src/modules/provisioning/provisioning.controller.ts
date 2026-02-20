import {
  provisioningGenerateIsoPayloadSchema,
  provisioningProgressPathSchema,
  provisioningReportProgressSchema,
  provisioningValidateTokenSchema,
  unattendProfileCreateSchema,
  unattendProfilePathSchema,
  unattendProfileUpdateSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { ProvisioningService } from './provisioning.service';

@Controller()
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseValidateBody(body: unknown): z.infer<typeof provisioningValidateTokenSchema> {
    const parsed = provisioningValidateTokenSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PROVISIONING_INVALID_VALIDATE_BODY',
        message: 'Invalid provisioning validate-token payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseReportBody(body: unknown): z.infer<typeof provisioningReportProgressSchema> {
    const parsed = provisioningReportProgressSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PROVISIONING_INVALID_REPORT_BODY',
        message: 'Invalid provisioning report-progress payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseUnattendCreateBody(body: unknown): z.infer<typeof unattendProfileCreateSchema> {
    const parsed = unattendProfileCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PROVISIONING_INVALID_PROFILE_CREATE_BODY',
        message: 'Invalid unattend profile create payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseUnattendUpdateBody(body: unknown): z.infer<typeof unattendProfileUpdateSchema> {
    const parsed = unattendProfileUpdateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PROVISIONING_INVALID_PROFILE_UPDATE_BODY',
        message: 'Invalid unattend profile update payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseProfileId(id: string): string {
    const parsed = unattendProfilePathSchema.safeParse({ id });
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PROVISIONING_INVALID_PROFILE_ID',
        message: 'Invalid unattend profile id',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data.id;
  }

  private parseGenerateBody(body: unknown): z.infer<typeof provisioningGenerateIsoPayloadSchema> {
    const parsed = provisioningGenerateIsoPayloadSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PROVISIONING_INVALID_GENERATE_BODY',
        message: 'Invalid provisioning generate-iso payload',
        details: parsed.error.flatten(),
      });
    }
    if (!parsed.data.profile_id && !parsed.data.profile_config) {
      throw new BadRequestException({
        code: 'PROVISIONING_PROFILE_SOURCE_REQUIRED',
        message: 'Either profile_id or profile_config is required',
      });
    }
    return parsed.data;
  }

  private parseVmUuid(vmUuid: string): string {
    const parsed = provisioningProgressPathSchema.safeParse({ vmUuid });
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PROVISIONING_INVALID_VM_UUID',
        message: 'Invalid provisioning vmUuid path',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data.vmUuid;
  }

  @Get('unattend-profiles')
  async listProfiles(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
  }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.provisioningService.listProfiles(identity.tenantId),
    };
  }

  @Post('unattend-profiles')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseUnattendCreateBody(body);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.provisioningService.createProfile(parsedBody, identity.tenantId),
    };
  }

  @Put('unattend-profiles/:id')
  async updateProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const profileId = this.parseProfileId(id);
    const parsedBody = this.parseUnattendUpdateBody(body);
    const identity = getRequestIdentity(req);
    const updated = await this.provisioningService.updateProfile(
      profileId,
      parsedBody,
      identity.tenantId,
    );
    if (!updated) {
      throw new NotFoundException({
        code: 'UNATTEND_PROFILE_NOT_FOUND',
        message: 'Unattend profile not found',
      });
    }

    return {
      success: true,
      data: updated,
    };
  }

  @Delete('unattend-profiles/:id')
  async deleteProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const profileId = this.parseProfileId(id);
    const identity = getRequestIdentity(req);
    const deleted = await this.provisioningService.deleteProfile(profileId, identity.tenantId);
    if (!deleted) {
      throw new NotFoundException({
        code: 'UNATTEND_PROFILE_NOT_FOUND',
        message: 'Unattend profile not found',
      });
    }

    return {
      success: true,
      data: {
        deleted: true,
      },
    };
  }

  @Post('provisioning/generate-iso-payload')
  async generateIsoPayload(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseGenerateBody(body);
    const identity = getRequestIdentity(req);
    const profileConfig =
      parsedBody.profile_config ??
      (parsedBody.profile_id
        ? (await this.provisioningService.getProfile(parsedBody.profile_id, identity.tenantId))
            ?.config
        : null);

    if (!profileConfig) {
      throw new NotFoundException({
        code: 'UNATTEND_PROFILE_NOT_FOUND',
        message: 'Unattend profile not found',
      });
    }

    return {
      success: true,
      data: await this.provisioningService.generateIsoPayload(
        {
          ...parsedBody,
          profile_config: profileConfig,
        },
        {
          tenantId: identity.tenantId,
          userId: identity.userId,
        },
      ),
    };
  }

  @Post('provisioning/validate-token')
  async validateToken(@Body() body: unknown): Promise<{ success: true; data: unknown }> {
    const parsedBody = this.parseValidateBody(body);
    const result = await this.provisioningService.validateToken(parsedBody);
    if (!result) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Provisioning token is invalid',
        },
      });
    }

    return {
      success: true,
      data: result,
    };
  }

  @Post('provisioning/report-progress')
  async reportProgress(@Body() body: unknown): Promise<{ success: true; data: unknown }> {
    const parsedBody = this.parseReportBody(body);
    const result = await this.provisioningService.reportProgress(parsedBody);
    if (!result) {
      throw new UnauthorizedException({
        success: false,
        error: {
          code: 'TOKEN_INVALID',
          message: 'Provisioning token is invalid',
        },
      });
    }

    return {
      success: true,
      data: result,
    };
  }

  @Get('provisioning/progress/:vmUuid')
  async getProgress(
    @Headers('authorization') authorization: string | undefined,
    @Param('vmUuid') vmUuid: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedVmUuid = this.parseVmUuid(vmUuid);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.provisioningService.getProgress(parsedVmUuid, identity.tenantId),
    };
  }
}
