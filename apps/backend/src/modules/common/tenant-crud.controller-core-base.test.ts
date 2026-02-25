export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { TenantCrudControllerCoreBase } = require('./tenant-crud.controller-core-base.ts');

function buildRequest(tenantId: string) {
  return {
    [REQUEST_IDENTITY_KEY]: {
      userId: 'user-1',
      email: `${tenantId}@example.local`,
      roles: ['admin'],
      tenantId,
      raw: {},
    },
  };
}

class TestCrudController extends TenantCrudControllerCoreBase<
  Record<string, unknown>,
  Record<string, unknown>
> {
  protected parseId(id: string): string {
    return id;
  }

  protected parseCreateBody(body: unknown): Record<string, unknown> {
    return (body ?? {}) as Record<string, unknown>;
  }

  protected parseUpdateBody(body: unknown): Record<string, unknown> {
    return (body ?? {}) as Record<string, unknown>;
  }

  protected getNotFoundPayload(): { code: string; message: string } {
    return { code: 'NOT_FOUND', message: 'Not found' };
  }

  protected async getEntityById(): Promise<unknown | null> {
    return null;
  }

  protected async createEntity(): Promise<unknown> {
    return {};
  }

  protected async updateEntity(): Promise<unknown | null> {
    return null;
  }

  protected async removeEntity(): Promise<boolean> {
    return false;
  }

  async callListCore(
    authorization: string | undefined,
    req: unknown,
    run: (tenantId: string) => Promise<unknown>,
  ): Promise<unknown> {
    return this.listCore(authorization, req as never, run);
  }
}

test('TenantCrudControllerCoreBase.listCore enforces bearer token', async () => {
  const controller = new TestCrudController();

  await assert.rejects(
    () => controller.callListCore(undefined, buildRequest('tenant-a'), async () => ({ ok: true })),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
      return true;
    },
  );
});

test('TenantCrudControllerCoreBase.listCore passes tenantId from request identity', async () => {
  const controller = new TestCrudController();
  const seen: string[] = [];

  const result = await controller.callListCore(
    'Bearer token',
    buildRequest('tenant-z'),
    async (tenantId: string) => {
      seen.push(tenantId);
      return { success: true, data: tenantId };
    },
  );

  assert.deepEqual(seen, ['tenant-z']);
  assert.deepEqual(result, { success: true, data: 'tenant-z' });
});
