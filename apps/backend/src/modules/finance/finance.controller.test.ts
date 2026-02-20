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
