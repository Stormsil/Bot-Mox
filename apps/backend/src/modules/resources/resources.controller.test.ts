export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { ResourcesController } = require('./resources.controller.ts');

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

function createServiceStub() {
  return {
    list: async () => ({ items: [], total: 0, page: 1, limit: 50 }),
    getById: async () => null,
    create: async () => ({}),
    update: async () => null,
    remove: async () => false,
    getStatusAggregates: async () => ({
      generated_at: 0,
      summary: {},
      expiring_items: [],
      by_bot: {},
    }),
  };
}

test('ResourcesController returns deterministic code for missing bearer token', async () => {
  const controller = new ResourcesController(createServiceStub());

  await assert.rejects(
    () => controller.list(undefined, 'licenses', {}, buildRequest('tenant-a')),
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

test('ResourcesController returns deterministic code for missing resource', async () => {
  const controller = new ResourcesController(createServiceStub());

  await assert.rejects(
    () =>
      controller.getOne('Bearer test-token', 'licenses', 'resource-001', buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'RESOURCE_NOT_FOUND',
        message: 'Resource not found',
      });
      return true;
    },
  );
});

test('ResourcesController returns status aggregate from service', async () => {
  const controller = new ResourcesController({
    ...createServiceStub(),
    getStatusAggregates: async () => ({
      generated_at: 123,
      summary: {
        licenses: { total: 1, active: 1, expiring_soon: 0, expired: 0, unassigned: 0 },
        proxies: { total: 0, active: 0, expiring_soon: 0, expired: 0, unassigned: 0 },
        subscriptions: { total: 0, active: 0, expiring_soon: 0, expired: 0 },
      },
      expiring_items: [],
      by_bot: {},
    }),
  });

  const result = await controller.statusAggregate('Bearer test-token', buildRequest('tenant-a'));
  assert.equal(result.success, true);
  assert.equal((result.data as { generated_at: number }).generated_at, 123);
});
