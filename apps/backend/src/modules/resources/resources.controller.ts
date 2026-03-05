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
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';
import {
  createBadRequestValidationPipe,
  ZodSchemaValidationPipe,
} from '../common/http-validation.util';
import { buildTrimmedIdSchema } from '../common/zod-http-parse';
import { type ResourceListQuery, ResourcesService } from './resources.service';

type ResourceKind = 'licenses' | 'proxies' | 'subscriptions';

const resourceListQueryPipe = createBadRequestValidationPipe(
  'RESOURCES_INVALID_LIST_QUERY',
  'Invalid resources list query',
);
const resourceKindBodylessPipe = new ZodSchemaValidationPipe(
  resourceKindSchema,
  'RESOURCES_INVALID_KIND',
  'Invalid resource kind',
);
const resourceIdStringPipe = new ZodSchemaValidationPipe(
  buildTrimmedIdSchema('Resource id'),
  'RESOURCES_INVALID_ID',
  'Invalid resource id',
);
const resourceMutationBodyPipe = new ZodSchemaValidationPipe(
  resourceMutationSchema,
  'RESOURCES_INVALID_BODY',
  'Invalid resource payload',
);

class ResourceListQueryDto {
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

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  @MinLength(1)
  status?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  @MinLength(1)
  type?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  @MinLength(1)
  country?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  @MinLength(1)
  country_code?: string;

  @IsOptional()
  @Transform(({ value }) => (value == null ? value : String(value).trim()))
  @IsString()
  @MinLength(1)
  bot_id?: string;
}

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

  private getTenantId(req: Request): string {
    return getRequestIdentity(req).tenantId;
  }

  private getExplicitIdFromBody(body: Record<string, unknown>): string | undefined {
    return typeof body.id === 'string' ? body.id.trim() : undefined;
  }

  private getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
    };
  }

  @Get('status-aggregate')
  async statusAggregate(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const tenantId = this.getTenantId(req);
    return {
      success: true,
      data: await this.resourcesService.getStatusAggregates(tenantId),
    };
  }

  @Get(':kind')
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind', resourceKindBodylessPipe) kind: string,
    @Query(resourceListQueryPipe) query: ResourceListQueryDto,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
    meta: { total: number; page: number; limit: number };
  }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseZodKind(kind);
    const parsedQuery = this.parseZodListQuery(query);
    const tenantId = this.getTenantId(req);
    const result = await this.resourcesService.list(parsedKind, parsedQuery, tenantId);
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
    @Param('kind', resourceKindBodylessPipe) kind: string,
    @Param('id', resourceIdStringPipe) id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseZodKind(kind);
    const parsedId = id;
    const tenantId = this.getTenantId(req);
    const entity = await this.resourcesService.getById(parsedKind, parsedId, tenantId);
    if (!entity) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: entity };
  }

  @Post(':kind')
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind', resourceKindBodylessPipe) kind: string,
    @Body(resourceMutationBodyPipe) body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseZodKind(kind);
    const parsedBody = body;
    const tenantId = this.getTenantId(req);
    const explicitId = this.getExplicitIdFromBody(parsedBody);
    return {
      success: true,
      data: await this.resourcesService.create(parsedKind, parsedBody, explicitId, tenantId),
    };
  }

  @Patch(':kind/:id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind', resourceKindBodylessPipe) kind: string,
    @Param('id', resourceIdStringPipe) id: string,
    @Body(resourceMutationBodyPipe) body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseZodKind(kind);
    const parsedId = id;
    const parsedBody = body;
    const tenantId = this.getTenantId(req);
    const updated = await this.resourcesService.update(parsedKind, parsedId, parsedBody, tenantId);
    if (!updated) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: updated };
  }

  @Delete(':kind/:id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind', resourceKindBodylessPipe) kind: string,
    @Param('id', resourceIdStringPipe) id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = this.parseZodKind(kind);
    const parsedId = id;
    const tenantId = this.getTenantId(req);
    const deleted = await this.resourcesService.remove(parsedKind, parsedId, tenantId);
    if (!deleted) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return {
      success: true,
      data: {
        id: parsedId,
        deleted: true,
      },
    };
  }

  @Put(':kind/:id')
  upsertAlias(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind', resourceKindBodylessPipe) kind: string,
    @Param('id', resourceIdStringPipe) id: string,
    @Body(resourceMutationBodyPipe) body: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.update(authorization, kind, id, body, req);
  }

  private parseZodKind(kind: string): ResourceKind {
    const parsed = resourceKindSchema.safeParse(kind);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'RESOURCES_INVALID_KIND',
        message: 'Invalid resource kind',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseZodListQuery(query: ResourceListQueryDto): ResourceListQuery {
    const parsed = resourceListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'RESOURCES_INVALID_LIST_QUERY',
        message: 'Invalid resources list query',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
}
