export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { FinanceController } = require('./finance.controller.ts');

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
    patch: async () => null,
    remove: async () => false,
    getDailyStats: async () => ({}),
    getGoldPriceHistory: async () => ({}),
  };
}

test('FinanceController returns deterministic code for missing bearer token', async () => {
  const controller = new FinanceController(createServiceStub());

  await assert.rejects(
    () => controller.list(undefined, {}, buildRequest('tenant-a')),
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

test('FinanceController returns deterministic code for missing finance operation', async () => {
  const controller = new FinanceController(createServiceStub());

  await assert.rejects(
    () => controller.getOne('Bearer test-token', 'fin-001', buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'FINANCE_OPERATION_NOT_FOUND',
        message: 'Finance operation not found',
      });
      return true;
    },
  );
});

test('FinanceController soft-fails missing finance storage in getOne and returns not found envelope', async () => {
  const controller = new FinanceController({
    ...createServiceStub(),
    getById: async () => {
      throw { code: 'P2021', message: 'Table does not exist' };
    },
  });

  await assert.rejects(
    () => controller.getOne('Bearer test-token', 'fin-001', buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'FINANCE_OPERATION_NOT_FOUND',
        message: 'Finance operation not found',
      });
      return true;
    },
  );
});

test('FinanceController rethrows non-storage errors in getOne', async () => {
  const boom = new Error('boom');
  const controller = new FinanceController({
    ...createServiceStub(),
    getById: async () => {
      throw boom;
    },
  });

  await assert.rejects(
    () => controller.getOne('Bearer test-token', 'fin-001', buildRequest('tenant-a')),
    (error: unknown) => {
      assert.equal(error, boom);
      return true;
    },
  );
});

test('FinanceController soft-fails missing finance storage in list and preserves parsed paging meta', async () => {
  const controller = new FinanceController({
    ...createServiceStub(),
    list: async () => {
      throw { code: 'P2021', message: 'no such table: financeOperation' };
    },
  });

  const result = await controller.list(
    'Bearer test-token',
    { page: '3', limit: '7' },
    buildRequest('tenant-a'),
  );

  assert.deepEqual(result, {
    success: true,
    data: [],
    meta: {
      total: 0,
      page: 3,
      limit: 7,
    },
  });
});
