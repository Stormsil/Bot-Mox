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
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
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
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseKind(kind: string): 'licenses' | 'proxies' | 'subscriptions' {
    const parsed = resourceKindSchema.safeParse(String(kind || '').trim());
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'RESOURCES_INVALID_KIND',
        message: 'Invalid resource kind',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseId(id: string): string {
    const parsed = resourceIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'RESOURCES_INVALID_ID',
        message: 'Invalid resource id',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseBody(body: unknown): Record<string, unknown> {
    const parsed = resourceMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'RESOURCES_INVALID_BODY',
        message: 'Invalid resource payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseListQuery(query: Record<string, unknown>): ResourceListQuery {
    const parsed = resourceListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'RESOURCES_INVALID_LIST_QUERY',
        message: 'Invalid resources list query',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  @Get(':kind')
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
    meta: { total: number; page: number; limit: number };
  }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedQuery = this.parseListQuery(query);
    const identity = getRequestIdentity(req);
    const result = await this.resourcesService.list(parsedKind, parsedQuery, identity.tenantId);

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
  async getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const entity = await this.resourcesService.getById(parsedKind, parsedId, identity.tenantId);

    if (!entity) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
      });
    }

    return {
      success: true,
      data: entity,
    };
  }

  @Post(':kind')
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedBody = this.parseBody(body);
    const explicitId = typeof parsedBody.id === 'string' ? parsedBody.id : undefined;
    const identity = getRequestIdentity(req);

    return {
      success: true,
      data: await this.resourcesService.create(
        parsedKind,
        parsedBody,
        explicitId,
        identity.tenantId,
      ),
    };
  }

  @Patch(':kind/:id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseBody(body);
    const identity = getRequestIdentity(req);
    const updated = await this.resourcesService.update(
      parsedKind,
      parsedId,
      parsedBody,
      identity.tenantId,
    );

    if (!updated) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
      });
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
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.update(authorization, kind, id, body, req);
  }

  @Delete(':kind/:id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind') kind: string,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseKind(kind);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const deleted = await this.resourcesService.remove(parsedKind, parsedId, identity.tenantId);

    if (!deleted) {
      throw new NotFoundException({
        code: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
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
