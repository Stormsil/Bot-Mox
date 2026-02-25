import {
  Body,
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

interface CrudListResult {
  items: unknown[];
  total: number;
  page: number;
  limit: number;
}

interface NotFoundPayload {
  code: string;
  message: string;
}

export abstract class TenantKindCrudControllerBase<TKind extends string, TListQuery> {
  protected ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  protected getExplicitIdFromBody(body: Record<string, unknown>): string | undefined {
    return typeof body.id === 'string' ? body.id.trim() : undefined;
  }

  protected abstract parseKind(kind: string): TKind;
  protected abstract parseId(id: string): string;
  protected abstract parseListQuery(query: Record<string, unknown>): TListQuery;
  protected abstract parseBody(kind: TKind, body: unknown): Record<string, unknown>;
  protected abstract getNotFoundPayload(): NotFoundPayload;
  protected abstract listEntities(
    kind: TKind,
    query: TListQuery,
    tenantId: string,
  ): Promise<CrudListResult>;
  protected abstract getEntityById(
    kind: TKind,
    id: string,
    tenantId: string,
  ): Promise<unknown | null>;
  protected abstract createEntity(
    kind: TKind,
    body: Record<string, unknown>,
    explicitId: string | undefined,
    tenantId: string,
  ): Promise<unknown>;
  protected abstract updateEntity(
    kind: TKind,
    id: string,
    body: Record<string, unknown>,
    tenantId: string,
  ): Promise<unknown | null>;
  protected abstract removeEntity(kind: TKind, id: string, tenantId: string): Promise<boolean>;

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
    const result = await this.listEntities(parsedKind, parsedQuery, identity.tenantId);

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
    const entity = await this.getEntityById(parsedKind, parsedId, identity.tenantId);

    if (!entity) {
      throw new NotFoundException(this.getNotFoundPayload());
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
    const parsedBody = this.parseBody(parsedKind, body);
    const explicitId = this.getExplicitIdFromBody(parsedBody);
    const identity = getRequestIdentity(req);

    return {
      success: true,
      data: await this.createEntity(parsedKind, parsedBody, explicitId, identity.tenantId),
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
    const parsedBody = this.parseBody(parsedKind, body);
    const identity = getRequestIdentity(req);
    const updated = await this.updateEntity(parsedKind, parsedId, parsedBody, identity.tenantId);

    if (!updated) {
      throw new NotFoundException(this.getNotFoundPayload());
    }

    return {
      success: true,
      data: updated,
    };
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
    const deleted = await this.removeEntity(parsedKind, parsedId, identity.tenantId);

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
