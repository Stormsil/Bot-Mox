import { vmPatchApplyBodySchema, vmPatchPlanBodySchema } from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';
import { InfraService } from './infra.service';
import type { VmPatchApplyInput, VmPatchPlanInput } from './infra.types';

@Controller('vms')
export class InfraVmsController {
  constructor(private readonly infraService: InfraService) {}

  private ensureAuthorizationHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private resolveTenantId(authorization: string | undefined, req: Request): string {
    this.ensureAuthorizationHeader(authorization);
    return getRequestIdentity(req).tenantId;
  }

  @Post('patch/plan')
  async patchPlan(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const tenantId = this.resolveTenantId(authorization, req);
    const parsed = vmPatchPlanBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VM_PATCH_PLAN_INVALID_BODY',
        message: 'Invalid VM patch plan payload',
        details: parsed.error.flatten(),
      });
    }

    if (!Object.hasOwn(parsed.data, 'vmid')) {
      throw new BadRequestException({
        code: 'VM_PATCH_PLAN_INVALID_BODY',
        message: 'Invalid VM patch plan payload',
      });
    }

    const data = await this.infraService.planVmConfigPatch(
      tenantId,
      parsed.data as VmPatchPlanInput,
    );
    return {
      success: true,
      data,
    };
  }

  @Post('patch/apply')
  async patchApply(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const tenantId = this.resolveTenantId(authorization, req);
    const parsed = vmPatchApplyBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'VM_PATCH_APPLY_INVALID_BODY',
        message: 'Invalid VM patch apply payload',
        details: parsed.error.flatten(),
      });
    }

    if (!Object.hasOwn(parsed.data, 'vmid')) {
      throw new BadRequestException({
        code: 'VM_PATCH_APPLY_INVALID_BODY',
        message: 'Invalid VM patch apply payload',
      });
    }

    const data = await this.infraService.applyVmConfigPatch(
      tenantId,
      parsed.data as VmPatchApplyInput,
    );
    return {
      success: true,
      data,
    };
  }
}
