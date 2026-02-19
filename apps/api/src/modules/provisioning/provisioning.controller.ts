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
  UnauthorizedException,
} from '@nestjs/common';
import type { z } from 'zod';
import type { ProvisioningService } from './provisioning.service';

@Controller()
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseValidateBody(body: unknown): z.infer<typeof provisioningValidateTokenSchema> {
    const parsed = provisioningValidateTokenSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseReportBody(body: unknown): z.infer<typeof provisioningReportProgressSchema> {
    const parsed = provisioningReportProgressSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseUnattendCreateBody(body: unknown): z.infer<typeof unattendProfileCreateSchema> {
    const parsed = unattendProfileCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseUnattendUpdateBody(body: unknown): z.infer<typeof unattendProfileUpdateSchema> {
    const parsed = unattendProfileUpdateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseProfileId(id: string): string {
    const parsed = unattendProfilePathSchema.safeParse({ id });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data.id;
  }

  private parseGenerateBody(body: unknown): z.infer<typeof provisioningGenerateIsoPayloadSchema> {
    const parsed = provisioningGenerateIsoPayloadSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    if (!parsed.data.profile_id && !parsed.data.profile_config) {
      throw new BadRequestException('Either profile_id or profile_config is required');
    }
    return parsed.data;
  }

  private parseVmUuid(vmUuid: string): string {
    const parsed = provisioningProgressPathSchema.safeParse({ vmUuid });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data.vmUuid;
  }

  @Get('unattend-profiles')
  listProfiles(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown[];
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.provisioningService.listProfiles(),
    };
  }

  @Post('unattend-profiles')
  @HttpCode(HttpStatus.CREATED)
  createProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseUnattendCreateBody(body);
    return {
      success: true,
      data: this.provisioningService.createProfile(parsedBody),
    };
  }

  @Put('unattend-profiles/:id')
  updateProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const profileId = this.parseProfileId(id);
    const parsedBody = this.parseUnattendUpdateBody(body);
    const updated = this.provisioningService.updateProfile(profileId, parsedBody);
    if (!updated) {
      throw new NotFoundException('Unattend profile not found');
    }

    return {
      success: true,
      data: updated,
    };
  }

  @Delete('unattend-profiles/:id')
  deleteProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: { deleted: boolean } } {
    this.ensureAuthHeader(authorization);
    const profileId = this.parseProfileId(id);
    const deleted = this.provisioningService.deleteProfile(profileId);
    if (!deleted) {
      throw new NotFoundException('Unattend profile not found');
    }

    return {
      success: true,
      data: {
        deleted: true,
      },
    };
  }

  @Post('provisioning/generate-iso-payload')
  generateIsoPayload(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseGenerateBody(body);
    const profileConfig =
      parsedBody.profile_config ??
      (parsedBody.profile_id
        ? this.provisioningService.getProfile(parsedBody.profile_id)?.config
        : null);

    if (!profileConfig) {
      throw new NotFoundException('Unattend profile not found');
    }

    return {
      success: true,
      data: this.provisioningService.generateIsoPayload({
        ...parsedBody,
        profile_config: profileConfig,
      }),
    };
  }

  @Post('provisioning/validate-token')
  validateToken(@Body() body: unknown): { success: true; data: unknown } {
    const parsedBody = this.parseValidateBody(body);
    const result = this.provisioningService.validateToken(parsedBody);
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
  reportProgress(@Body() body: unknown): { success: true; data: unknown } {
    const parsedBody = this.parseReportBody(body);
    const result = this.provisioningService.reportProgress(parsedBody);
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
  getProgress(
    @Headers('authorization') authorization: string | undefined,
    @Param('vmUuid') vmUuid: string,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedVmUuid = this.parseVmUuid(vmUuid);
    return {
      success: true,
      data: this.provisioningService.getProgress(parsedVmUuid),
    };
  }
}
