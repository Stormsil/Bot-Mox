import {
  workspaceCalendarMutationSchema,
  workspaceKanbanMutationSchema,
  workspaceKindSchema,
  workspaceListQuerySchema,
  workspaceNotesMutationSchema,
} from '@botmox/api-contract';
import { BadRequestException, Controller } from '@nestjs/common';
import { z } from 'zod';
import { TenantKindCrudControllerBase } from '../common/tenant-kind-crud.controller-base';
import { type WorkspaceKind, type WorkspaceListQuery, WorkspaceService } from './workspace.service';

const workspaceIdSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Workspace id is required');

@Controller('workspace')
export class WorkspaceController extends TenantKindCrudControllerBase<
  WorkspaceKind,
  WorkspaceListQuery
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  protected parseKind(kind: string): WorkspaceKind {
    const parsed = workspaceKindSchema.safeParse(String(kind || '').trim());
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'WORKSPACE_INVALID_KIND',
        message: 'Invalid workspace kind',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data as WorkspaceKind;
  }

  protected parseId(id: string): string {
    const parsed = workspaceIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'WORKSPACE_INVALID_ID',
        message: 'Invalid workspace id',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  protected parseListQuery(query: Record<string, unknown>): WorkspaceListQuery {
    const parsed = workspaceListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'WORKSPACE_INVALID_LIST_QUERY',
        message: 'Invalid workspace list query',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  protected parseBody(kind: WorkspaceKind, body: unknown): Record<string, unknown> {
    const schema =
      kind === 'notes'
        ? workspaceNotesMutationSchema
        : kind === 'calendar'
          ? workspaceCalendarMutationSchema
          : workspaceKanbanMutationSchema;

    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'WORKSPACE_INVALID_BODY',
        message: 'Invalid workspace payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  protected getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'WORKSPACE_ENTITY_NOT_FOUND',
      message: 'Workspace entity not found',
    };
  }

  protected listEntities(kind: WorkspaceKind, query: WorkspaceListQuery, tenantId: string) {
    return this.workspaceService.list(kind, query, tenantId);
  }

  protected getEntityById(kind: WorkspaceKind, id: string, tenantId: string) {
    return this.workspaceService.getById(kind, id, tenantId);
  }

  protected createEntity(
    kind: WorkspaceKind,
    body: Record<string, unknown>,
    explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.workspaceService.create(kind, body, explicitId, tenantId);
  }

  protected updateEntity(
    kind: WorkspaceKind,
    id: string,
    body: Record<string, unknown>,
    tenantId: string,
  ) {
    return this.workspaceService.update(kind, id, body, tenantId);
  }

  protected removeEntity(kind: WorkspaceKind, id: string, tenantId: string) {
    return this.workspaceService.remove(kind, id, tenantId);
  }
}
