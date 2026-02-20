export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { SecretsController } = require('./secrets.controller.ts');

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
    createSecret: async () => ({}),
    getSecretMeta: async () => null,
    rotateSecret: async () => null,
    createBinding: async () => ({}),
    listBindings: async () => [],
  };
}

test('SecretsController returns deterministic code for missing bearer token', async () => {
  const controller = new SecretsController(createServiceStub());

  await assert.rejects(
    () => controller.getMeta(undefined, 'secret-1', buildRequest('tenant-a')),
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

test('SecretsController returns deterministic code for missing secret', async () => {
  const controller = new SecretsController(createServiceStub());

  await assert.rejects(
    () => controller.getMeta('Bearer test-token', 'secret-1', buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'SECRET_NOT_FOUND',
        message: 'Secret not found',
      });
      return true;
    },
  );
});
