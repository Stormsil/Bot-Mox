import {
  vmOpsActionSchema,
  vmOpsCommandCreateSchema,
  vmOpsCommandListQuerySchema,
  vmOpsCommandNextQuerySchema,
  vmOpsCommandUpdateSchema,
  vmOpsDispatchBodySchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { VmOpsService } from './vm-ops.service';

const SSE_HEARTBEAT_MS = 25_000;

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
  @HttpCode(202)
  createCommand(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsed = vmOpsCommandCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const command = this.vmOpsService.dispatch({
      agentId: parsed.data.agent_id,
      commandType: parsed.data.command_type,
      payload: parsed.data.payload ?? {},
      expiresInSeconds: parsed.data.expires_in_seconds,
    });

    return { success: true, data: command };
  }

  @Get('commands')
  listCommands(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
  ): { success: true; data: unknown[] } {
    this.ensureAuthorization(authorization);
    const parsed = vmOpsCommandListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const filters: { agentId?: string; status?: string } = {};
    if (parsed.data.agent_id) {
      filters.agentId = parsed.data.agent_id;
    }
    if (parsed.data.status) {
      filters.status = parsed.data.status;
    }

    const commands = this.vmOpsService.listCommands(filters);

    return { success: true, data: commands };
  }

  @Get('commands/next')
  async getNextCommand(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
  ): Promise<{ success: true; data: unknown | null }> {
    this.ensureAuthorization(authorization);
    const parsed = vmOpsCommandNextQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const waitInput: { agentId: string; timeoutMs?: number } = {
      agentId: parsed.data.agent_id,
    };
    if (parsed.data.timeout_ms !== undefined) {
      waitInput.timeoutMs = parsed.data.timeout_ms;
    }

    const command = await this.vmOpsService.waitForNextAgentCommand(waitInput);

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

  @Patch('commands/:id')
  patchCommand(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const normalizedId = String(id || '').trim();
    if (!normalizedId) {
      throw new BadRequestException('id is required');
    }

    const parsed = vmOpsCommandUpdateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const updateInput: {
      id: string;
      status: 'running' | 'succeeded' | 'failed';
      result?: unknown;
      errorMessage?: string;
    } = {
      id: normalizedId,
      status: parsed.data.status,
    };
    if (Object.hasOwn(parsed.data, 'result')) {
      updateInput.result = parsed.data.result;
    }
    if (parsed.data.error_message !== undefined) {
      updateInput.errorMessage = parsed.data.error_message;
    }

    const command = this.vmOpsService.updateCommandStatus(updateInput);
    if (!command) {
      throw new NotFoundException('Command not found');
    }

    return { success: true, data: command };
  }

  @Get('events')
  streamEvents(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
    @Res() res: Response,
  ): void {
    this.ensureAuthorization(authorization);

    const requestedAgentId = this.readOptionalQueryString(query, 'agent_id');
    const requestedCommandId = this.readOptionalQueryString(query, 'command_id');
    const lastEventId = this.readPositiveInt(query, 'last_event_id') ?? 0;

    const canReceive = (event: {
      command?: { agent_id?: string; id?: string } | null;
    }): boolean => {
      const eventAgentId = String(event.command?.agent_id || '').trim();
      const eventCommandId = String(event.command?.id || '').trim();
      if (requestedAgentId && eventAgentId !== requestedAgentId) {
        return false;
      }
      if (requestedCommandId && eventCommandId !== requestedCommandId) {
        return false;
      }
      return true;
    };

    const writeComment = (comment: string): void => {
      res.write(`: ${comment.replace(/\r?\n/g, ' ')}\n\n`);
    };

    const writeEvent = (event: unknown): void => {
      const payload = JSON.stringify(event);
      const parsed = event as { event_id?: number; event_type?: string };
      res.write(`id: ${Number(parsed.event_id || 0)}\n`);
      res.write(`event: ${String(parsed.event_type || 'vm-command')}\n`);
      res.write(`data: ${payload}\n\n`);
    };

    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    if (typeof res.flushHeaders === 'function') {
      res.flushHeaders();
    }

    writeComment('connected');

    if (lastEventId > 0) {
      const replay = this.vmOpsService.listEventsSince(lastEventId);
      for (const event of replay) {
        if (!canReceive(event)) {
          continue;
        }
        writeEvent(event);
      }
    }

    const unsubscribe = this.vmOpsService.subscribeEvents((event) => {
      if (!canReceive(event)) {
        return;
      }
      writeEvent(event);
    });

    const heartbeat = setInterval(() => {
      writeComment('heartbeat');
    }, SSE_HEARTBEAT_MS);

    let cleaned = false;
    const cleanup = (): void => {
      if (cleaned) {
        return;
      }
      cleaned = true;
      clearInterval(heartbeat);
      unsubscribe();
    };

    req.on('close', cleanup);
    req.on('aborted', cleanup);
    res.on('close', cleanup);
    res.on('finish', cleanup);
  }

  private readOptionalQueryString(query: Record<string, unknown>, key: string): string | undefined {
    const raw = query[key];
    const value = Array.isArray(raw) ? raw[0] : raw;
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private readPositiveInt(query: Record<string, unknown>, key: string): number | undefined {
    const normalized = this.readOptionalQueryString(query, key);
    if (!normalized) {
      return undefined;
    }

    const value = Number.parseInt(normalized, 10);
    if (!Number.isFinite(value) || value <= 0) {
      throw new BadRequestException(`${key} must be a positive integer`);
    }
    return value;
  }
}
