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
import type { ZodType, z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { TenantCrudControllerCoreBase } from '../common/tenant-crud.controller-core-base';
import { ProvisioningService } from './provisioning.service';

@Controller()
export class ProvisioningController extends TenantCrudControllerCoreBase<
  z.infer<typeof unattendProfileCreateSchema>,
  z.infer<typeof unattendProfileUpdateSchema>
> {
  constructor(private readonly provisioningService: ProvisioningService) {
    super();
  }

  private parseWithSchema<TSchema extends ZodType>(
    schema: TSchema,
    body: unknown,
    code: string,
    message: string,
  ): z.output<TSchema> {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code,
        message,
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseValidateBody(body: unknown): z.infer<typeof provisioningValidateTokenSchema> {
    return this.parseWithSchema(
      provisioningValidateTokenSchema,
      body,
      'PROVISIONING_INVALID_VALIDATE_BODY',
      'Invalid provisioning validate-token payload',
    );
  }

  private parseReportBody(body: unknown): z.infer<typeof provisioningReportProgressSchema> {
    return this.parseWithSchema(
      provisioningReportProgressSchema,
      body,
      'PROVISIONING_INVALID_REPORT_BODY',
      'Invalid provisioning report-progress payload',
    );
  }

  protected parseCreateBody(body: unknown): z.infer<typeof unattendProfileCreateSchema> {
    return this.parseWithSchema(
      unattendProfileCreateSchema,
      body,
      'PROVISIONING_INVALID_PROFILE_CREATE_BODY',
      'Invalid unattend profile create payload',
    );
  }

  protected parseUpdateBody(body: unknown): z.infer<typeof unattendProfileUpdateSchema> {
    return this.parseWithSchema(
      unattendProfileUpdateSchema,
      body,
      'PROVISIONING_INVALID_PROFILE_UPDATE_BODY',
      'Invalid unattend profile update payload',
    );
  }

  protected parseId(id: string): string {
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

  protected getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'UNATTEND_PROFILE_NOT_FOUND',
      message: 'Unattend profile not found',
    };
  }

  protected getEntityById(id: string, tenantId: string) {
    return this.provisioningService.getProfile(id, tenantId);
  }

  protected createEntity(
    body: z.infer<typeof unattendProfileCreateSchema>,
    _explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.provisioningService.createProfile(body, tenantId);
  }

  protected updateEntity(
    id: string,
    body: z.infer<typeof unattendProfileUpdateSchema>,
    tenantId: string,
  ) {
    return this.provisioningService.updateProfile(id, body, tenantId);
  }

  protected removeEntity(id: string, tenantId: string) {
    return this.provisioningService.deleteProfile(id, tenantId);
  }

  protected override buildDeleteResponseData(): unknown {
    return { deleted: true };
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
    const tenantId = this.getTenantId(req);
    return {
      success: true,
      data: await this.provisioningService.listProfiles(tenantId),
    };
  }

  @Post('unattend-profiles')
  @HttpCode(HttpStatus.CREATED)
  async createProfile(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.createCore(authorization, body, req);
  }

  @Put('unattend-profiles/:id')
  async updateProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.updateCore(authorization, id, body, req);
  }

  @Delete('unattend-profiles/:id')
  async deleteProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { deleted: boolean } }> {
    return this.removeCore(authorization, id, req) as Promise<{
      success: true;
      data: { deleted: boolean };
    }>;
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
    const tenantId = this.getTenantId(req);
    return {
      success: true,
      data: await this.provisioningService.getProgress(parsedVmUuid, tenantId),
    };
  }
}
