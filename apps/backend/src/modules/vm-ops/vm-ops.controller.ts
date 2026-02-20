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
import { getRequestIdentity } from '../auth/request-identity.util';
import { VmOpsService } from './vm-ops.service';

const SSE_HEARTBEAT_MS = 25_000;

@Controller('vm-ops')
export class VmOpsController {
  constructor(private readonly vmOpsService: VmOpsService) {}

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
    errorInfo: { code: string; message: string },
  ): T {
    const parsed = schema.safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: errorInfo.code,
        message: errorInfo.message,
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseDispatchBody(body: unknown) {
    return this.parseOrBadRequest(vmOpsDispatchBodySchema, body, {
      code: 'VM_OPS_INVALID_DISPATCH_BODY',
      message: 'Invalid vm-ops dispatch payload',
    });
  }

  private parseAction(action: string): string {
    return this.parseOrBadRequest(vmOpsActionSchema, String(action || '').trim(), {
      code: 'VM_OPS_INVALID_ACTION',
      message: 'Invalid vm-ops action',
    });
  }

  private async dispatchScopedCommand(input: {
    tenantId: string;
    namespace: 'proxmox' | 'syncthing';
    action: string;
    body: unknown;
  }): Promise<{ success: true; data: unknown }> {
    const parsed = this.parseDispatchBody(input.body);
    const normalizedAction = this.parseAction(input.action);
    const command = await this.vmOpsService.dispatch({
      tenantId: input.tenantId,
      agentId: parsed.agent_id,
      commandType: `${input.namespace}.${normalizedAction}`,
      payload: parsed.params ?? {},
    });
    return { success: true, data: command };
  }

  @Post('commands')
  @HttpCode(202)
  async createCommand(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const tenantId = this.resolveTenantId(authorization, req);
    const parsed = this.parseOrBadRequest(vmOpsCommandCreateSchema, body, {
      code: 'VM_OPS_INVALID_CREATE_BODY',
      message: 'Invalid vm-ops command create payload',
    });

    const command = await this.vmOpsService.dispatch({
      tenantId,
      agentId: parsed.agent_id,
      commandType: parsed.command_type,
      payload: parsed.payload ?? {},
      expiresInSeconds: parsed.expires_in_seconds,
    });

    return { success: true, data: command };
  }

  @Get('commands')
  async listCommands(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown[] }> {
    const tenantId = this.resolveTenantId(authorization, req);
    const parsed = this.parseOrBadRequest(vmOpsCommandListQuerySchema, query, {
      code: 'VM_OPS_INVALID_LIST_QUERY',
      message: 'Invalid vm-ops command list query',
    });

    const filters: { tenantId: string; agentId?: string; status?: string } = {
      tenantId,
    };
    if (parsed.agent_id) {
      filters.agentId = parsed.agent_id;
    }
    if (parsed.status) {
      filters.status = parsed.status;
    }

    const commands = await this.vmOpsService.listCommands(filters);

    return { success: true, data: commands };
  }

  @Get('commands/next')
  async getNextCommand(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown | null }> {
    const tenantId = this.resolveTenantId(authorization, req);
    const parsed = this.parseOrBadRequest(vmOpsCommandNextQuerySchema, query, {
      code: 'VM_OPS_INVALID_NEXT_QUERY',
      message: 'Invalid vm-ops next command query',
    });

    const waitInput: { tenantId: string; agentId: string; timeoutMs?: number } = {
      tenantId,
      agentId: parsed.agent_id,
    };
    if (parsed.timeout_ms !== undefined) {
      waitInput.timeoutMs = parsed.timeout_ms;
    }

    const command = await this.vmOpsService.waitForNextAgentCommand(waitInput);

    return { success: true, data: command };
  }

  @Post('proxmox/:action')
  @HttpCode(202)
  async dispatchProxmox(
    @Headers('authorization') authorization: string | undefined,
    @Param('action') action: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const tenantId = this.resolveTenantId(authorization, req);
    return this.dispatchScopedCommand({
      tenantId,
      namespace: 'proxmox',
      action,
      body,
    });
  }

  @Post('syncthing/:action')
  @HttpCode(202)
  async dispatchSyncthing(
    @Headers('authorization') authorization: string | undefined,
    @Param('action') action: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const tenantId = this.resolveTenantId(authorization, req);
    return this.dispatchScopedCommand({
      tenantId,
      namespace: 'syncthing',
      action,
      body,
    });
  }

  @Get('commands/:id')
  async getById(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const tenantId = this.resolveTenantId(authorization, req);
    const command = await this.vmOpsService.getById(String(id || '').trim(), tenantId);
    if (!command) {
      throw new NotFoundException({
        code: 'VM_OPS_COMMAND_NOT_FOUND',
        message: 'Command not found',
      });
    }
    return { success: true, data: command };
  }

  @Patch('commands/:id')
  async patchCommand(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const tenantId = this.resolveTenantId(authorization, req);
    const normalizedId = String(id || '').trim();
    if (!normalizedId) {
      throw new BadRequestException({
        code: 'VM_OPS_COMMAND_ID_REQUIRED',
        message: 'id is required',
      });
    }

    const parsed = this.parseOrBadRequest(vmOpsCommandUpdateSchema, body, {
      code: 'VM_OPS_INVALID_UPDATE_BODY',
      message: 'Invalid vm-ops command update payload',
    });

    const updateInput: {
      id: string;
      status: 'running' | 'succeeded' | 'failed';
      result?: unknown;
      errorMessage?: string;
    } = {
      id: normalizedId,
      status: parsed.status,
    };
    if (Object.hasOwn(parsed, 'result')) {
      updateInput.result = parsed.result;
    }
    if (parsed.error_message !== undefined) {
      updateInput.errorMessage = parsed.error_message;
    }

    const command = await this.vmOpsService.updateCommandStatus({
      ...updateInput,
      tenantId,
    });
    if (!command) {
      throw new NotFoundException({
        code: 'VM_OPS_COMMAND_NOT_FOUND',
        message: 'Command not found',
      });
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
    this.ensureAuthorizationHeader(authorization);

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
      throw new BadRequestException({
        code: 'VM_OPS_INVALID_QUERY_PARAM',
        message: `${key} must be a positive integer`,
      });
    }
    return value;
  }
}
