export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { SettingsController } = require('./settings.controller.ts');

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
    getApiKeys: async () => ({}),
    updateApiKeys: async () => ({}),
    getProxy: async () => ({}),
    updateProxy: async () => ({}),
    getNotificationEvents: async () => ({}),
    updateNotificationEvents: async () => ({}),
  };
}

test('SettingsController returns deterministic code for missing bearer token', async () => {
  const controller = new SettingsController(createServiceStub());

  await assert.rejects(
    () => controller.getProxy(undefined, buildRequest('tenant-a')),
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

test('SettingsController returns deterministic code for invalid proxy payload', async () => {
  const controller = new SettingsController(createServiceStub());

  await assert.rejects(
    () => controller.updateProxy('Bearer test-token', {}, buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => unknown }).getResponse() as {
        code?: string;
        message?: string;
      };
      assert.equal(response.code, 'SETTINGS_INVALID_PROXY_BODY');
      assert.equal(response.message, 'Invalid settings proxy payload');
      return true;
    },
  );
});
