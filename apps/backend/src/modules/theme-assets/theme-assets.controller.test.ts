export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException } = require('@nestjs/common');
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

test('ThemeAssetsController accepts request identity without bearer header in list', async () => {
  const controller = new ThemeAssetsController(createServiceStub());

  const result = await controller.list(buildRequest('tenant-a'));

  assert.equal(result.success, true);
  assert.equal(typeof result.data, 'object');
});

test('ThemeAssetsController returns deterministic code for missing asset on complete', async () => {
  const controller = new ThemeAssetsController(createServiceStub());

  await assert.rejects(
    () => controller.completeUpload({ asset_id: 'asset-1' }, buildRequest('tenant-a')),
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
