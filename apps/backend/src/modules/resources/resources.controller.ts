import {
  resourceKindSchema,
  resourceListQuerySchema,
  resourceMutationSchema,
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
  Put,
  Query,
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { type ResourceListQuery, ResourcesService } from './resources.service';

const resourceIdSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Resource id is required');

@Controller('resources')
export class ResourcesController {
  constructor(private readonly resourcesService: ResourcesService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseKind(kind: string): 'licenses' | 'proxies' | 'subscriptions' {
    const parsed = resourceKindSchema.safeParse(String(kind || '').trim());
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseId(id: string): string {
    const parsed = resourceIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseBody(body: unknown): Record<string, unknown> {
    const parsed = resourceMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseListQuery(query: Record<string, unknown>): ResourceListQuery {
    const parsed = resourceListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  @Get(':kind')
  list(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Query() query: Record<string, unknown>,
  ): { success: true; data: unknown[]; meta: { total: number; page: number; limit: number } } {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedQuery = this.parseListQuery(query);
    const result = this.resourcesService.list(parsedKind, parsedQuery);

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

  @Get(':kind/:id')
  getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedId = this.parseId(id);
    const entity = this.resourcesService.getById(parsedKind, parsedId);

    if (!entity) {
      throw new NotFoundException('Resource not found');
    }

    return {
      success: true,
      data: entity,
    };
  }

  @Post(':kind')
  create(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedBody = this.parseBody(body);
    const explicitId = typeof parsedBody.id === 'string' ? parsedBody.id : undefined;

    return {
      success: true,
      data: this.resourcesService.create(parsedKind, parsedBody, explicitId),
    };
  }

  @Patch(':kind/:id')
  update(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseBody(body);
    const updated = this.resourcesService.update(parsedKind, parsedId, parsedBody);

    if (!updated) {
      throw new NotFoundException('Resource not found');
    }

    return {
      success: true,
      data: updated,
    };
  }

  @Put(':kind/:id')
  upsertAlias(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    return this.update(authorization, kind, id, body);
  }

  @Delete(':kind/:id')
  remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Param('id') id: string,
  ): { success: true; data: { id: string; deleted: boolean } } {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedId = this.parseId(id);
    const deleted = this.resourcesService.remove(parsedKind, parsedId);

    if (!deleted) {
      throw new NotFoundException('Resource not found');
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
