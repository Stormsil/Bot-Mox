import { vmOpsActionSchema, vmOpsDispatchBodySchema } from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import type { VmOpsService } from './vm-ops.service';

@Controller('vm-ops')
export class VmOpsController {
  constructor(private readonly vmOpsService: VmOpsService) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseDispatchBody(body: unknown) {
    const parsed = vmOpsDispatchBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseAction(action: string): string {
    const parsed = vmOpsActionSchema.safeParse(String(action || '').trim());
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  @Post('commands')
  dispatch(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsed = this.parseDispatchBody(body);
    const command = this.vmOpsService.dispatch({
      agentId: parsed.agent_id,
      commandType: 'vm.generic',
      payload: parsed.params ?? {},
    });
    return { success: true, data: command };
  }

  @Post('proxmox/:action')
  @HttpCode(202)
  dispatchProxmox(
    @Headers('authorization') authorization: string | undefined,
    @Param('action') action: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsed = this.parseDispatchBody(body);
    const normalizedAction = this.parseAction(action);

    const command = this.vmOpsService.dispatch({
      agentId: parsed.agent_id,
      commandType: `proxmox.${normalizedAction}`,
      payload: parsed.params ?? {},
    });
    return { success: true, data: command };
  }

  @Post('syncthing/:action')
  @HttpCode(202)
  dispatchSyncthing(
    @Headers('authorization') authorization: string | undefined,
    @Param('action') action: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsed = this.parseDispatchBody(body);
    const normalizedAction = this.parseAction(action);

    const command = this.vmOpsService.dispatch({
      agentId: parsed.agent_id,
      commandType: `syncthing.${normalizedAction}`,
      payload: parsed.params ?? {},
    });
    return { success: true, data: command };
  }

  @Get('commands/:id')
  getById(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const command = this.vmOpsService.getById(String(id || '').trim());
    if (!command) {
      throw new NotFoundException('Command not found');
    }
    return { success: true, data: command };
  }
}
