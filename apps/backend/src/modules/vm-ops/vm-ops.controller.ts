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
  ConflictException,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpException,
  NotFoundException,
  Optional,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AgentsService } from '../agents/agents.service';
import { getRequestIdentity } from '../auth/request-identity.util';
import { isPrismaMissingStorageError } from '../common/prisma-soft-fail';
import { RuntimeMetricsService } from '../observability/runtime-metrics.service';
import { VmOpsService } from './vm-ops.service';

const SSE_HEARTBEAT_MS = 25_000;

@Controller('vm-ops')
export class VmOpsController {
  private readonly activeAgentMaxIdleMs = (() => {
    const raw = Number.parseInt(
      String(process.env.VM_OPS_ACTIVE_AGENT_MAX_IDLE_MS || '120000').trim(),
      10,
    );
    if (!Number.isFinite(raw) || raw <= 0) {
      return 120_000;
    }
    return Math.max(10_000, Math.min(3_600_000, raw));
  })();

  constructor(
    private readonly vmOpsService: VmOpsService,
    @Optional() private readonly agentsService?: AgentsService,
    @Optional() private readonly runtimeMetricsService?: RuntimeMetricsService,
  ) {}

  private isAgentIdentity(roles: string[] | undefined): boolean {
    const normalized = Array.isArray(roles)
      ? roles
          .map((role) =>
            String(role || '')
              .trim()
              .toLowerCase(),
          )
          .filter(Boolean)
      : [];
    return normalized.includes('agent');
  }

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

  private getHttpExceptionCode(error: unknown): string {
    if (!(error instanceof HttpException)) {
      return '';
    }
    const response = error.getResponse();
    if (response && typeof response === 'object' && 'code' in response) {
      return String((response as { code?: unknown }).code ?? '').trim();
    }
    return '';
  }

  private tryBuildLegacyProxmoxReadFallback(action: string, error: unknown): unknown | undefined {
    const code = this.getHttpExceptionCode(error);
    if (code !== 'AGENT_OFFLINE' && code !== 'VM_OPS_UNAVAILABLE') {
      return undefined;
    }

    const normalizedAction = String(action || '')
      .trim()
      .toLowerCase();

    if (normalizedAction === 'status') {
      return {
        connected: false,
        agent_online: false,
        degraded: true,
        reason: code,
      };
    }

    if (
      normalizedAction === 'list-vms' ||
      normalizedAction === 'cluster-resources' ||
      normalizedAction === 'list-targets'
    ) {
      return [];
    }

    return undefined;
  }

  private async dispatchScopedCommand(input: {
    tenantId: string;
    namespace: 'proxmox' | 'syncthing';
    action: string;
    body: unknown;
  }): Promise<{ success: true; data: unknown }> {
    const parsed = this.parseDispatchBody(input.body);
    const normalizedAction = this.parseAction(input.action);
    try {
      const command = await this.vmOpsService.dispatch({
        tenantId: input.tenantId,
        agentId: parsed.agent_id,
        commandType: `${input.namespace}.${normalizedAction}`,
        payload: parsed.params ?? {},
      });
      return { success: true, data: command };
    } catch (error) {
      this.rethrowIfVmOpsStorageUnavailable(error);
      throw error;
    }
  }

  private rethrowIfVmOpsStorageUnavailable(error: unknown): void {
    if (!isPrismaMissingStorageError(error)) {
      return;
    }
    throw new ConflictException({
      code: 'VM_OPS_UNAVAILABLE',
      message: 'VM operations storage is not initialized yet',
    });
  }

