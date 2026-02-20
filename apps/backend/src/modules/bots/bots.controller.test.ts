export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { BotsController } = require('./bots.controller.ts');

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
    list: async () => ({ items: [], total: 0, page: 1, limit: 20 }),
    getById: async () => null,
    create: async () => ({}),
    patch: async () => null,
    getLifecycle: async () => ({}),
    getStageTransitions: async () => null,
    isBanned: async () => null,
    transition: async () => null,
    ban: async () => null,
    unban: async () => null,
    remove: async () => false,
  };
}

test('BotsController returns deterministic code for missing bearer token', async () => {
  const controller = new BotsController(createServiceStub());

  await assert.rejects(
    () => controller.getOne(undefined, 'bot-1', buildRequest('tenant-a')),
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

test('BotsController returns deterministic code for missing bot', async () => {
  const controller = new BotsController(createServiceStub());

  await assert.rejects(
    () => controller.getOne('Bearer test-token', 'bot-1', buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'BOT_NOT_FOUND',
        message: 'Bot not found',
      });
      return true;
    },
  );
});
