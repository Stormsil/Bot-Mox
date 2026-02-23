// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException, BadRequestException } = require('@nestjs/common');
const { AdminSecretsController } = require('./admin-secrets.controller.ts');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');

function createReq(identity) {
  const req = {};
  req[REQUEST_IDENTITY_KEY] = {
    tenantId: identity.tenantId || 'tenant-admin',
    userId: identity.userId || 'admin-user',
    email: identity.email || 'admin@localhost',
    roles: identity.roles || ['admin'],
    raw: identity.raw || {},
  };
  return req;
}

test('AdminSecretsController rotateTenantSecrets requires bearer token', async () => {
  const controller = new AdminSecretsController(
    {
      rotateTenantSecrets: async () => ({
        requested: 0,
        planned: 0,
        rotated: 0,
        skipped: 0,
        failed: 0,
        dry_run: false,
      }),
    },
    { isAdmin: () => true },
    { log: async () => {} },
  );

  await assert.rejects(
    () => controller.rotateTenantSecrets(undefined, {}, createReq({})),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      return true;
    },
  );
});

test('AdminSecretsController rotateTenantSecrets requires admin role', async () => {
  const controller = new AdminSecretsController(
    {
      rotateTenantSecrets: async () => ({
        requested: 0,
        planned: 0,
        rotated: 0,
        skipped: 0,
        failed: 0,
        dry_run: false,
      }),
    },
    { isAdmin: () => false },
    { log: async () => {} },
  );

  await assert.rejects(
    () =>
      controller.rotateTenantSecrets(
        'Bearer token',
        { tenant_id: 'tenant-a', key_id: 'k-1' },
        createReq({ roles: ['user'] }),
      ),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      return true;
    },
  );
});

test('AdminSecretsController rotateTenantSecrets validates payload and logs audit', async () => {
  const auditCalls = [];
  const controller = new AdminSecretsController(
    {
      rotateTenantSecrets: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-rotate',
        requested: 2,
        planned: 0,
        rotated: 2,
        skipped: 0,
        failed: 0,
        dry_run: false,
        details: [],
      }),
    },
    { isAdmin: () => true },
    {
      log: async (payload) => {
        auditCalls.push(payload);
      },
    },
  );

  await assert.rejects(
    () => controller.rotateTenantSecrets('Bearer token', { tenant_id: '' }, createReq({})),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      return true;
    },
  );

  const response = await controller.rotateTenantSecrets(
    'Bearer token',
    { tenant_id: 'tenant-a', key_id: 'k-rotate', reason: 'scheduled' },
    createReq({ userId: 'root-admin', tenantId: 'tenant-admin' }),
  );
  assert.equal(response.success, true);
  const data = response.data;
  assert.equal(data.rotated, 2);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'admin.secrets.rotate_tenant');
  assert.equal(auditCalls[0].targetTenantId, 'tenant-a');
});

test('AdminSecretsController rotateManyTenants validates and returns aggregate summary', async () => {
  const auditCalls = [];
  const controller = new AdminSecretsController(
    {
      rotateTenantSecrets: async (input) => ({
        tenant_id: input.tenantId,
        key_id: input.keyId,
        requested: 3,
        planned: input.dryRun ? (input.tenantId === 'tenant-b' ? 1 : 2) : 0,
        rotated: input.tenantId === 'tenant-b' ? 1 : 2,
        skipped: 0,
        failed: 0,
        dry_run: input.dryRun === true,
        details: [],
      }),
    },
    { isAdmin: () => true },
    {
      log: async (payload) => {
        auditCalls.push(payload);
      },
    },
  );

  await assert.rejects(
    () =>
      controller.rotateManyTenants(
        'Bearer token',
        { tenant_ids: [], key_id: 'k-rotate' },
        createReq({}),
      ),
    (error) => {
      assert.ok(error instanceof BadRequestException);
      return true;
    },
  );

  const response = await controller.rotateManyTenants(
    'Bearer token',
    {
      tenant_ids: ['tenant-a', 'tenant-b', 'TENANT-A'],
      key_id: 'k-rotate',
      reason: 'daily',
    },
    createReq({ userId: 'root-admin', tenantId: 'tenant-admin' }),
  );

  assert.equal(response.success, true);
  const data = response.data;
  assert.equal(data.requested_tenants, 2);
  assert.equal(data.successful_tenants, 2);
  assert.equal(data.failed_tenants, 0);
  assert.equal(data.rotated_total, 3);
  assert.equal(auditCalls.length, 1);
  assert.equal(auditCalls[0].action, 'admin.secrets.rotate_tenants');
});

test('AdminSecretsController rotateManyTenants passes dry_run and aggregates planned_total', async () => {
  const controller = new AdminSecretsController(
    {
      rotateTenantSecrets: async (input) => ({
        tenant_id: input.tenantId,
        key_id: input.keyId,
        requested: 2,
        planned: 2,
        rotated: 0,
        skipped: 0,
        failed: 0,
        dry_run: input.dryRun === true,
        details: [],
      }),
    },
    { isAdmin: () => true },
    { log: async () => {} },
  );

  const response = await controller.rotateManyTenants(
    'Bearer token',
    {
      tenant_ids: ['tenant-a', 'tenant-b'],
      key_id: 'k-rotate',
      dry_run: true,
    },
    createReq({ userId: 'root-admin', tenantId: 'tenant-admin' }),
  );

  const data = response.data;
  assert.equal(data.dry_run, true);
  assert.equal(data.planned_total, 4);
  assert.equal(data.rotated_total, 0);
});
