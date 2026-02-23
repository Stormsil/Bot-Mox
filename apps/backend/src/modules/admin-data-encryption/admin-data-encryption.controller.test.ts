export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException, BadRequestException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { AdminDataEncryptionController } = require('./admin-data-encryption.controller.ts');

function buildRequest(roles = ['admin'], tenantId = 'tenant-admin') {
  return {
    [REQUEST_IDENTITY_KEY]: {
      userId: 'admin-1',
      email: 'admin-1@example.local',
      tenantId,
      roles,
      raw: {},
    },
    headers: {},
    method: 'POST',
    path: '/api/v1/admin/data-encryption/rotate-workspace-tenant',
    ip: '127.0.0.1',
  };
}

test('AdminDataEncryptionController returns deterministic code for missing bearer token', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  try {
    await controller.rotateWorkspaceTenant(undefined, { tenant_id: 'tenant-a' }, buildRequest());
    assert.fail('Expected missing bearer token error');
  } catch (error) {
    assert.ok(error instanceof UnauthorizedException);
    const payload = (error as { getResponse: () => { code?: string } }).getResponse();
    assert.equal(payload.code, 'MISSING_BEARER_TOKEN');
  }
});

test('AdminDataEncryptionController requires admin role', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
    },
    {
      isAdmin: () => false,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  try {
    await controller.rotateWorkspaceTenant(
      'Bearer token',
      { tenant_id: 'tenant-a' },
      buildRequest(['user']),
    );
    assert.fail('Expected admin-role-required error');
  } catch (error) {
    assert.ok(error instanceof UnauthorizedException);
    const payload = (error as { getResponse: () => { code?: string } }).getResponse();
    assert.equal(payload.code, 'AUTH_ADMIN_ROLE_REQUIRED');
  }
});

test('AdminDataEncryptionController rejects key mismatch', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        dry_run: true,
        requested: 0,
        planned: 0,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  try {
    await controller.rotateWorkspaceTenant(
      'Bearer token',
      { tenant_id: 'tenant-a', key_id: 'k-old' },
      buildRequest(),
    );
    assert.fail('Expected key mismatch error');
  } catch (error) {
    assert.ok(error instanceof BadRequestException);
    const payload = (error as { getResponse: () => { code?: string } }).getResponse();
    assert.equal(payload.code, 'ADMIN_DATA_ENCRYPTION_KEY_MISMATCH');
  }
});

test('AdminDataEncryptionController rotates finance tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'finance',
        dry_run: true,
        requested: 1,
        planned: 1,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateFinanceTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'finance');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 1);
});

test('AdminDataEncryptionController rotates settings tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'settings',
        dry_run: true,
        requested: 2,
        planned: 2,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateSettingsTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'settings');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 2);
});

test('AdminDataEncryptionController rotates resources tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({}),
      rotateResourcesTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'resources',
        dry_run: true,
        requested: 3,
        planned: 3,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateResourcesTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'resources');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 3);
});

test('AdminDataEncryptionController rotates playbooks tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({}),
      rotateResourcesTenant: async () => ({}),
      rotatePlaybooksTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'playbooks',
        dry_run: true,
        requested: 1,
        planned: 1,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotatePlaybooksTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'playbooks');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 1);
});

test('AdminDataEncryptionController rotates bots tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({}),
      rotateResourcesTenant: async () => ({}),
      rotatePlaybooksTenant: async () => ({}),
      rotateBotsTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'bots',
        dry_run: true,
        requested: 1,
        planned: 1,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateBotsTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'bots');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 1);
});

test('AdminDataEncryptionController rotates provisioning tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({}),
      rotateResourcesTenant: async () => ({}),
      rotatePlaybooksTenant: async () => ({}),
      rotateBotsTenant: async () => ({}),
      rotateProvisioningTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'provisioning',
        dry_run: true,
        requested: 1,
        planned: 1,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateProvisioningTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'provisioning');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 1);
});

test('AdminDataEncryptionController rotates infra tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({}),
      rotateResourcesTenant: async () => ({}),
      rotatePlaybooksTenant: async () => ({}),
      rotateBotsTenant: async () => ({}),
      rotateProvisioningTenant: async () => ({}),
      rotateInfraTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'infra',
        dry_run: true,
        requested: 1,
        planned: 1,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateInfraTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'infra');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 1);
});

test('AdminDataEncryptionController rotates vmops tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({}),
      rotateResourcesTenant: async () => ({}),
      rotatePlaybooksTenant: async () => ({}),
      rotateBotsTenant: async () => ({}),
      rotateProvisioningTenant: async () => ({}),
      rotateInfraTenant: async () => ({}),
      rotateVmOpsTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'vmops',
        dry_run: true,
        requested: 1,
        planned: 1,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateVmOpsTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'vmops');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 1);
});

