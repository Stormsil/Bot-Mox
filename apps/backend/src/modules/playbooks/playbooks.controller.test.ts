export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { PlaybooksController } = require('./playbooks.controller.ts');

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
    list: async () => [],
    getById: async () => null,
    create: async () => ({}),
    update: async () => null,
    remove: async () => false,
    validate: () => ({ valid: true, errors: [], warnings: [] }),
  };
}

test('PlaybooksController returns deterministic code for missing bearer token', async () => {
  const controller = new PlaybooksController(createServiceStub());

  await assert.rejects(
    () => controller.list(undefined, buildRequest('tenant-a')),
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

test('PlaybooksController returns deterministic code for missing playbook', async () => {
  const controller = new PlaybooksController(createServiceStub());

  await assert.rejects(
    () => controller.getOne('Bearer test-token', 'playbook-001', buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'PLAYBOOK_NOT_FOUND',
        message: 'Playbook not found',
      });
      return true;
    },
  );
});
