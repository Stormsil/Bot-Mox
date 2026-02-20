import {
  agentHeartbeatSchema,
  agentListQuerySchema,
  agentPairingCreateSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { AgentsService } from './agents.service';

type AgentListQuery = z.infer<typeof agentListQuerySchema>;
type AgentPairingCreate = z.infer<typeof agentPairingCreateSchema>;
type AgentHeartbeat = z.infer<typeof agentHeartbeatSchema>;

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

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

    const record = await this.agentsService.heartbeat({
      tenantId: identity.tenantId,
      agentId: heartbeat.agent_id,
      status: heartbeat.status,
      metadata: heartbeat.metadata ?? {},
    });
    return { success: true, data: record };
  }
}
