export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ThemeAssetsService } = require('./theme-assets.service.ts');

function createRepositoryStub(overrides = {}) {
  return {
    listByTenant: async () => [],
    findById: async () => null,
    upsert: async () => ({}),
    ...overrides,
  };
}

function createService(repositoryOverrides = {}) {
  const repository = createRepositoryStub(repositoryOverrides);
  const service = new ThemeAssetsService(repository);
  return { service, repository };
}

test('ThemeAssetsService requires tenantId', async () => {
  const { service } = createService();
  await assert.rejects(() => service.listAssets(''), /tenantId is required/);
  await assert.rejects(
    () =>
      service.createPresignedUpload(
        { filename: 'bg.png', mime_type: 'image/png', size_bytes: 1024 },
        '',
      ),
    /tenantId is required/,
  );
});

test('ThemeAssetsService persists and reads assets via repository', async () => {
  const records = new Map<string, Record<string, unknown>>();
  const { service } = createService({
    listByTenant: async (tenantId: unknown) => {
      const prefix = `${String(tenantId)}:`;
      return [...records.entries()]
        .filter(([key]) => key.startsWith(prefix))
        .map(([, value]) => ({ payload: value }));
    },
    findById: async (tenantId: unknown, id: unknown) => {
      const key = `${String(tenantId)}:${String(id)}`;
      const value = records.get(key);
      return value ? { payload: value } : null;
    },
    upsert: async (input: unknown) => {
      const typed = input as { tenantId: string; id: string; payload: Record<string, unknown> };
      records.set(`${typed.tenantId}:${typed.id}`, typed.payload);
      return { payload: typed.payload };
    },
  });

  const a = await service.createPresignedUpload(
    { filename: 'a.png', mime_type: 'image/png', size_bytes: 10 },
    'tenant-a',
  );
  const b = await service.createPresignedUpload(
    { filename: 'b.png', mime_type: 'image/png', size_bytes: 10 },
    'tenant-b',
  );

  assert.equal((await service.listAssets('tenant-a')).items.length, 1);
  assert.equal((await service.listAssets('tenant-b')).items.length, 1);
  assert.equal(await service.completeUpload({ asset_id: b.asset_id }, 'tenant-a'), null);
  assert.equal(await service.deleteAsset(a.asset_id, 'tenant-b'), null);
});

test('ThemeAssetsService uses repository list path', async () => {
  const row = {
    payload: {
      id: 'asset-1',
      object_key: 'theme-assets/tenant-a/asset-1-a.png',
      mime_type: 'image/png',
      size_bytes: 100,
      width: 100,
      height: 100,
      status: 'ready',
      image_url: 'https://example.local/theme-assets/asset-1',
      image_url_expires_at_ms: Date.now() + 10_000,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
  };
  const { service } = createService({
    listByTenant: async () => [row],
  });
  const list = await service.listAssets('tenant-a');
  assert.equal(list.items.length, 1);
  assert.equal(list.items[0].id, 'asset-1');
});

test('ThemeAssetsService fails hard on repository errors', async () => {
  const { service } = createService({
    listByTenant: async () => {
      throw new Error('repo unavailable');
    },
  });
  await assert.rejects(() => service.listAssets('tenant-a'), /repo unavailable/);
});
