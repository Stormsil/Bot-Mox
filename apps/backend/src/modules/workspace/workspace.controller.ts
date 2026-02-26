import {
  workspaceCalendarMutationSchema,
  workspaceKanbanMutationSchema,
  workspaceKindSchema,
  workspaceListQuerySchema,
  workspaceNotesMutationSchema,
} from '@botmox/api-contract';
import { Transform, Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
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
import { getRequestIdentity } from '../auth/request-identity.util';
import {
  createBadRequestValidationPipe,
  ZodSchemaValidationPipe,
} from '../common/http-validation.util';
import { buildTrimmedIdSchema } from '../common/zod-http-parse';
import { type WorkspaceKind, type WorkspaceListQuery, WorkspaceService } from './workspace.service';

const workspaceKindStringPipe = new ZodSchemaValidationPipe(
  workspaceKindSchema,
  'WORKSPACE_INVALID_KIND',
  'Invalid workspace kind',
);
const workspaceIdStringPipe = new ZodSchemaValidationPipe(
  buildTrimmedIdSchema('Workspace id'),
  'WORKSPACE_INVALID_ID',
  'Invalid workspace id',
);
const workspaceListQueryPipe = createBadRequestValidationPipe(
  'WORKSPACE_INVALID_LIST_QUERY',
  'Invalid workspace list query',
);

class WorkspaceListQueryDto {
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

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

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
      code: 'WORKSPACE_ENTITY_NOT_FOUND',
      message: 'Workspace entity not found',
    };
  }

  @Get(':kind')
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Query(workspaceListQueryPipe) query: WorkspaceListQueryDto,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
    meta: { total: number; page: number; limit: number };
  }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = kind as WorkspaceKind;
    const parsedQuery = this.parseZodListQuery(query);
    const tenantId = this.getTenantId(req);
    const result = await this.workspaceService.list(parsedKind, parsedQuery, tenantId);
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
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Param('id', workspaceIdStringPipe) id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = kind as WorkspaceKind;
    const parsedId = id;
    const tenantId = this.getTenantId(req);
    const entity = await this.workspaceService.getById(parsedKind, parsedId, tenantId);
    if (!entity) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: entity };
  }

  @Post(':kind')
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = kind as WorkspaceKind;
    const parsedBody = this.parseBodyWithKind(parsedKind, body);
    const tenantId = this.getTenantId(req);
    const explicitId = this.getExplicitIdFromBody(parsedBody);
    return {
      success: true,
      data: await this.workspaceService.create(parsedKind, parsedBody, explicitId, tenantId),
    };
  }

  @Patch(':kind/:id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Param('id', workspaceIdStringPipe) id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = kind as WorkspaceKind;
    const parsedId = id;
    const parsedBody = this.parseBodyWithKind(parsedKind, body);
    const tenantId = this.getTenantId(req);
    const updated = await this.workspaceService.update(parsedKind, parsedId, parsedBody, tenantId);
    if (!updated) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: updated };
  }

  @Delete(':kind/:id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Param('id', workspaceIdStringPipe) id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedKind = kind as WorkspaceKind;
    const parsedId = id;
    const tenantId = this.getTenantId(req);
    const deleted = await this.workspaceService.remove(parsedKind, parsedId, tenantId);
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

  private parseZodListQuery(query: WorkspaceListQueryDto): WorkspaceListQuery {
    const parsed = workspaceListQuerySchema.safeParse(query);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'WORKSPACE_INVALID_LIST_QUERY',
        message: 'Invalid workspace list query',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseBodyWithKind(kind: WorkspaceKind, body: unknown): Record<string, unknown> {
    const schema =
      kind === 'notes'
        ? workspaceNotesMutationSchema
        : kind === 'calendar'
          ? workspaceCalendarMutationSchema
          : workspaceKanbanMutationSchema;
    const pipe = new ZodSchemaValidationPipe(schema, 'WORKSPACE_INVALID_BODY', 'Invalid workspace payload');
    return pipe.transform(body) as Record<string, unknown>;
  }
}
