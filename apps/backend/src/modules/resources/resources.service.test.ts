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
  const dbRows = new Map<string, Record<string, unknown>>();
  const repository: RepositoryStub = {
    list: async () => [...dbRows.values()],
    findById: async (_tenantId: unknown, _kind: unknown, id: unknown) => {
      const key = String(id);
      return dbRows.get(key) ?? null;
    },
    upsert: async (input: unknown) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      records.set(typed.id, typed.payload);
      const row = { id: typed.id, payload: typed.payload };
      dbRows.set(typed.id, row);
      return row;
    },
    delete: async (_tenantId: unknown, _kind: unknown, id: unknown) => {
      const key = String(id);
      const existed = dbRows.has(key);
      dbRows.delete(key);
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

test('ResourcesService stores encrypted payload and returns decrypted shape', async () => {
  let lastUpsertPayload: Record<string, unknown> | null = null;
  const dbRows = new Map<string, Record<string, unknown>>();
  const repository: RepositoryStub = {
    list: async () => [...dbRows.values()],
    findById: async (_tenantId: unknown, _kind: unknown, id: unknown) =>
      dbRows.get(String(id)) ?? null,
    upsert: async (input: unknown) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      lastUpsertPayload = typed.payload;
      const row = { id: typed.id, payload: typed.payload };
      dbRows.set(typed.id, row);
      return row;
    },
    delete: async () => false,
  };
  const service = createService(repository);
  const created = await service.create(
    'subscriptions',
    { id: 'sub-1', email: 'user@local', token: 'top-secret' },
    undefined,
    'tenant-a',
  );
  assert.equal(created.id, 'sub-1');
  assert.equal(created.token, 'top-secret');
  assert.ok(lastUpsertPayload && Object.hasOwn(lastUpsertPayload, '__enc_payload_v1'));
  assert.equal(Object.hasOwn(lastUpsertPayload || {}, 'token'), false);

  const listed = await service.list('subscriptions', {}, 'tenant-a');
  assert.equal(listed.items[0].token, 'top-secret');
});
