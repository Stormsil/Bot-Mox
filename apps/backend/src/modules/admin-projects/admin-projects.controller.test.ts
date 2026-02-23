export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { AdminProjectsController } = require('./admin-projects.controller.ts');

function buildRequest(roles: string[]) {
  return {
    method: 'GET',
    path: '/api/v1/admin/projects/catalog/releases',
    headers: {},
    ip: '127.0.0.1',
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
  return new AdminProjectsController(
    {
      createRelease: async () => ({}),
      listReleases: async () => ({ items: [], total: 0 }),
      rollout: async () => ({}),
      rolloutStaged: async () => ({}),
      rollback: async () => ({}),
      listRolloutStatus: async () => ({ items: [], total: 0 }),
    },
    {
      enforceAdminRateLimit: () => undefined,
      ...authOverrides,
    },
    {
      log: async () => undefined,
    },
  );
}

test('AdminProjectsController returns deterministic code for missing bearer token', async () => {
  const controller = createController();

  await assert.rejects(
    () => controller.listReleases(undefined, {}, buildRequest(['admin'])),
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

test('AdminProjectsController requires admin role', async () => {
  const controller = createController();

  await assert.rejects(
    () => controller.listReleases('Bearer token', {}, buildRequest(['user'])),
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
