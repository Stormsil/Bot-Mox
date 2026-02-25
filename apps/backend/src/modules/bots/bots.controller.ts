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
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { TenantCrudControllerCoreBase } from '../common/tenant-crud.controller-core-base';
import { type BotsListQuery, BotsService, BotsServiceValidationError } from './bots.service';

const botIdSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Bot id is required');

@Controller('bots')
export class BotsController extends TenantCrudControllerCoreBase<
  Record<string, unknown>,
  Record<string, unknown>
> {
  constructor(private readonly botsService: BotsService) {
    super();
  }

  protected parseId(id: string): string {
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

  protected parseCreateBody(body: unknown): Record<string, unknown> {
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

  protected parseUpdateBody(body: unknown): Record<string, unknown> {
    return this.parseCreateBody(body);
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

  protected getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'BOT_NOT_FOUND',
      message: 'Bot not found',
    };
  }

  protected getEntityById(id: string, tenantId: string) {
    return this.botsService.getById(id, tenantId);
  }

  protected createEntity(
    body: Record<string, unknown>,
    explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.botsService.create(body, explicitId, tenantId);
  }

  protected updateEntity(id: string, body: Record<string, unknown>, tenantId: string) {
    return this.botsService.patch(id, body, tenantId);
  }

  protected removeEntity(id: string, tenantId: string) {
    return this.botsService.remove(id, tenantId);
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
    const tenantId = this.getTenantId(req);
    const result = await this.botsService.list(parsedQuery, tenantId);
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
    return this.getOneCore(authorization, id, req);
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.createCore(authorization, body, req);
  }

  @Patch(':id')
  async patch(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.updateCore(authorization, id, body, req);
  }

  @Get(':id/lifecycle')
  async getLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const entity = await this.botsService.getById(parsedId, tenantId);
    if (!entity) {
      throw new NotFoundException({
        code: 'BOT_NOT_FOUND',
        message: 'Bot not found',
      });
    }
    return {
      success: true,
      data: await this.botsService.getLifecycle(parsedId, tenantId),
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
    const tenantId = this.getTenantId(req);
    const transitions = await this.botsService.getStageTransitions(parsedId, tenantId);
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
    const tenantId = this.getTenantId(req);
    const banned = await this.botsService.isBanned(parsedId, tenantId);
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
    const tenantId = this.getTenantId(req);

    try {
      const updated = await this.botsService.transition(parsedId, parsedBody.status, tenantId);
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
    const tenantId = this.getTenantId(req);
    const updated = await this.botsService.ban(parsedId, parsedBody, tenantId);
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
    const tenantId = this.getTenantId(req);

    try {
      const updated = await this.botsService.unban(parsedId, tenantId);
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
    return this.removeCore(authorization, id, req) as Promise<{
      success: true;
      data: { id: string; deleted: boolean };
    }>;
  }
}
