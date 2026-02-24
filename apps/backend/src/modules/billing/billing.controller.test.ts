export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  BadRequestException,
  ForbiddenException,
  UnauthorizedException,
} = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { BillingController } = require('./billing.controller.ts');

const originalBillingMode = process.env.BILLING_MODE;

function buildRequest(tenantId: string, userId = 'user-1', roles: string[] = ['user']) {
  return {
    [REQUEST_IDENTITY_KEY]: {
      userId,
      email: `${tenantId}@example.local`,
      roles,
      tenantId,
      raw: {},
    },
  };
}

test('BillingController returns deterministic code for missing bearer token', async () => {
  const controller = new BillingController(
    {
      isAdmin: () => false,
      grantPremium: async () => ({}),
    },
    {
      log: async () => undefined,
    },
  );

  await assert.rejects(
    () => controller.activateMockPremium(undefined, {}, buildRequest('tenant-a')),
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

test('BillingController enforces BILLING_MODE=stub for mock activation', async () => {
  process.env.BILLING_MODE = 'live';

  const controller = new BillingController(
    {
      isAdmin: () => false,
      grantPremium: async () => ({}),
    },
    {
      log: async () => undefined,
    },
  );

  try {
    await assert.rejects(
      () => controller.activateMockPremium('Bearer token', {}, buildRequest('tenant-a')),
      (error: unknown) => {
        assert.ok(error instanceof BadRequestException);
        assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
          code: 'BILLING_MODE_NOT_STUB',
          message: 'Mock billing endpoint is available only when BILLING_MODE=stub',
        });
        return true;
      },
    );
  } finally {
    process.env.BILLING_MODE = originalBillingMode;
  }
});

test('BillingController activates stub premium for current tenant and writes audit event', async () => {
  process.env.BILLING_MODE = 'stub';
  process.env.BILLING_STUB_SELF_ACTIVATE = 'false';
  const grantCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<Record<string, unknown>> = [];
  const adminRateLimitCalls: Array<Record<string, unknown>> = [];

  const controller = new BillingController(
    {
      isAdmin: (roles: string[]) =>
        roles.map((value) => String(value || '').toLowerCase()).includes('admin'),
      enforceAdminRateLimit: (input: Record<string, unknown>) => {
        adminRateLimitCalls.push(input);
      },
      grantPremium: async (input: Record<string, unknown>) => {
        grantCalls.push(input);
        return {
          accessTier: 'premium',
          premiumActive: true,
          writeAccess: true,
        };
      },
    },
    {
      log: async (input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
    },
  );

  try {
    const response = await controller.activateMockPremium(
      'Bearer token',
      { days: 14 },
      buildRequest('tenant-premium', 'user-77', ['admin']),
    );

    assert.equal(response.success, true);
    assert.deepEqual(grantCalls, [{ tenantId: 'tenant-premium', days: 14 }]);
    assert.equal(adminRateLimitCalls.length, 1);
    assert.equal(adminRateLimitCalls[0]?.action, 'billing.mock.activate');
    assert.equal(auditCalls.length, 1);
    const firstAudit = auditCalls[0];
    if (!firstAudit) {
      throw new Error('Expected first audit event');
    }
    assert.equal(firstAudit.action, 'billing.mock.activate');
    assert.equal(firstAudit.targetTenantId, 'tenant-premium');
  } finally {
    process.env.BILLING_MODE = originalBillingMode;
    delete process.env.BILLING_STUB_SELF_ACTIVATE;
  }
});

test('BillingController blocks non-admin self activation when BILLING_STUB_SELF_ACTIVATE is disabled', async () => {
  process.env.BILLING_MODE = 'stub';
  process.env.BILLING_STUB_SELF_ACTIVATE = 'false';
  const controller = new BillingController(
    {
      isAdmin: () => false,
      grantPremium: async () => ({}),
    },
    {
      log: async () => undefined,
    },
  );

  try {
    await assert.rejects(
      () => controller.activateMockPremium('Bearer token', {}, buildRequest('tenant-a')),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
          code: 'BILLING_MOCK_SELF_ACTIVATE_DISABLED',
          message: 'Mock self-activation is disabled',
        });
        return true;
      },
    );
  } finally {
    process.env.BILLING_MODE = originalBillingMode;
    delete process.env.BILLING_STUB_SELF_ACTIVATE;
  }
});

test('BillingController admin mock-payment requires admin role', async () => {
  process.env.BILLING_MODE = 'stub';
  const controller = new BillingController(
    {
      isAdmin: () => false,
      grantPremium: async () => ({}),
    },
    {
      log: async () => undefined,
    },
  );

  try {
    await assert.rejects(
      () =>
        controller.adminMockPayment(
          'Bearer token',
          { tenant_id: 'tenant-a', days: 30 },
          buildRequest('tenant-user', 'user-1', ['user']),
        ),
      (error: unknown) => {
        assert.ok(error instanceof ForbiddenException);
        assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
          code: 'AUTH_ADMIN_ROLE_REQUIRED',
          message: 'Admin role is required',
        });
        return true;
      },
    );
  } finally {
    process.env.BILLING_MODE = originalBillingMode;
  }
});

test('BillingController admin mock-payment grants premium for target tenant and writes audit event', async () => {
  process.env.BILLING_MODE = 'stub';
  const grantCalls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<Record<string, unknown>> = [];
  const adminRateLimitCalls: Array<Record<string, unknown>> = [];
  const controller = new BillingController(
    {
      isAdmin: (roles: string[]) =>
        roles.map((value) => String(value || '').toLowerCase()).includes('admin'),
      enforceAdminRateLimit: (input: Record<string, unknown>) => {
        adminRateLimitCalls.push(input);
      },
      grantPremium: async (input: Record<string, unknown>) => {
        grantCalls.push(input);
        return {
          accessTier: 'premium',
          premiumActive: true,
          writeAccess: true,
        };
      },
    },
    {
      log: async (input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
    },
  );

  try {
    const response = await controller.adminMockPayment(
      'Bearer token',
      { tenant_id: 'tenant-target', days: 30, payment_ref: 'manual-001' },
      buildRequest('tenant-admin', 'admin-1', ['admin']),
    );

    assert.equal(response.success, true);
    assert.deepEqual(grantCalls, [{ tenantId: 'tenant-target', days: 30 }]);
    assert.equal(adminRateLimitCalls.length, 1);
    assert.equal(adminRateLimitCalls[0]?.action, 'billing.admin.mock-payment');
    assert.equal(adminRateLimitCalls[0]?.principal, 'tenant-target');
    assert.equal(response.data.tenant_id, 'tenant-target');
    assert.equal(auditCalls.length, 1);
    const firstAudit = auditCalls[0];
    if (!firstAudit) {
      throw new Error('Expected first audit event');
    }
    assert.equal(firstAudit.action, 'billing.admin.mock_payment');
    assert.equal(firstAudit.targetTenantId, 'tenant-target');
  } finally {
    process.env.BILLING_MODE = originalBillingMode;
  }
});
