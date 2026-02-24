export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { AdminAccessController } = require('./admin-access.controller.ts');

function buildRequest(roles: string[]) {
  return {
    [REQUEST_IDENTITY_KEY]: {
      userId: 'user-1',
      email: 'user-1@example.local',
      roles,
      tenantId: 'tenant-admin',
      raw: {},
    },
  };
}

function createController(authOverrides = {}) {
  return new AdminAccessController(
    {
      listTenants: async () => [],
      getTenantAccessMap: async () => new Map(),
    },
    {
      isAdmin: (roles: string[]) =>
        roles.map((r) => String(r || '').toLowerCase()).includes('admin'),
      listUsers: async () => [],
      getUserById: async () => null,
      grantPremium: async () => ({}),
      revokePremium: async () => ({}),
      setUserDisabled: async () => ({}),
      forceUserLogout: async () => ({}),
      ...authOverrides,
    },
    {
      log: async () => undefined,
      list: async () => [],
    },
  );
}

test('AdminAccessController returns deterministic code for missing bearer token', async () => {
  const controller = createController();

  await assert.rejects(
    () => controller.listTenants(undefined, {}, buildRequest(['admin'])),
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

test('AdminAccessController requires admin role', async () => {
  const controller = createController();

  await assert.rejects(
    () => controller.listTenants('Bearer token', {}, buildRequest(['user'])),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
      return true;
    },
  );
});