test('AdminDataEncryptionController rotates theme tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({}),
      rotateResourcesTenant: async () => ({}),
      rotatePlaybooksTenant: async () => ({}),
      rotateBotsTenant: async () => ({}),
      rotateProvisioningTenant: async () => ({}),
      rotateInfraTenant: async () => ({}),
      rotateVmOpsTenant: async () => ({}),
      rotateThemeTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'theme',
        dry_run: true,
        requested: 1,
        planned: 1,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateThemeTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'theme');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 1);
});

test('AdminDataEncryptionController rotates license tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({}),
      rotateResourcesTenant: async () => ({}),
      rotatePlaybooksTenant: async () => ({}),
      rotateBotsTenant: async () => ({}),
      rotateProvisioningTenant: async () => ({}),
      rotateInfraTenant: async () => ({}),
      rotateVmOpsTenant: async () => ({}),
      rotateThemeTenant: async () => ({}),
      rotateLicenseTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'license',
        dry_run: true,
        requested: 1,
        planned: 1,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateLicenseTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'license');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 1);
});

test('AdminDataEncryptionController rotates artifacts tenant with success envelope', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
      rotateFinanceTenant: async () => ({}),
      rotateSettingsTenant: async () => ({}),
      rotateResourcesTenant: async () => ({}),
      rotatePlaybooksTenant: async () => ({}),
      rotateBotsTenant: async () => ({}),
      rotateProvisioningTenant: async () => ({}),
      rotateInfraTenant: async () => ({}),
      rotateVmOpsTenant: async () => ({}),
      rotateThemeTenant: async () => ({}),
      rotateLicenseTenant: async () => ({}),
      rotateArtifactsTenant: async () => ({
        tenant_id: 'tenant-a',
        key_id: 'k-2026q1',
        scope: 'artifacts',
        dry_run: true,
        requested: 2,
        planned: 2,
        rotated: 0,
        skipped: 0,
        failed: 0,
      }),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateArtifactsTenant(
    'Bearer token',
    { tenant_id: 'tenant-a', dry_run: true },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as { scope?: string; tenant_id?: string; planned?: number };
  assert.equal(data.scope, 'artifacts');
  assert.equal(data.tenant_id, 'tenant-a');
  assert.equal(data.planned, 2);
});

test('AdminDataEncryptionController rotates workspace tenants in batch with dedupe and aggregate counters', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async ({ tenantId }: { tenantId: string }) => {
        if (tenantId === 'tenant-b') {
          throw new Error('simulated_failure');
        }
        return {
          tenant_id: tenantId,
          key_id: 'k-2026q1',
          scope: 'workspace',
          dry_run: true,
          requested: 1,
          planned: 1,
          rotated: 0,
          skipped: 0,
          failed: 0,
        };
      },
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  const response = await controller.rotateWorkspaceTenants(
    'Bearer token',
    {
      tenant_ids: ['TENANT-A', 'tenant-a', 'tenant-b'],
      dry_run: true,
    },
    buildRequest(),
  );
  assert.equal(response.success, true);
  const data = response.data as {
    requested_tenants?: number;
    successful_tenants?: number;
    failed_tenants?: number;
    planned_total?: number;
    results?: Array<{ tenant_id?: string; status?: string }>;
  };
  assert.equal(data.requested_tenants, 2);
  assert.equal(data.successful_tenants, 1);
  assert.equal(data.failed_tenants, 1);
  assert.equal(data.planned_total, 1);
  assert.equal(Array.isArray(data.results), true);
  assert.equal(data.results?.length, 2);
});

test('AdminDataEncryptionController rejects invalid rotate-workspace-tenants payload', async () => {
  const controller = new AdminDataEncryptionController(
    {
      getActiveKeyId: () => 'k-2026q1',
      rotateWorkspaceTenant: async () => ({}),
    },
    {
      isAdmin: () => true,
      enforceAdminRateLimit: () => undefined,
    },
    undefined,
  );

  try {
    await controller.rotateWorkspaceTenants(
      'Bearer token',
      {
        tenant_ids: [],
      },
      buildRequest(),
    );
    assert.fail('Expected invalid body error');
  } catch (error) {
    assert.ok(error instanceof BadRequestException);
    const payload = (error as { getResponse: () => { code?: string } }).getResponse();
    assert.equal(payload.code, 'ADMIN_DATA_ENCRYPTION_ROTATE_TENANTS_INVALID_BODY');
  }
});
