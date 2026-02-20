export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { LicenseController } = require('./license.controller.ts');

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

test('LicenseController returns deterministic code for missing bearer token', async () => {
  const controller = new LicenseController({
    issueLease: async () => ({}),
    heartbeatLease: async () => null,
    revokeLease: async () => null,
  });

  await assert.rejects(
    () =>
      controller.lease(undefined, { vm_uuid: 'vm-1', module: 'core' }, buildRequest('tenant-a')),
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

test('LicenseController returns deterministic code for lease not found', async () => {
  const controller = new LicenseController({
    issueLease: async () => ({}),
    heartbeatLease: async () => null,
    revokeLease: async () => null,
  });

  await assert.rejects(
    () =>
      controller.heartbeat(
        'Bearer test-token',
        { lease_id: 'lease-missing' },
        buildRequest('tenant-a'),
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'LEASE_NOT_FOUND',
        message: 'Execution lease not found',
      });
      return true;
    },
  );
});
