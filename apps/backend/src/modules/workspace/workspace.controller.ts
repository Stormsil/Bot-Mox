import {
  workspaceCalendarMutationSchema,
  workspaceKanbanMutationSchema,
  workspaceKindSchema,
  workspaceListQuerySchema,
  workspaceNotesMutationSchema,
} from '@botmox/api-contract';
import { Controller } from '@nestjs/common';
import { TenantKindCrudControllerBase } from '../common/tenant-kind-crud.controller-base';
import { buildTrimmedIdSchema, parseWithZodOrBadRequest } from '../common/zod-http-parse';
import { type WorkspaceKind, type WorkspaceListQuery, WorkspaceService } from './workspace.service';

const workspaceIdSchema = buildTrimmedIdSchema('Workspace id');

@Controller('workspace')
export class WorkspaceController extends TenantKindCrudControllerBase<
  WorkspaceKind,
  WorkspaceListQuery
> {
  constructor(private readonly workspaceService: WorkspaceService) {
    super();
  }

  protected parseKind(kind: string): WorkspaceKind {
    return parseWithZodOrBadRequest(workspaceKindSchema, String(kind || '').trim(), {
      code: 'WORKSPACE_INVALID_KIND',
      message: 'Invalid workspace kind',
    }) as WorkspaceKind;
  }

  protected parseId(id: string): string {
    return parseWithZodOrBadRequest(workspaceIdSchema, String(id || ''), {
      code: 'WORKSPACE_INVALID_ID',
      message: 'Invalid workspace id',
    });
  }

  protected parseListQuery(query: Record<string, unknown>): WorkspaceListQuery {
    return parseWithZodOrBadRequest(workspaceListQuerySchema, query ?? {}, {
      code: 'WORKSPACE_INVALID_LIST_QUERY',
      message: 'Invalid workspace list query',
    });
  }

  protected parseBody(kind: WorkspaceKind, body: unknown): Record<string, unknown> {
    const schema =
      kind === 'notes'
        ? workspaceNotesMutationSchema
        : kind === 'calendar'
          ? workspaceCalendarMutationSchema
          : workspaceKanbanMutationSchema;

    return parseWithZodOrBadRequest(schema, body ?? {}, {
      code: 'WORKSPACE_INVALID_BODY',
      message: 'Invalid workspace payload',
    });
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
