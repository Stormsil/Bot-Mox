import { vmRegisterSchema, vmResolvePathSchema } from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';
import { VmService } from './vm.service';

@Controller('vm')
export class VmController {
  constructor(private readonly vmService: VmService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  @Post('register')
  async register(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);

    const parsedBody = vmRegisterSchema.safeParse(body ?? {});
    if (!parsedBody.success) {
      throw new BadRequestException({
        code: 'VM_REGISTER_INVALID_BODY',
        message: 'Invalid VM register payload',
        details: parsedBody.error.flatten(),
      });
    }

    const fallbackUserId = 'user-1';
    const resolvedUserId = String(parsedBody.data.user_id || '').trim() || fallbackUserId;

    const created = await this.vmService.registerVm({
      tenantId: identity.tenantId,
      userId: resolvedUserId,
      vmUuid: parsedBody.data.vm_uuid,
      vmName: parsedBody.data.vm_name,
      projectId: parsedBody.data.project_id,
      status: parsedBody.data.status,
      metadata: parsedBody.data.metadata,
    });

    return {
      success: true,
      data: created,
    };
  }

  @Get(':uuid/resolve')
  async resolve(
    @Headers('authorization') authorization: string | undefined,
    @Param('uuid') uuid: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);

    const parsedPath = vmResolvePathSchema.safeParse({ uuid });
    if (!parsedPath.success) {
      throw new BadRequestException({
        code: 'VM_RESOLVE_INVALID_PATH',
        message: 'Invalid VM resolve path',
        details: parsedPath.error.flatten(),
      });
    }

    const record = await this.vmService.resolveVm(parsedPath.data.uuid, identity.tenantId);
    if (!record) {
      throw new NotFoundException({
        code: 'VM_UUID_NOT_FOUND',
        message: 'VM UUID not found',
      });
    }

    return {
      success: true,
      data: record,
    };
  }
}
