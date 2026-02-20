export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');
const { AuthController } = require('./auth.controller.ts');

test('AuthController returns deterministic code for missing bearer token', async () => {
  const controller = new AuthController({
    verifyBearerToken: async () => null,
  });

  await assert.rejects(
    () => controller.verify(undefined),
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

test('AuthController whoami returns mapped identity', async () => {
  const controller = new AuthController({
    verifyBearerToken: async () => ({
      uid: 'user-1',
      email: 'u@example.local',
      roles: ['admin'],
      tenantId: 'tenant-a',
    }),
  });

  const response = await controller.whoami('Bearer test-token');
  assert.deepEqual(response, {
    success: true,
    data: {
      uid: 'user-1',
      email: 'u@example.local',
      roles: ['admin'],
      tenant_id: 'tenant-a',
    },
  });
});
