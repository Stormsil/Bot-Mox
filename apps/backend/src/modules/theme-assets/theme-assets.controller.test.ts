export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { ThemeAssetsController } = require('./theme-assets.controller.ts');

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
    listAssets: async () => ({ generated_at_ms: Date.now(), items: [] }),
    createPresignedUpload: async () => ({}),
    completeUpload: async () => null,
    deleteAsset: async () => null,
  };
}

test('ThemeAssetsController returns deterministic code for missing bearer token', async () => {
  const controller = new ThemeAssetsController(createServiceStub());

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

test('ThemeAssetsController returns deterministic code for missing asset on complete', async () => {
  const controller = new ThemeAssetsController(createServiceStub());

  await assert.rejects(
    () =>
      controller.completeUpload(
        'Bearer test-token',
        { asset_id: 'asset-1' },
        buildRequest('tenant-a'),
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'THEME_ASSET_NOT_FOUND',
        message: 'Theme asset not found',
      });
      return true;
    },
  );
});
