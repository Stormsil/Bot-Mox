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
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';
import { InfraServiceError } from './infra.errors';
import { InfraService } from './infra.service';

@Controller('infra')
export class InfraController {
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

  private parseOrBadRequest<T>(
    schema: {
      safeParse: (
        input: unknown,
      ) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } };
    },
    input: unknown,
    errorInfo?: { code: string; message: string },
  ): T {
    const parsed = schema.safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: errorInfo?.code ?? 'INFRA_INVALID_REQUEST',
        message: errorInfo?.message ?? 'Invalid infra request payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private mapInfraError(error: unknown): never {
    if (!(error instanceof InfraServiceError)) {
      throw error;
    }

    if (error.status === 400) {
      throw new BadRequestException({
        code: error.code || 'INFRA_BAD_REQUEST',
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      });
    }
    if (error.status === 403) {
      throw new ForbiddenException({
        code: error.code || 'INFRA_FORBIDDEN',
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      });
    }
    if (error.status === 404) {
      throw new NotFoundException({
        code: error.code || 'INFRA_NOT_FOUND',
        message: error.message,
        ...(error.details !== undefined ? { details: error.details } : {}),
      });
    }

    throw new InternalServerErrorException({
      code: error.code || 'INFRA_INTERNAL_ERROR',
      message: error.message,
      ...(error.details !== undefined ? { details: error.details } : {}),
    });
  }

  private async handle<T>(
    authorization: string | undefined,
    req: Request,
    operation: (tenantId: string) => Promise<T>,
  ): Promise<{ success: true; data: T }> {
    const tenantId = this.resolveTenantId(authorization, req);
    try {
      return {
        success: true,
        data: await operation(tenantId),
      };
    } catch (error) {
      this.mapInfraError(error);
    }
  }

  @Post('proxmox/login')
  async proxmoxLogin(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ) {
    return this.handle(authorization, req, async (tenantId) => this.infraService.login(tenantId));
  }

  @Get('proxmox/status')
  async proxmoxStatus(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ) {
    return this.handle(authorization, req, async (tenantId) => this.infraService.status(tenantId));
  }

  @Get('proxmox/nodes/:node/qemu')
  async listNodeVms(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraNodePathSchema, pathParams);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.listNodeVms(tenantId, parsedPath.node),
    );
  }

  @Post('proxmox/nodes/:node/qemu/:vmid/clone')
  async cloneVm(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraNodeVmidPathSchema, pathParams);
    const parsedBody = this.parseOrBadRequest(infraCloneRequestSchema, body);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.cloneVm(tenantId, {
        node: parsedPath.node,
        vmid: parsedPath.vmid,
        body: parsedBody,
      }),
    );
  }

  @Get('proxmox/nodes/:node/qemu/:vmid/config')
  async getVmConfig(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraNodeVmidPathSchema, pathParams);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.getVmConfig(tenantId, parsedPath.node, parsedPath.vmid),
    );
  }

  @Put('proxmox/nodes/:node/qemu/:vmid/config')
  async updateVmConfig(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraNodeVmidPathSchema, pathParams);
    const parsedBody = this.parseOrBadRequest(infraVmConfigUpdateSchema, body);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.updateVmConfig(tenantId, {
        node: parsedPath.node,
        vmid: parsedPath.vmid,
        body: parsedBody,
      }),
    );
  }

  @Get('proxmox/nodes/:node/tasks/:upid/status')
  async getTaskStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraTaskStatusPathSchema, pathParams);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.getTaskStatus(tenantId, parsedPath.node, parsedPath.upid),
    );
  }

  @Post('proxmox/nodes/:node/qemu/:vmid/status/:action')
  async vmAction(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraVmActionPathSchema, pathParams);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.vmAction(tenantId, parsedPath.node, parsedPath.vmid, parsedPath.action),
    );
  }

  @Delete('proxmox/nodes/:node/qemu/:vmid')
  async deleteVm(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraNodeVmidPathSchema, pathParams);
    const parsedQuery = this.parseOrBadRequest(infraDeleteVmQuerySchema, query);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.deleteVm(tenantId, {
        node: parsedPath.node,
        vmid: parsedPath.vmid,
        purge: parsedQuery.purge,
        destroyUnreferencedDisks: parsedQuery['destroy-unreferenced-disks'],
      }),
    );
  }

  @Post('proxmox/nodes/:node/qemu/:vmid/sendkey')
  async sendKey(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraNodeVmidPathSchema, pathParams);
    const parsedBody = this.parseOrBadRequest(infraSendKeyBodySchema, body);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.sendKey(tenantId, parsedPath.node, parsedPath.vmid, parsedBody.key),
    );
  }

  @Get('proxmox/nodes/:node/qemu/:vmid/status/current')
  async getVmCurrentStatus(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraNodeVmidPathSchema, pathParams);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.getVmCurrentStatus(tenantId, parsedPath.node, parsedPath.vmid),
    );
  }

  @Get('proxmox/cluster/resources')
  async getClusterResources(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ) {
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.getClusterResources(tenantId),
    );
  }

  @Post('ssh/test')
  async sshTest(@Headers('authorization') authorization: string | undefined, @Req() req: Request) {
    return this.handle(authorization, req, async (tenantId) => this.infraService.sshTest(tenantId));
  }

  @Post('ssh/exec')
  async sshExec(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsedBody = this.parseOrBadRequest(infraSshExecSchema, body);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.execSsh(tenantId, {
        command: parsedBody.command,
        timeout: parsedBody.timeout,
      }),
    );
  }

  @Get('ssh/vm-config/:vmid')
  async sshReadVmConfig(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraSshVmConfigPathSchema, pathParams);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.readVmConfig(tenantId, parsedPath.vmid),
    );
  }

  @Put('ssh/vm-config/:vmid')
  async sshWriteVmConfig(
    @Headers('authorization') authorization: string | undefined,
    @Param() pathParams: Record<string, unknown>,
    @Body() body: unknown,
    @Req() req: Request,
  ) {
    const parsedPath = this.parseOrBadRequest(infraSshVmConfigPathSchema, pathParams);
    const parsedBody = this.parseOrBadRequest(infraVmConfigWriteSchema, body);
    return this.handle(authorization, req, async (tenantId) =>
      this.infraService.writeVmConfig(tenantId, {
        vmid: parsedPath.vmid,
        content: parsedBody.content,
      }),
    );
  }
}
