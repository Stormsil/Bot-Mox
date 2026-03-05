export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ThemeAssetsRepository } = require('./theme-assets.repository.ts');

test('ThemeAssetsRepository cutover paths avoid legacy theme_asset_items access', async () => {
  const prisma = {
    withTenantContext: async () => {
      throw new Error('legacy theme_asset_items path must not be used');
    },
    $queryRaw: async () => [
      {
        id: 'asset-1',
        data: {},
        object_key: 'theme-assets/tenant-a/asset-1.png',
        mime_type: 'image/png',
        size_bytes: 100,
        width: 100,
        height: 100,
        status: 'ready',
        image_url: null,
        image_url_expires_at_ms: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
  };

  const repository = new ThemeAssetsRepository(prisma);
  const upserted = await repository.upsert({
    tenantId: 'tenant-a',
    id: 'asset-1',
    payload: {
      id: 'asset-1',
      object_key: 'theme-assets/tenant-a/asset-1.png',
      mime_type: 'image/png',
      size_bytes: 100,
      status: 'ready',
    },
  });

  assert.equal(upserted.id, 'asset-1');
});
