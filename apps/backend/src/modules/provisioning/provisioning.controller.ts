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
import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import type { ZodType, z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import {
  createBadRequestValidationPipe,
  ZodSchemaValidationPipe,
} from '../common/http-validation.util';
import { ProvisioningService } from './provisioning.service';

const unattendProfileIdParamPipe = createBadRequestValidationPipe(
  'PROVISIONING_INVALID_PROFILE_ID',
  'Invalid unattend profile id',
);
const provisioningVmUuidParamPipe = createBadRequestValidationPipe(
  'PROVISIONING_INVALID_VM_UUID',
  'Invalid provisioning vmUuid path',
);
const unattendProfileCreateBodyPipe = new ZodSchemaValidationPipe(
  unattendProfileCreateSchema,
  'PROVISIONING_INVALID_PROFILE_CREATE_BODY',
  'Invalid unattend profile create payload',
);
const unattendProfileUpdateBodyPipe = new ZodSchemaValidationPipe(
  unattendProfileUpdateSchema,
  'PROVISIONING_INVALID_PROFILE_UPDATE_BODY',
  'Invalid unattend profile update payload',
);
const provisioningValidateBodyPipe = new ZodSchemaValidationPipe(
  provisioningValidateTokenSchema,
  'PROVISIONING_INVALID_VALIDATE_BODY',
  'Invalid provisioning validate-token payload',
);
const provisioningReportBodyPipe = new ZodSchemaValidationPipe(
  provisioningReportProgressSchema,
  'PROVISIONING_INVALID_REPORT_BODY',
  'Invalid provisioning report-progress payload',
);
const provisioningGenerateBodyPipe = new ZodSchemaValidationPipe(
  provisioningGenerateIsoPayloadSchema,
  'PROVISIONING_INVALID_GENERATE_BODY',
  'Invalid provisioning generate-iso payload',
);

class UnattendProfileIdParamDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(1)
  id!: string;
}

class ProvisioningVmUuidParamDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(1)
  vmUuid!: string;
}

@Controller()
export class ProvisioningController {
  constructor(private readonly provisioningService: ProvisioningService) {
    // no-op
  }

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private getTenantId(req: Request): string {
    return getRequestIdentity(req).tenantId;
  }

  private getExplicitIdFromBody(body: Record<string, unknown>): string | undefined {
    return typeof body.id === 'string' ? body.id.trim() : undefined;
  }

  private buildDeleteResponseData(): { deleted: boolean } {
    return { deleted: true };
  }

  private async createCore(
    authorization: string | undefined,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCreateBody(body);
    const tenantId = this.getTenantId(req);
    return {
      success: true,
      data: await this.createEntity(parsedBody, this.getExplicitIdFromBody(parsedBody), tenantId),
    };
  }

  private async updateCore(
    authorization: string | undefined,
    id: string,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseUpdateBody(body);
    const tenantId = this.getTenantId(req);
    const updated = await this.updateEntity(parsedId, parsedBody, tenantId);
    if (!updated) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: updated };
  }

  private async removeCore(
    authorization: string | undefined,
    id: string,
    req: Request,
  ): Promise<{ success: true; data: { deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const deleted = await this.removeEntity(parsedId, tenantId);
    if (!deleted) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: this.buildDeleteResponseData() };
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

  private parseCreateBody(body: unknown): z.infer<typeof unattendProfileCreateSchema> {
    return this.parseWithSchema(
      unattendProfileCreateSchema,
      body,
      'PROVISIONING_INVALID_PROFILE_CREATE_BODY',
      'Invalid unattend profile create payload',
    );
  }

  private parseUpdateBody(body: unknown): z.infer<typeof unattendProfileUpdateSchema> {
    return this.parseWithSchema(
      unattendProfileUpdateSchema,
      body,
      'PROVISIONING_INVALID_PROFILE_UPDATE_BODY',
      'Invalid unattend profile update payload',
    );
  }

  private parseId(id: string): string {
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

  private getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'UNATTEND_PROFILE_NOT_FOUND',
      message: 'Unattend profile not found',
    };
  }

  private createEntity(
    body: z.infer<typeof unattendProfileCreateSchema>,
    _explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.provisioningService.createProfile(body, tenantId);
  }

  private updateEntity(
    id: string,
    body: z.infer<typeof unattendProfileUpdateSchema>,
    tenantId: string,
  ) {
    return this.provisioningService.updateProfile(id, body, tenantId);
  }

  private removeEntity(id: string, tenantId: string) {
    return this.provisioningService.deleteProfile(id, tenantId);
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
    @Body(unattendProfileCreateBodyPipe) body: z.infer<typeof unattendProfileCreateSchema>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.createCore(authorization, body, req);
  }

  @Put('unattend-profiles/:id')
  async updateProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param(unattendProfileIdParamPipe) params: UnattendProfileIdParamDto | string,
    @Body(unattendProfileUpdateBodyPipe) body: z.infer<typeof unattendProfileUpdateSchema>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.updateCore(
      authorization,
      typeof params === 'string' ? params : params.id,
      body,
      req,
    );
  }

  @Delete('unattend-profiles/:id')
  async deleteProfile(
    @Headers('authorization') authorization: string | undefined,
    @Param(unattendProfileIdParamPipe) params: UnattendProfileIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { deleted: boolean } }> {
    return this.removeCore(
      authorization,
      typeof params === 'string' ? params : params.id,
      req,
    ) as Promise<{
      success: true;
      data: { deleted: boolean };
    }>;
  }

  @Post('provisioning/generate-iso-payload')
  async generateIsoPayload(
    @Headers('authorization') authorization: string | undefined,
    @Body(provisioningGenerateBodyPipe) body: z.infer<typeof provisioningGenerateIsoPayloadSchema>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.assertGenerateBodyProfileSource(body);
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
  async validateToken(
    @Body(provisioningValidateBodyPipe) body: z.infer<typeof provisioningValidateTokenSchema>,
  ): Promise<{ success: true; data: unknown }> {
    const parsedBody = body;
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
  async reportProgress(
    @Body(provisioningReportBodyPipe) body: z.infer<typeof provisioningReportProgressSchema>,
  ): Promise<{ success: true; data: unknown }> {
    const parsedBody = body;
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
    @Param(provisioningVmUuidParamPipe) params: ProvisioningVmUuidParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedVmUuid = this.parseVmUuid(typeof params === 'string' ? params : params.vmUuid);
    const tenantId = this.getTenantId(req);
    return {
      success: true,
      data: await this.provisioningService.getProgress(parsedVmUuid, tenantId),
    };
  }

  private assertGenerateBodyProfileSource(
    body: z.infer<typeof provisioningGenerateIsoPayloadSchema>,
  ): z.infer<typeof provisioningGenerateIsoPayloadSchema> {
    if (!body.profile_id && !body.profile_config) {
      throw new BadRequestException({
        code: 'PROVISIONING_PROFILE_SOURCE_REQUIRED',
        message: 'Either profile_id or profile_config is required',
      });
    }
    return body;
  }
}
