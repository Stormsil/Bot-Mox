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
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import {
  createBadRequestValidationPipe,
  ZodSchemaValidationPipe,
} from '../common/http-validation.util';
import { type BotsListQuery, BotsService, BotsServiceValidationError } from './bots.service';

const botIdSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Bot id is required');
const botIdParamPipe = createBadRequestValidationPipe('BOTS_INVALID_ID', 'Invalid bot id');
const botListQueryPipe = createBadRequestValidationPipe(
  'BOTS_INVALID_LIST_QUERY',
  'Invalid bots list query payload',
);
const botMutationBodyPipe = new ZodSchemaValidationPipe(
  botMutationSchema,
  'BOTS_INVALID_MUTATION_BODY',
  'Invalid bot mutation payload',
);
const botTransitionBodyPipe = new ZodSchemaValidationPipe(
  botLifecycleTransitionSchema,
  'BOTS_INVALID_TRANSITION_BODY',
  'Invalid bot transition payload',
);
const botBanBodyPipe = new ZodSchemaValidationPipe(
  botBanDetailsSchema,
  'BOTS_INVALID_BAN_BODY',
  'Invalid bot ban payload',
);

class BotIdParamDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(1)
  id!: string;
}

class BotListQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsString()
  @MinLength(1)
  sort?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value)))
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  q?: string;
}

@Controller('bots')
export class BotsController {
  constructor(private readonly botsService: BotsService) {
    // no-op
  }

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private getTenantId(req: Request): string {
    return getRequestIdentity(req).tenantId;
  }

  private getExplicitIdFromBody(body: Record<string, unknown>): string | undefined {
    return typeof body.id === 'string' ? body.id.trim() : undefined;
  }

  private buildDeleteResponseData(id: string): { id: string; deleted: boolean } {
    return { id, deleted: true };
  }

  private async getOneCore(
    authorization: string | undefined,
    id: string,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const entity = await this.getEntityById(parsedId, tenantId);
    if (!entity) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: entity };
  }

  private async createCore(
    authorization: string | undefined,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCreateBody(body);
    const tenantId = this.getTenantId(req);
    const explicitId = this.getExplicitIdFromBody(parsedBody);
    return {
      success: true,
      data: await this.createEntity(parsedBody, explicitId, tenantId),
    };
  }

  private async updateCore(
    authorization: string | undefined,
    id: string,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseUpdateBody(body);
    const tenantId = this.getTenantId(req);
    const updated = await this.updateEntity(parsedId, parsedBody, tenantId);
    if (!updated) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: updated };
  }

  private async removeCore(
    authorization: string | undefined,
    id: string,
    req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const deleted = await this.removeEntity(parsedId, tenantId);
    if (!deleted) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: this.buildDeleteResponseData(parsedId) };
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

  private parseCreateBody(body: unknown): Record<string, unknown> {
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

  private parseUpdateBody(body: unknown): Record<string, unknown> {
    return this.parseCreateBody(body);
  }

  private getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'BOT_NOT_FOUND',
      message: 'Bot not found',
    };
  }

  private getEntityById(id: string, tenantId: string) {
    return this.botsService.getById(id, tenantId);
  }

  private createEntity(
    body: Record<string, unknown>,
    explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.botsService.create(body, explicitId, tenantId);
  }

  private updateEntity(id: string, body: Record<string, unknown>, tenantId: string) {
    return this.botsService.patch(id, body, tenantId);
  }

  private removeEntity(id: string, tenantId: string) {
    return this.botsService.remove(id, tenantId);
  }

  @Get()
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Query(botListQueryPipe) query: BotListQueryDto,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
    meta: { total: number; page: number; limit: number };
  }> {
    this.ensureAuthHeader(authorization);
    const parsedQuery = this.parseListQuery(query as Record<string, unknown>);
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
    @Param(botIdParamPipe) params: BotIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.getOneCore(authorization, typeof params === 'string' ? params : params.id, req);
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body(botMutationBodyPipe) body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.createCore(authorization, body, req);
  }

  @Patch(':id')
  async patch(
    @Headers('authorization') authorization: string | undefined,
    @Param(botIdParamPipe) params: BotIdParamDto | string,
    @Body(botMutationBodyPipe) body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.updateCore(
      authorization,
      typeof params === 'string' ? params : params.id,
      body,
      req,
    );
  }

  @Get(':id/lifecycle')
  async getLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param(botIdParamPipe) params: BotIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(typeof params === 'string' ? params : params.id);
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
    @Param(botIdParamPipe) params: BotIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown[] }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(typeof params === 'string' ? params : params.id);
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
    @Param(botIdParamPipe) params: BotIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { banned: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(typeof params === 'string' ? params : params.id);
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
    @Param(botIdParamPipe) params: BotIdParamDto | string,
    @Body(botTransitionBodyPipe) body: {
      status: 'offline' | 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';
    },
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(typeof params === 'string' ? params : params.id);
    const parsedBody = body;
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
    @Param(botIdParamPipe) params: BotIdParamDto | string,
    @Body(botBanBodyPipe) body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(typeof params === 'string' ? params : params.id);
    const parsedBody = body;
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
    @Param(botIdParamPipe) params: BotIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(typeof params === 'string' ? params : params.id);
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
    @Param(botIdParamPipe) params: BotIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    return this.removeCore(
      authorization,
      typeof params === 'string' ? params : params.id,
      req,
    ) as Promise<{
      success: true;
      data: { id: string; deleted: boolean };
    }>;
  }
}
