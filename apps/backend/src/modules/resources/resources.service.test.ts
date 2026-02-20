export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ResourcesService } = require('./resources.service.ts');

type RepositoryStub = {
  list: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
  findById: (...args: unknown[]) => Promise<Record<string, unknown> | null>;
  upsert: (...args: unknown[]) => Promise<Record<string, unknown>>;
  delete: (...args: unknown[]) => Promise<boolean>;
};

function createService(repository: RepositoryStub) {
  return new ResourcesService(repository);
}

test('ResourcesService uses repository list result', async () => {
  const repository: RepositoryStub = {
    list: async () => [{ id: 'lic-db-1', payload: { id: 'lic-db-1', key: 'db' } }],
    findById: async () => null,
    upsert: async () => ({ id: 'lic-db-1', payload: { id: 'lic-db-1', key: 'db' } }),
    delete: async () => true,
  };
  const service = createService(repository);
  const result = await service.list('licenses', {}, 'tenant-a');
  assert.equal(result.total, 1);
  assert.equal(result.items[0].id, 'lic-db-1');
  assert.equal(result.items[0].key, 'db');
});

test('ResourcesService fails fast on repository list error', async () => {
  const repository: RepositoryStub = {
    list: async () => {
      throw new Error('repo list failed');
    },
    findById: async () => null,
    upsert: async () => ({ id: 'noop', payload: {} }),
    delete: async () => true,
  };
  const service = createService(repository);
  await assert.rejects(() => service.list('licenses', {}, 'tenant-a'), /repo list failed/);
});

test('ResourcesService create/get/update/remove use repository only', async () => {
  const records = new Map<string, Record<string, unknown>>();
  const repository: RepositoryStub = {
    list: async () => [...records.values()].map((record) => ({ id: record.id, payload: record })),
    findById: async (_tenantId: unknown, _kind: unknown, id: unknown) => {
      const key = String(id);
      const record = records.get(key);
      if (!record) {
        return null;
      }
      return { id: key, payload: record };
    },
    upsert: async (input: unknown) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      records.set(typed.id, typed.payload);
      return { id: typed.id, payload: typed.payload };
    },
    delete: async (_tenantId: unknown, _kind: unknown, id: unknown) => {
      const key = String(id);
      const existed = records.has(key);
      records.delete(key);
      return existed;
    },
  };
  const service = createService(repository);
  const created = await service.create(
    'licenses',
    { id: 'lic-1', name: 'License 1' },
    undefined,
    'tenant-a',
  );
  assert.equal(created.id, 'lic-1');

  const listed = await service.list('licenses', {}, 'tenant-a');
  assert.equal(listed.total, 1);
  assert.equal(listed.items[0].id, 'lic-1');

  const fetched = await service.getById('licenses', 'lic-1', 'tenant-a');
  assert.ok(fetched);
  assert.equal(fetched?.id, 'lic-1');

  const updated = await service.update(
    'licenses',
    'lic-1',
    { name: 'License 1 Updated' },
    'tenant-a',
  );
  assert.equal(updated?.name, 'License 1 Updated');

  const deleted = await service.remove('licenses', 'lic-1', 'tenant-a');
  assert.equal(deleted, true);
});
