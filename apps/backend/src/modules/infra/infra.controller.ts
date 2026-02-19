import {
  infraCloneRequestSchema,
  infraDeleteVmQuerySchema,
  infraNodePathSchema,
  infraNodeVmidPathSchema,
  infraSendKeyBodySchema,
  infraSshExecSchema,
  infraSshVmConfigPathSchema,
  infraTaskStatusPathSchema,
  infraVmActionPathSchema,
  infraVmConfigUpdateSchema,
  infraVmConfigWriteSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  Headers,
  InternalServerErrorException,
  NotFoundException,
  Param,
  Post,
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { InfraService, InfraServiceError } from './infra.service';

@Controller('infra')
export class InfraController {
  constructor(private readonly infraService: InfraService) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private mapInfraError(error: unknown): never {
    if (!(error instanceof InfraServiceError)) {
      throw error;
    }

    if (error.status === 400) {
      throw new BadRequestException(error.details ?? error.message);
    }
    if (error.status === 403) {
      throw new ForbiddenException(error.message);
    }
    if (error.status === 404) {
      throw new NotFoundException(error.message);
    }

    throw new InternalServerErrorException(error.message);
  }

  @Post('proxmox/login')
  proxmoxLogin(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    try {
      return {
        success: true,
        data: this.infraService.login(),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Get('proxmox/status')
  proxmoxStatus(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    try {
      return {
        success: true,
        data: this.infraService.status(),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Get('proxmox/nodes/:node/qemu')
  listNodeVms(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraNodePathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.listNodeVms(parsedPath.data.node),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Post('proxmox/nodes/:node/qemu/:vmid/clone')
  cloneVm(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraNodeVmidPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    const parsedBody = infraCloneRequestSchema.safeParse(body ?? {});
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.cloneVm({
          node: parsedPath.data.node,
          vmid: parsedPath.data.vmid,
          body: parsedBody.data,
        }),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Get('proxmox/nodes/:node/qemu/:vmid/config')
  getVmConfig(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraNodeVmidPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.getVmConfig(parsedPath.data.node, parsedPath.data.vmid),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Put('proxmox/nodes/:node/qemu/:vmid/config')
  updateVmConfig(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraNodeVmidPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    const parsedBody = infraVmConfigUpdateSchema.safeParse(body ?? {});
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.updateVmConfig({
          node: parsedPath.data.node,
          vmid: parsedPath.data.vmid,
          body: parsedBody.data,
        }),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Get('proxmox/nodes/:node/tasks/:upid/status')
  getTaskStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraTaskStatusPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.getTaskStatus(parsedPath.data.node, parsedPath.data.upid),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Post('proxmox/nodes/:node/qemu/:vmid/status/:action')
  vmAction(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraVmActionPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.vmAction(
          parsedPath.data.node,
          parsedPath.data.vmid,
          parsedPath.data.action,
        ),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Delete('proxmox/nodes/:node/qemu/:vmid')
  deleteVm(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraNodeVmidPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    const parsedQuery = infraDeleteVmQuerySchema.safeParse(query ?? {});
    if (!parsedQuery.success) {
      throw new BadRequestException(parsedQuery.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.deleteVm({
          node: parsedPath.data.node,
          vmid: parsedPath.data.vmid,
          purge: parsedQuery.data.purge,
          destroyUnreferencedDisks: parsedQuery.data['destroy-unreferenced-disks'],
        }),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Post('proxmox/nodes/:node/qemu/:vmid/sendkey')
  sendKey(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraNodeVmidPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    const parsedBody = infraSendKeyBodySchema.safeParse(body ?? {});
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.sendKey(
          parsedPath.data.node,
          parsedPath.data.vmid,
          parsedBody.data.key,
        ),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Get('proxmox/nodes/:node/qemu/:vmid/status/current')
  getVmCurrentStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraNodeVmidPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.getVmCurrentStatus(parsedPath.data.node, parsedPath.data.vmid),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Get('proxmox/cluster/resources')
  getClusterResources(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    try {
      return {
        success: true,
        data: this.infraService.getClusterResources(),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Post('ssh/test')
  sshTest(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    try {
      return {
        success: true,
        data: this.infraService.sshTest(),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Post('ssh/exec')
  sshExec(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedBody = infraSshExecSchema.safeParse(body ?? {});
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.execSsh({
          command: parsedBody.data.command,
          timeout: parsedBody.data.timeout,
        }),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Get('ssh/vm-config/:vmid')
  sshReadVmConfig(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraSshVmConfigPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.readVmConfig(parsedPath.data.vmid),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Put('ssh/vm-config/:vmid')
  sshWriteVmConfig(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthorization(authorization);

    const parsedPath = infraSshVmConfigPathSchema.safeParse(pathParams ?? {});
    if (!parsedPath.success) {
      throw new BadRequestException(parsedPath.error.flatten());
    }

    const parsedBody = infraVmConfigWriteSchema.safeParse(body ?? {});
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.flatten());
    }

    try {
      return {
        success: true,
        data: this.infraService.writeVmConfig({
          vmid: parsedPath.data.vmid,
          content: parsedBody.data.content,
        }),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }
}