  private parseLegacyParams(query: Record<string, unknown>): Record<string, unknown> {
    const raw = query.params;
    if (raw === undefined) {
      return {};
    }

    const source = Array.isArray(raw) ? raw[0] : raw;
    if (source === undefined || source === null || source === '') {
      return {};
    }
    if (typeof source === 'object') {
      return { ...(source as Record<string, unknown>) };
    }

    try {
      const parsed = JSON.parse(String(source));
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        throw new Error('params must be object');
      }
      return { ...(parsed as Record<string, unknown>) };
    } catch {
      throw new BadRequestException({
        code: 'VM_OPS_INVALID_LEGACY_PARAMS',
        message: 'params must be a valid JSON object',
      });
    }
  }

  private parseLegacyTimeoutMs(query: Record<string, unknown>): number {
    const timeoutMs =
      this.readNonNegativeInt(query, 'timeout_ms') ??
      this.readNonNegativeInt(query, 'timeoutMs') ??
      30_000;
    return Math.max(1_000, Math.min(120_000, timeoutMs));
  }

  private parseLegacyInlineParams(query: Record<string, unknown>): Record<string, unknown> {
    const reservedKeys = new Set(['agent_id', 'agentId', 'params', 'timeout_ms', 'timeoutMs']);
    const result: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(query)) {
      if (reservedKeys.has(key)) {
        continue;
      }
      if (Array.isArray(value)) {
        result[key] = value.length > 0 ? value[0] : null;
        continue;
      }
      result[key] = value;
    }

    return result;
  }

  private async resolveLegacyAgentId(
    tenantId: string,
    query: Record<string, unknown>,
  ): Promise<string> {
    const explicitAgentId =
      this.readOptionalQueryString(query, 'agent_id') ??
      this.readOptionalQueryString(query, 'agentId');
    if (explicitAgentId) {
      return explicitAgentId;
    }
    if (!this.agentsService) {
      throw new ConflictException({
        code: 'AGENT_OFFLINE',
        message: 'No active agent available for this tenant',
      });
    }

    const activeAgents = await this.agentsService.list('active', tenantId);
    const nowMs = Date.now();
    const freshActiveAgents = activeAgents.filter((agent) => {
      const seenAtRaw = String(agent.last_seen_at || '').trim();
      if (!seenAtRaw) {
        return false;
      }
      const seenAtMs = new Date(seenAtRaw).getTime();
      if (!Number.isFinite(seenAtMs)) {
        return false;
      }
      return nowMs - seenAtMs <= this.activeAgentMaxIdleMs;
    });

    if (!freshActiveAgents.length) {
      throw new ConflictException({
        code: 'AGENT_OFFLINE',
        message: 'No active agent available for this tenant',
      });
    }

    const pick = freshActiveAgents.slice().sort((left, right) => {
      const leftSeen = left.last_seen_at ? new Date(left.last_seen_at).getTime() : 0;
      const rightSeen = right.last_seen_at ? new Date(right.last_seen_at).getTime() : 0;
      return rightSeen - leftSeen;
    })[0];
    if (!pick) {
      throw new ConflictException({
        code: 'AGENT_OFFLINE',
        message: 'No active agent available for this tenant',
      });
    }
    return String(pick.id || '').trim();
  }

  private async waitForTerminalCommand(
    commandId: string,
    tenantId: string,
    timeoutMs: number,
  ): Promise<{
    status: string;
    result: unknown;
    errorMessage: string | null;
  }> {
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const command = await this.vmOpsService.getById(commandId, tenantId);
      if (!command) {
        throw new NotFoundException({
          code: 'VM_OPS_COMMAND_NOT_FOUND',
          message: 'Command not found',
        });
      }

      const status = String(command.status || '')
        .trim()
        .toLowerCase();
      if (status === 'succeeded') {
        return {
          status,
          result: command.result ?? null,
          errorMessage: command.error_message ?? null,
        };
      }
      if (status === 'failed' || status === 'expired' || status === 'cancelled') {
        throw new BadRequestException({
          code: 'VM_OPS_COMMAND_FAILED',
          message: 'Legacy vm-ops command failed',
          details: {
            command_id: command.id,
            status,
            error_message: command.error_message ?? null,
            result: command.result ?? null,
          },
        });
      }

      await new Promise((resolve) => setTimeout(resolve, 300));
    }

    throw new BadRequestException({
      code: 'VM_OPS_COMMAND_TIMEOUT',
      message: 'Legacy vm-ops command timed out',
      details: { timeout_ms: timeoutMs },
    });
  }

  private async executeLegacyProxmoxRead(
    tenantId: string,
    action: string,
    query: Record<string, unknown>,
  ): Promise<unknown> {
    const agentId = await this.resolveLegacyAgentId(tenantId, query);
    const timeoutMs = this.parseLegacyTimeoutMs(query);
    const jsonParams = this.parseLegacyParams(query);
    const inlineParams = this.parseLegacyInlineParams(query);
    const payload = {
      ...inlineParams,
      ...jsonParams,
    };

    try {
      const command = await this.vmOpsService.dispatch({
        tenantId,
        agentId,
        commandType: `proxmox.${this.parseAction(action)}`,
        payload,
      });

      const completed = await this.waitForTerminalCommand(command.id, tenantId, timeoutMs);
      return completed.result;
    } catch (error) {
      this.rethrowIfVmOpsStorageUnavailable(error);
      throw error;
    }
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

    try {
      const command = await this.vmOpsService.dispatch({
        tenantId,
        agentId: parsed.agent_id,
        commandType: parsed.command_type,
        payload: parsed.payload ?? {},
        expiresInSeconds: parsed.expires_in_seconds,
      });

      return { success: true, data: command };
    } catch (error) {
      this.rethrowIfVmOpsStorageUnavailable(error);
      throw error;
    }
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

    let commands: unknown[];
    try {
      commands = await this.vmOpsService.listCommands(filters);
    } catch (error) {
      this.rethrowIfVmOpsStorageUnavailable(error);
      throw error;
    }

    return { success: true, data: commands };
  }

  @Get('commands/next')
  async getNextCommand(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown | null }> {
    const tenantId = this.resolveTenantId(authorization, req);
    const identity = getRequestIdentity(req);
    const parsed = this.parseOrBadRequest(vmOpsCommandNextQuerySchema, query, {
      code: 'VM_OPS_INVALID_NEXT_QUERY',
      message: 'Invalid vm-ops next command query',
    });
    if (this.isAgentIdentity(identity.roles)) {
      const tokenAgentId = String(identity.raw?.agent_id || '').trim();
      if (!tokenAgentId || tokenAgentId !== parsed.agent_id) {
        throw new UnauthorizedException({
          code: 'AGENT_ID_MISMATCH',
          message: 'agent_id does not match authenticated agent token',
        });
      }
    }

    const waitInput: { tenantId: string; agentId: string; timeoutMs?: number } = {
      tenantId,
      agentId: parsed.agent_id,
    };
    if (parsed.timeout_ms !== undefined) {
      waitInput.timeoutMs = parsed.timeout_ms;
    }

    let command: unknown | null;
    try {
      command = await this.vmOpsService.waitForNextAgentCommand(waitInput);
    } catch (error) {
      this.rethrowIfVmOpsStorageUnavailable(error);
      throw error;
    }

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

  @Get('proxmox/:action')
  async dispatchProxmoxLegacyGet(
    @Headers('authorization') authorization: string | undefined,
    @Param('action') action: string,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const tenantId = this.resolveTenantId(authorization, req);
    let data: unknown;
    try {
      data = await this.executeLegacyProxmoxRead(tenantId, action, query);
    } catch (error) {
      const fallback = this.tryBuildLegacyProxmoxReadFallback(action, error);
      if (fallback !== undefined) {
        return { success: true, data: fallback };
      }
      throw error;
    }
    return { success: true, data };
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
    let command: unknown | null;
    try {
      command = await this.vmOpsService.getById(String(id || '').trim(), tenantId);
    } catch (error) {
      this.rethrowIfVmOpsStorageUnavailable(error);
      throw error;
    }
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
    const identity = getRequestIdentity(req);
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

    if (this.isAgentIdentity(identity.roles)) {
      const tokenAgentId = String(identity.raw?.agent_id || '').trim();
      let existing: Awaited<ReturnType<VmOpsService['getById']>>;
      try {
        existing = await this.vmOpsService.getById(normalizedId, tenantId);
      } catch (error) {
        this.rethrowIfVmOpsStorageUnavailable(error);
        throw error;
      }
      if (!existing || !tokenAgentId || String(existing.agent_id || '').trim() !== tokenAgentId) {
        throw new NotFoundException({
          code: 'VM_OPS_COMMAND_NOT_FOUND',
          message: 'Command not found',
        });
      }
    }

    let command: Awaited<ReturnType<VmOpsService['updateCommandStatus']>>;
    try {
      command = await this.vmOpsService.updateCommandStatus({
        ...updateInput,
        tenantId,
        ...(this.isAgentIdentity(identity.roles)
          ? { agentId: String(identity.raw?.agent_id || '').trim() }
          : {}),
      });
    } catch (error) {
      this.rethrowIfVmOpsStorageUnavailable(error);
      throw error;
    }
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
    const lastEventId = this.readNonNegativeInt(query, 'last_event_id') ?? 0;

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
      this.runtimeMetricsService?.increment(
        `vmops.sse.comment.${String(comment || 'unknown')
          .trim()
          .toLowerCase()}`,
      );
      res.write(`: ${comment.replace(/\r?\n/g, ' ')}\n\n`);
    };

    const writeEvent = (event: unknown): void => {
      const payload = JSON.stringify(event);
      const parsed = event as { event_id?: number; event_type?: string };
      this.runtimeMetricsService?.increment('vmops.sse.events.sent');
      this.runtimeMetricsService?.increment(
        `vmops.sse.events.type.${String(parsed.event_type || 'vm-command')
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '_')}`,
      );
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
    this.runtimeMetricsService?.onSseOpened();

    if (lastEventId > 0) {
      const replay = this.vmOpsService.listEventsSince(lastEventId);
      for (const event of replay) {
        if (!canReceive(event)) {
          this.runtimeMetricsService?.increment('vmops.sse.events.filtered_out');
          continue;
        }
        this.runtimeMetricsService?.increment('vmops.sse.events.replay');
        writeEvent(event);
      }
    }

    const unsubscribe = this.vmOpsService.subscribeEvents((event) => {
      if (!canReceive(event)) {
        this.runtimeMetricsService?.increment('vmops.sse.events.filtered_out');
        return;
      }
      this.runtimeMetricsService?.increment('vmops.sse.events.live');
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
      this.runtimeMetricsService?.onSseClosed();
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

  private readNonNegativeInt(
    query: Record<string, unknown>,
    key: string,
    allowZero = true,
  ): number | undefined {
    const normalized = this.readOptionalQueryString(query, key);
    if (!normalized) {
      return undefined;
    }

    const value = Number.parseInt(normalized, 10);
    if (!Number.isFinite(value) || value < 0 || (!allowZero && value === 0)) {
      throw new BadRequestException({
        code: 'VM_OPS_INVALID_QUERY_PARAM',
        message: `${key} must be ${allowZero ? 'a non-negative integer' : 'a positive integer'}`,
      });
    }
    return value;
  }
}
