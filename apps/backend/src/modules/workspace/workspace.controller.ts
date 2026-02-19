import {
  workspaceCalendarMutationSchema,
  workspaceKanbanMutationSchema,
  workspaceKindSchema,
  workspaceListQuerySchema,
  workspaceNotesMutationSchema,
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
import { type WorkspaceKind, type WorkspaceListQuery, WorkspaceService } from './workspace.service';

const workspaceIdSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Workspace id is required');

@Controller('workspace')
export class WorkspaceController {
  constructor(private readonly workspaceService: WorkspaceService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseKind(kind: string): WorkspaceKind {
    const parsed = workspaceKindSchema.safeParse(String(kind || '').trim());
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data as WorkspaceKind;
  }

  private parseId(id: string): string {
    const parsed = workspaceIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseListQuery(query: Record<string, unknown>): WorkspaceListQuery {
    const parsed = workspaceListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseBody(kind: WorkspaceKind, body: unknown): Record<string, unknown> {
    const schema =
      kind === 'notes'
        ? workspaceNotesMutationSchema
        : kind === 'calendar'
          ? workspaceCalendarMutationSchema
          : workspaceKanbanMutationSchema;

    const parsed = schema.safeParse(body ?? {});
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
    const result = this.workspaceService.list(parsedKind, parsedQuery);

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
    const entity = this.workspaceService.getById(parsedKind, parsedId);

    if (!entity) {
      throw new NotFoundException('Workspace entity not found');
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
    const parsedBody = this.parseBody(parsedKind, body);
    const explicitId = typeof parsedBody.id === 'string' ? parsedBody.id.trim() : undefined;

    return {
      success: true,
      data: this.workspaceService.create(parsedKind, parsedBody, explicitId),
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
    const parsedBody = this.parseBody(parsedKind, body);
    const updated = this.workspaceService.update(parsedKind, parsedId, parsedBody);

    if (!updated) {
      throw new NotFoundException('Workspace entity not found');
    }

    return {
      success: true,
      data: updated,
    };
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
    const deleted = this.workspaceService.remove(parsedKind, parsedId);

    if (!deleted) {
      throw new NotFoundException('Workspace entity not found');
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
