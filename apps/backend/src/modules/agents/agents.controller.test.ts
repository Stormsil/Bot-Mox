export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { AgentsController } = require('./agents.controller.ts');

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

test('AgentsController returns deterministic code for missing bearer token', async () => {
  const controller = new AgentsController({
    list: async () => [],
    createPairing: async () => ({}),
    heartbeat: async () => ({}),
  });

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

test('AgentsController returns deterministic code for invalid heartbeat payload', async () => {
  const controller = new AgentsController({
    list: async () => [],
    createPairing: async () => ({}),
    heartbeat: async () => ({}),
  });

  await assert.rejects(
    () => controller.heartbeat('Bearer test-token', { agent_id: '' }, buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => unknown }).getResponse() as {
        code?: string;
        message?: string;
      };
      assert.equal(response.code, 'AGENTS_HEARTBEAT_INVALID_BODY');
      assert.equal(response.message, 'Invalid agents heartbeat payload');
      return true;
    },
  );
});
