import {
  workspaceCalendarMutationSchema,
  workspaceKanbanMutationSchema,
  workspaceKindSchema,
  workspaceListQuerySchema,
  workspaceNotesMutationSchema,
} from '@botmox/api-contract';
import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
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
const workspaceListQueryZodPipe = new ZodSchemaValidationPipe(
  workspaceListQuerySchema,
  'WORKSPACE_INVALID_LIST_QUERY',
  'Invalid workspace list query',
);
const workspaceNotesBodyPipe = new ZodSchemaValidationPipe(
  workspaceNotesMutationSchema,
  'WORKSPACE_INVALID_BODY',
  'Invalid workspace payload',
);
const workspaceCalendarBodyPipe = new ZodSchemaValidationPipe(
  workspaceCalendarMutationSchema,
  'WORKSPACE_INVALID_BODY',
  'Invalid workspace payload',
);
const workspaceKanbanBodyPipe = new ZodSchemaValidationPipe(
  workspaceKanbanMutationSchema,
  'WORKSPACE_INVALID_BODY',
  'Invalid workspace payload',
);
const workspaceBodyPipeByKind = {
  notes: workspaceNotesBodyPipe,
  calendar: workspaceCalendarBodyPipe,
  kanban: workspaceKanbanBodyPipe,
} as const;

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
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Query(workspaceListQueryPipe, workspaceListQueryZodPipe) query: WorkspaceListQueryDto,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
    meta: { total: number; page: number; limit: number };
  }> {
    const parsedKind = kind as WorkspaceKind;
    const parsedQuery = query as WorkspaceListQuery;
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
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Param('id', workspaceIdStringPipe) id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
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
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const parsedKind = kind as WorkspaceKind;
    const parsedBody = workspaceBodyPipeByKind[parsedKind].transform(body) as Record<
      string,
      unknown
    >;
    const tenantId = this.getTenantId(req);
    const explicitId = this.getExplicitIdFromBody(parsedBody);
    return {
      success: true,
      data: await this.workspaceService.create(parsedKind, parsedBody, explicitId, tenantId),
    };
  }

  @Patch(':kind/:id')
  async update(
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Param('id', workspaceIdStringPipe) id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const parsedKind = kind as WorkspaceKind;
    const parsedBody = workspaceBodyPipeByKind[parsedKind].transform(body) as Record<
      string,
      unknown
    >;
    const tenantId = this.getTenantId(req);
    const updated = await this.workspaceService.update(parsedKind, id, parsedBody, tenantId);
    if (!updated) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: updated };
  }

  @Delete(':kind/:id')
  async remove(
    @Param('kind', workspaceKindStringPipe) kind: string,
    @Param('id', workspaceIdStringPipe) id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { id: string; deleted: boolean } }> {
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
}
