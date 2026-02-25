import { NotFoundException, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';

interface NotFoundPayload {
  code: string;
  message: string;
}

export abstract class TenantCrudControllerCoreBase<
  TCreateBody extends Record<string, unknown>,
  TUpdateBody extends Record<string, unknown>,
> {
  protected ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  protected getTenantId(req: Request): string {
    return getRequestIdentity(req).tenantId;
  }

  protected getExplicitIdFromBody(body: Record<string, unknown>): string | undefined {
    return typeof body.id === 'string' ? body.id.trim() : undefined;
  }

  protected buildDeleteResponseData(id: string): unknown {
    return { id, deleted: true };
  }

  protected async beforeCreate(_body: TCreateBody, _tenantId: string): Promise<void> {}

  protected async beforeUpdate(_id: string, _body: TUpdateBody, _tenantId: string): Promise<void> {}

  protected abstract parseId(id: string): string;
  protected abstract parseCreateBody(body: unknown): TCreateBody;
  protected abstract parseUpdateBody(body: unknown): TUpdateBody;
  protected abstract getNotFoundPayload(): NotFoundPayload;
  protected abstract getEntityById(id: string, tenantId: string): Promise<unknown | null>;
  protected abstract createEntity(
    body: TCreateBody,
    explicitId: string | undefined,
    tenantId: string,
  ): Promise<unknown>;
  protected abstract updateEntity(
    id: string,
    body: TUpdateBody,
    tenantId: string,
  ): Promise<unknown | null>;
  protected abstract removeEntity(id: string, tenantId: string): Promise<boolean>;

  protected async getOneCore(
    authorization: string | undefined,
    id: string,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const entity = await this.getEntityById(parsedId, tenantId);
    if (!entity) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return {
      success: true,
      data: entity,
    };
  }

  protected async listCore<TResponse>(
    authorization: string | undefined,
    req: Request,
    run: (tenantId: string) => Promise<TResponse>,
  ): Promise<TResponse> {
    this.ensureAuthHeader(authorization);
    const tenantId = this.getTenantId(req);
    return run(tenantId);
  }

  protected async createCore(
    authorization: string | undefined,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCreateBody(body);
    const tenantId = this.getTenantId(req);
    await this.beforeCreate(parsedBody, tenantId);
    const explicitId = this.getExplicitIdFromBody(parsedBody);
    return {
      success: true,
      data: await this.createEntity(parsedBody, explicitId, tenantId),
    };
  }

  protected async updateCore(
    authorization: string | undefined,
    id: string,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseUpdateBody(body);
    const tenantId = this.getTenantId(req);
    await this.beforeUpdate(parsedId, parsedBody, tenantId);
    const updated = await this.updateEntity(parsedId, parsedBody, tenantId);
    if (!updated) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return {
      success: true,
      data: updated,
    };
  }

  protected async removeCore(
    authorization: string | undefined,
    id: string,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const deleted = await this.removeEntity(parsedId, tenantId);
    if (!deleted) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return {
      success: true,
      data: this.buildDeleteResponseData(parsedId),
    };
  }
}
