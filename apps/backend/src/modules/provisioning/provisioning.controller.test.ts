export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { ProvisioningController } = require('./provisioning.controller.ts');

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
    listProfiles: async () => [],
    createProfile: async () => ({}),
    updateProfile: async () => null,
    deleteProfile: async () => false,
    getProfile: async () => null,
    generateIsoPayload: async () => ({}),
    validateToken: async () => null,
    reportProgress: async () => null,
    getProgress: async () => ({}),
  };
}

test('ProvisioningController returns deterministic code for missing bearer token', async () => {
  const controller = new ProvisioningController(createServiceStub());

  await assert.rejects(
    () => controller.listProfiles(undefined, buildRequest('tenant-a')),
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

test('ProvisioningController returns deterministic code for missing profile on update', async () => {
  const controller = new ProvisioningController(createServiceStub());

  await assert.rejects(
    () =>
      controller.updateProfile(
        'Bearer test-token',
        'profile-001',
        { name: 'n' },
        buildRequest('tenant-a'),
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'UNATTEND_PROFILE_NOT_FOUND',
        message: 'Unattend profile not found',
      });
      return true;
    },
  );
});
