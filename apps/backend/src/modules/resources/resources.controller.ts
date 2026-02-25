import {
  resourceKindSchema,
  resourceListQuerySchema,
  resourceMutationSchema,
} from '@botmox/api-contract';
import { Body, Controller, Headers, Param, Put, Req } from '@nestjs/common';
import type { Request } from 'express';
import { TenantKindCrudControllerBase } from '../common/tenant-kind-crud.controller-base';
import { buildTrimmedIdSchema, parseWithZodOrBadRequest } from '../common/zod-http-parse';
import { type ResourceListQuery, ResourcesService } from './resources.service';

const resourceIdSchema = buildTrimmedIdSchema('Resource id');

@Controller('resources')
export class ResourcesController extends TenantKindCrudControllerBase<
  'licenses' | 'proxies' | 'subscriptions',
  ResourceListQuery
> {
  constructor(private readonly resourcesService: ResourcesService) {
    super();
  }

  protected parseKind(kind: string): 'licenses' | 'proxies' | 'subscriptions' {
    return parseWithZodOrBadRequest(resourceKindSchema, String(kind || '').trim(), {
      code: 'RESOURCES_INVALID_KIND',
      message: 'Invalid resource kind',
    });
  }

  protected parseId(id: string): string {
    return parseWithZodOrBadRequest(resourceIdSchema, String(id || ''), {
      code: 'RESOURCES_INVALID_ID',
      message: 'Invalid resource id',
    });
  }

  protected parseBody(
    _kind: 'licenses' | 'proxies' | 'subscriptions',
    body: unknown,
  ): Record<string, unknown> {
    return parseWithZodOrBadRequest(resourceMutationSchema, body ?? {}, {
      code: 'RESOURCES_INVALID_BODY',
      message: 'Invalid resource payload',
    });
  }

  protected parseListQuery(query: Record<string, unknown>): ResourceListQuery {
    return parseWithZodOrBadRequest(resourceListQuerySchema, query ?? {}, {
      code: 'RESOURCES_INVALID_LIST_QUERY',
      message: 'Invalid resources list query',
    });
  }

  protected getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'RESOURCE_NOT_FOUND',
      message: 'Resource not found',
    };
  }

  protected listEntities(
    kind: 'licenses' | 'proxies' | 'subscriptions',
    query: ResourceListQuery,
    tenantId: string,
  ) {
    return this.resourcesService.list(kind, query, tenantId);
  }

  protected getEntityById(
    kind: 'licenses' | 'proxies' | 'subscriptions',
    id: string,
    tenantId: string,
  ) {
    return this.resourcesService.getById(kind, id, tenantId);
  }

  protected createEntity(
    kind: 'licenses' | 'proxies' | 'subscriptions',
    body: Record<string, unknown>,
    explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.resourcesService.create(kind, body, explicitId, tenantId);
  }

  protected updateEntity(
    kind: 'licenses' | 'proxies' | 'subscriptions',
    id: string,
    body: Record<string, unknown>,
    tenantId: string,
  ) {
    return this.resourcesService.update(kind, id, body, tenantId);
  }

  protected removeEntity(
    kind: 'licenses' | 'proxies' | 'subscriptions',
    id: string,
    tenantId: string,
  ) {
    return this.resourcesService.remove(kind, id, tenantId);
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
}
