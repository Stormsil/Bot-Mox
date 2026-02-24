import {
  agentHeartbeatSchema,
  agentListQuerySchema,
  agentPairingCreateSchema,
  agentQuickPairSchema,
  agentRepairSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  InternalServerErrorException,
  Optional,
  Post,
  Query,
  Req,
  ConflictException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { AdminAuditService } from '../admin-audit/admin-audit.service';
import { AuthService } from '../auth/auth.service';
import { isPrismaMissingStorageError } from '../common/prisma-soft-fail';
import { setRequestTenantId } from '../auth/request-context';
import { getRequestIdentity } from '../auth/request-identity.util';
import { AgentsService } from './agents.service';

type AgentListQuery = z.infer<typeof agentListQuerySchema>;
type AgentPairingCreate = z.infer<typeof agentPairingCreateSchema>;
type AgentHeartbeat = z.infer<typeof agentHeartbeatSchema>;
type AgentQuickPair = z.infer<typeof agentQuickPairSchema>;
type AgentRepair = z.infer<typeof agentRepairSchema>;

@Controller('agents')
export class AgentsController {
  constructor(
    private readonly agentsService: AgentsService,
    private readonly authService: AuthService,
    @Optional() private readonly adminAuditService?: AdminAuditService,
  ) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseListQuery(query: Record<string, unknown>) {
    const parsed = agentListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AGENTS_LIST_INVALID_QUERY',
        message: 'Invalid agents list query',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data as AgentListQuery;
  }

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

  private rethrowIfAgentStorageUnavailable(error: unknown): void {
    if (!isPrismaMissingStorageError(error)) {
      return;
    }
    throw new ConflictException({
      code: 'AGENTS_STORAGE_UNAVAILABLE',
      message: 'Agents storage is not initialized yet',
    });
  }

  private async logAuditBestEffort(input: Parameters<AdminAuditService['log']>[0]): Promise<void> {
    if (!this.adminAuditService) {
      return;
    }
    try {
      await this.adminAuditService.log(input);
    } catch (error) {
      if (isPrismaMissingStorageError(error)) {
        return;
      }
      throw new InternalServerErrorException({
        code: 'ADMIN_AUDIT_LOG_FAILED',
        message: 'Failed to write admin audit event',
      });
    }
  }

  @Get()
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
  }> {
    this.ensureAuthorization(authorization);
    const parsedQuery = this.parseListQuery(query);
    const identity = getRequestIdentity(req);

    return {
      success: true,
      data: await this.agentsService.list(parsedQuery.status, identity.tenantId),
    };
  }

  @Post('pairings')
  async createPairing(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const parsed = agentPairingCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AGENTS_PAIRING_INVALID_BODY',
        message: 'Invalid agents pairing payload',
        details: parsed.error.flatten(),
      });
    }
    const pairingInput = parsed.data as AgentPairingCreate;
    const identity = getRequestIdentity(req);

    return {
      success: true,
      data: await this.agentsService.createPairing({
        tenantId: identity.tenantId,
        ...(pairingInput.name !== undefined ? { name: pairingInput.name } : {}),
        ...(pairingInput.expires_in_minutes !== undefined
          ? { expiresInMinutes: pairingInput.expires_in_minutes }
          : {}),
      }),
    };
  }

  @Post('heartbeat')
  async heartbeat(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const parsed = agentHeartbeatSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AGENTS_HEARTBEAT_INVALID_BODY',
        message: 'Invalid agents heartbeat payload',
        details: parsed.error.flatten(),
      });
    }
    const heartbeat = parsed.data as AgentHeartbeat;
    const identity = getRequestIdentity(req);
    if (!this.isAgentIdentity(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AGENT_TOKEN_REQUIRED',
        message: 'Agent token is required for heartbeat endpoint',
      });
    }

    const tokenAgentId = String(identity.raw?.agent_id || '').trim();
    if (!tokenAgentId || tokenAgentId !== heartbeat.agent_id) {
      throw new UnauthorizedException({
        code: 'AGENT_ID_MISMATCH',
        message: 'agent_id does not match authenticated agent token',
      });
    }

    const record = await this.agentsService.heartbeat({
      tenantId: identity.tenantId,
      agentId: heartbeat.agent_id,
      status: heartbeat.status,
      metadata: heartbeat.metadata ?? {},
    });
    return { success: true, data: record };
  }

  @Post('quick-pair')
  async quickPair(@Body() body: unknown): Promise<{ success: true; data: unknown }> {
    const parsed = agentQuickPairSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AGENTS_QUICK_PAIR_INVALID_BODY',
        message: 'Invalid quick-pair payload',
        details: parsed.error.flatten(),
      });
    }

    const payload = parsed.data as AgentQuickPair;
    const signedIn = await this.authService.signInWithPassword({
      login: payload.login,
      password: payload.password,
    });
    setRequestTenantId(signedIn.identity.tenantId);

    let created: Awaited<ReturnType<AgentsService['createQuickPairAgent']>>;
    try {
      created = await this.agentsService.createQuickPairAgent({
        tenantId: signedIn.identity.tenantId,
        userId: signedIn.identity.uid,
        ...(payload.name !== undefined ? { name: payload.name } : {}),
        ...(payload.machine_name !== undefined ? { machineName: payload.machine_name } : {}),
        ...(payload.version !== undefined ? { version: payload.version } : {}),
        ...(payload.platform !== undefined ? { platform: payload.platform } : {}),
        ...(payload.capabilities !== undefined ? { capabilities: payload.capabilities } : {}),
      });
    } catch (error) {
      this.rethrowIfAgentStorageUnavailable(error);
      throw error;
    }

    const issuedAgentToken = await this.authService.issueAgentToken({
      tenantId: signedIn.identity.tenantId,
      agentId: created.id,
      pairedByUserId: signedIn.identity.uid,
    });
    await this.logAuditBestEffort({
        actorUserId: signedIn.identity.uid,
        actorTenantId: signedIn.identity.tenantId,
        action: 'agents.quick_pair',
        targetTenantId: signedIn.identity.tenantId,
        payload: {
          agent_id: created.id,
          machine_name: payload.machine_name ?? null,
          platform: payload.platform ?? null,
          version: payload.version ?? null,
        },
      });

    return {
      success: true,
      data: {
        ...created,
        agent_token: issuedAgentToken.token,
        agent_token_expires_at: issuedAgentToken.expiresAt,
      },
    };
  }

  @Post('repair')
  async repair(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const parsed = agentRepairSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'AGENTS_REPAIR_INVALID_BODY',
        message: 'Invalid agent repair payload',
        details: parsed.error.flatten(),
      });
    }

    const identity = getRequestIdentity(req);
    const payload = parsed.data as AgentRepair;
    const repaired = await this.agentsService.repair({
      tenantId: identity.tenantId,
      agentId: payload.agent_id,
      repairedBy: identity.userId,
      ...(payload.reason !== undefined ? { reason: payload.reason } : {}),
      ...(payload.expires_in_minutes !== undefined
        ? { expiresInMinutes: payload.expires_in_minutes }
        : {}),
    });
    await this.logAuditBestEffort({
        actorUserId: identity.userId,
        actorTenantId: identity.tenantId,
        action: 'agents.repair',
        targetTenantId: identity.tenantId,
        payload: {
          agent_id: payload.agent_id,
          reason: payload.reason ?? null,
        },
      });
    return {
      success: true,
      data: repaired,
    };
  }
}
