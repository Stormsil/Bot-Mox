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
  UnauthorizedException,
} from '@nestjs/common';
import type { z } from 'zod';
import { AgentsService } from './agents.service';

type AgentListQuery = z.infer<typeof agentListQuerySchema>;
type AgentPairingCreate = z.infer<typeof agentPairingCreateSchema>;
type AgentHeartbeat = z.infer<typeof agentHeartbeatSchema>;

@Controller('agents')
export class AgentsController {
  constructor(private readonly agentsService: AgentsService) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseListQuery(query: Record<string, unknown>) {
    const parsed = agentListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data as AgentListQuery;
  }

  @Get()
  list(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
  ): {
    success: true;
    data: unknown[];
  } {
    this.ensureAuthorization(authorization);
    const parsedQuery = this.parseListQuery(query);

    return {
      success: true,
      data: this.agentsService.list(parsedQuery.status),
    };
  }

  @Post('pairings')
  createPairing(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsed = agentPairingCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const pairingInput = parsed.data as AgentPairingCreate;

    return {
      success: true,
      data: this.agentsService.createPairing({
        ...(pairingInput.name !== undefined ? { name: pairingInput.name } : {}),
        ...(pairingInput.expires_in_minutes !== undefined
          ? { expiresInMinutes: pairingInput.expires_in_minutes }
          : {}),
      }),
    };
  }

  @Post('heartbeat')
  heartbeat(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsed = agentHeartbeatSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    const heartbeat = parsed.data as AgentHeartbeat;

    const record = this.agentsService.heartbeat({
      agentId: heartbeat.agent_id,
      status: heartbeat.status,
      metadata: heartbeat.metadata ?? {},
    });
    return { success: true, data: record };
  }
}
