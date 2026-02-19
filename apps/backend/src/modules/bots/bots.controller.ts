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
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
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
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseId(id: string): string {
    const parsed = botIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseListQuery(query: Record<string, unknown>): BotsListQuery {
    const parsed = botListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseMutationBody(body: unknown): Record<string, unknown> {
    const parsed = botMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseTransitionBody(body: unknown): {
    status: 'offline' | 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';
  } {
    const parsed = botLifecycleTransitionSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseBanBody(body: unknown): Record<string, unknown> {
    const parsed = botBanDetailsSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  @Get()
  list(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
  ): { success: true; data: unknown[]; meta: { total: number; page: number; limit: number } } {
    this.ensureAuthHeader(authorization);
    const parsedQuery = this.parseListQuery(query);
    const result = this.botsService.list(parsedQuery);
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
  getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const entity = this.botsService.getById(parsedId);
    if (!entity) {
      throw new NotFoundException('Bot not found');
    }
    return {
      success: true,
      data: entity,
    };
  }

  @Post()
  create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseMutationBody(body);
    const explicitId = typeof parsedBody.id === 'string' ? parsedBody.id.trim() : undefined;
    return {
      success: true,
      data: this.botsService.create(parsedBody, explicitId),
    };
  }

  @Patch(':id')
  patch(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseMutationBody(body);
    const updated = this.botsService.patch(parsedId, parsedBody);
    if (!updated) {
      throw new NotFoundException('Bot not found');
    }
    return {
      success: true,
      data: updated,
    };
  }

  @Get(':id/lifecycle')
  getLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const entity = this.botsService.getById(parsedId);
    if (!entity) {
      throw new NotFoundException('Bot not found');
    }
    return {
      success: true,
      data: this.botsService.getLifecycle(parsedId),
    };
  }

  @Get(':id/lifecycle/transitions')
  getLifecycleTransitions(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: unknown[] } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const transitions = this.botsService.getStageTransitions(parsedId);
    if (!transitions) {
      throw new NotFoundException('Bot not found');
    }
    return {
      success: true,
      data: transitions,
    };
  }

  @Get(':id/lifecycle/is-banned')
  isLifecycleBanned(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: { banned: boolean } } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const banned = this.botsService.isBanned(parsedId);
    if (banned === null) {
      throw new NotFoundException('Bot not found');
    }
    return {
      success: true,
      data: {
        banned,
      },
    };
  }

  @Post(':id/lifecycle/transition')
  transitionLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseTransitionBody(body);

    try {
      const updated = this.botsService.transition(parsedId, parsedBody.status);
      if (!updated) {
        throw new NotFoundException('Bot not found');
      }
      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BotsServiceValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Post(':id/lifecycle/ban')
  banLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseBanBody(body);
    const updated = this.botsService.ban(parsedId, parsedBody);
    if (!updated) {
      throw new NotFoundException('Bot not found');
    }
    return {
      success: true,
      data: updated,
    };
  }

  @Post(':id/lifecycle/unban')
  unbanLifecycle(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);

    try {
      const updated = this.botsService.unban(parsedId);
      if (!updated) {
        throw new NotFoundException('Bot not found');
      }
      return {
        success: true,
        data: updated,
      };
    } catch (error) {
      if (error instanceof NotFoundException) throw error;
      if (error instanceof BotsServiceValidationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  @Delete(':id')
  remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: { id: string; deleted: boolean } } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const deleted = this.botsService.remove(parsedId);
    if (!deleted) {
      throw new NotFoundException('Bot not found');
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
