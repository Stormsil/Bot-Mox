import {
  botBanDetailsSchema,
  botLifecycleTransitionSchema,
  botListQuerySchema,
  botMutationSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { type BotsListQuery, BotsService, BotsServiceValidationError } from './bots.service';

const botIdSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Bot id is required');

@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseId(id: string): string {
    const parsed = botIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'BOTS_INVALID_ID',
        message: 'Invalid bot id',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseListQuery(query: Record<string, unknown>): BotsListQuery {
    const parsed = botListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'BOTS_INVALID_LIST_QUERY',
        message: 'Invalid bots list query payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseMutationBody(body: unknown): Record<string, unknown> {
    const parsed = botMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'BOTS_INVALID_MUTATION_BODY',
        message: 'Invalid bot mutation payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseTransitionBody(body: unknown): {
    status: 'offline' | 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';
  } {
    const parsed = botLifecycleTransitionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'BOTS_INVALID_TRANSITION_BODY',
        message: 'Invalid bot transition payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseBanBody(body: unknown): Record<string, unknown> {
    const parsed = botBanDetailsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'BOTS_INVALID_BAN_BODY',
        message: 'Invalid bot ban payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  @Get()
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
    meta: { total: number; page: number; limit: number };
  }> {
    this.ensureAuthHeader(authorization);
    const parsedQuery = this.parseListQuery(query);
    const identity = getRequestIdentity(req);
    const result = await this.botsService.list(parsedQuery, identity.tenantId);
    return {
      success: true,
      data: result.items,
      meta: {
        total: result.total,
        page: result.page,
        limit: result.limit,
      },
    };
  }

  @Get(':id')
  async getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const entity = await this.botsService.getById(parsedId, identity.tenantId);
    if (!entity) {
      throw new NotFoundException({
        code: 'BOT_NOT_FOUND',
        message: 'Bot not found',
      });
    }
    return {
      success: true,
      data: entity,
    };
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseMutationBody(body);
    const explicitId = typeof parsedBody.id === 'string' ? parsedBody.id.trim() : undefined;
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.botsService.create(parsedBody, explicitId, identity.tenantId),
    };
  }

  @Patch(':id')
  async patch(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseMutationBody(body);
    const identity = getRequestIdentity(req);
    const updated = await this.botsService.patch(parsedId, parsedBody, identity.tenantId);
    if (!updated) {
      throw new NotFoundException({
        code: 'BOT_NOT_FOUND',
        message: 'Bot not found',
      });
    }
    return {
      success: true,
      data: updated,
    };
  }

  @Get(':id/lifecycle')
  async getLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const entity = await this.botsService.getById(parsedId, identity.tenantId);
    if (!entity) {
      throw new NotFoundException({
        code: 'BOT_NOT_FOUND',
        message: 'Bot not found',
      });
    }
    return {
      success: true,
      data: await this.botsService.getLifecycle(parsedId, identity.tenantId),
    };
  }

  @Get(':id/lifecycle/transitions')
  async getLifecycleTransitions(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown[] }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const transitions = await this.botsService.getStageTransitions(parsedId, identity.tenantId);
    if (!transitions) {
      throw new NotFoundException({
        code: 'BOT_NOT_FOUND',
        message: 'Bot not found',
      });
    }
    return {
      success: true,
      data: transitions,
    };
  }

  @Get(':id/lifecycle/is-banned')
  async isLifecycleBanned(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { banned: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const banned = await this.botsService.isBanned(parsedId, identity.tenantId);
    if (banned === null) {
      throw new NotFoundException({
        code: 'BOT_NOT_FOUND',
        message: 'Bot not found',
      });
    }
    return {
      success: true,
      data: {
        banned,
      },
    };
  }

  @Post(':id/lifecycle/transition')
  async transitionLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseTransitionBody(body);
    const identity = getRequestIdentity(req);

    try {
      const updated = await this.botsService.transition(
        parsedId,
        parsedBody.status,
        identity.tenantId,
      );
      if (!updated) {
        throw new NotFoundException({
          code: 'BOT_NOT_FOUND',
          message: 'Bot not found',
        });
      }
      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BotsServiceValidationError) {
        throw new BadRequestException({
          code: 'BOTS_TRANSITION_VALIDATION_FAILED',
          message: error.message,
        });
      }
      throw error;
    }
  }

  @Post(':id/lifecycle/ban')
  async banLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseBanBody(body);
    const identity = getRequestIdentity(req);
    const updated = await this.botsService.ban(parsedId, parsedBody, identity.tenantId);
    if (!updated) {
      throw new NotFoundException({
        code: 'BOT_NOT_FOUND',
        message: 'Bot not found',
      });
    }
    return {
      success: true,
      data: updated,
    };
  }

  @Post(':id/lifecycle/unban')
  async unbanLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);

    try {
      const updated = await this.botsService.unban(parsedId, identity.tenantId);
      if (!updated) {
        throw new NotFoundException({
          code: 'BOT_NOT_FOUND',
          message: 'Bot not found',
        });
      }
      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BotsServiceValidationError) {
        throw new BadRequestException({
          code: 'BOTS_UNBAN_VALIDATION_FAILED',
          message: error.message,
        });
      }
      throw error;
    }
  }

  @Delete(':id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const deleted = await this.botsService.remove(parsedId, identity.tenantId);
    if (!deleted) {
      throw new NotFoundException({
        code: 'BOT_NOT_FOUND',
        message: 'Bot not found',
      });
    }
    return {
      success: true,
      data: {
        id: parsedId,
        deleted: true,
      },
    };
  }
}
