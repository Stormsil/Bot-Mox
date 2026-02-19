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
  UnauthorizedException,
} from '@nestjs/common';
import { VmService } from './vm.service';

@Controller('vm')
export class VmController {
  constructor(private readonly vmService: VmService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  @Post('register')
  register(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);

    const parsedBody = vmRegisterSchema.safeParse(body ?? {});
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.flatten());
    }

    const fallbackUserId = 'user-1';
    const resolvedUserId = String(parsedBody.data.user_id || '').trim() || fallbackUserId;

    const created = this.vmService.registerVm({
      tenantId: 'default',
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
  resolve(
    @Headers('authorization') authorization: string | undefined,
    @Param('uuid') uuid: string,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);

    const parsedPath = vmResolvePathSchema.safeParse({ uuid });
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    const record = this.vmService.resolveVm(parsedPath.data.uuid);
    if (!record) {
      throw new NotFoundException('VM UUID not found');
    }

    return {
      success: true,
      data: record,
    };
  }
}
