export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { FinanceService } = require('./finance.service.ts');

type RepositoryStub = {
  list: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
  findById: (...args: unknown[]) => Promise<Record<string, unknown> | null>;
  upsert: (...args: unknown[]) => Promise<Record<string, unknown>>;
  delete: (...args: unknown[]) => Promise<boolean>;
};

function createService(repositoryStub: RepositoryStub) {
  return new FinanceService(repositoryStub);
}

test('FinanceService requires tenantId', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => null,
    upsert: async () => ({}),
    delete: async () => false,
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list({}, ''), /tenantId is required/);
  await assert.rejects(() => service.getById('id-1', ''), /tenantId is required/);
  await assert.rejects(() => service.create({ amount: 10 }, undefined, ''), /tenantId is required/);
});

test('FinanceService fails hard on repository errors', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => {
      throw new Error('repo list failed');
    },
    findById: async () => null,
    upsert: async () => {
      throw new Error('repo upsert failed');
    },
    delete: async () => false,
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list({}, 'tenant-a'), /repo list failed/);
  await assert.rejects(
    () => service.create({ amount: 10, type: 'income' }, undefined, 'tenant-a'),
    /repo upsert failed/,
  );
});

test('FinanceService CRUD/list use repository only', async () => {
  const records = new Map<string, Record<string, unknown>>();
  const dbRows = new Map<string, Record<string, unknown>>();
  const repositoryStub: RepositoryStub = {
    list: async () => [...dbRows.values()],
    findById: async (_tenantId: unknown, id: unknown) => {
      const key = String(id);
      return dbRows.get(key) ?? null;
    },
    upsert: async (input: unknown) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      dbRows.set(typed.id, { id: typed.id, payload: typed.payload });
      records.set(typed.id, typed.payload);
      return dbRows.get(typed.id) as Record<string, unknown>;
    },
    delete: async (_tenantId: unknown, id: unknown) => {
      const key = String(id);
      const existed = dbRows.has(key);
      dbRows.delete(key);
      records.delete(key);
      return existed;
    },
  };
  const service = createService(repositoryStub);
  const created = await service.create({ amount: 42, type: 'income' }, 'fin-1', 'tenant-a');
  assert.equal(created.id, 'fin-1');
  const listed = await service.list({}, 'tenant-a');
  assert.equal(listed.total, 1);
  const fetched = await service.getById('fin-1', 'tenant-a');
  assert.equal(fetched?.id, 'fin-1');
  const removed = await service.remove('fin-1', 'tenant-a');
  assert.equal(removed, true);
});

test('FinanceService passes plain payload to repository and returns record shape', async () => {
  let lastUpsertPayload: Record<string, unknown> | null = null;
  const dbRows = new Map<string, Record<string, unknown>>();
  const repositoryStub: RepositoryStub = {
    list: async () => [...dbRows.values()],
    findById: async (_tenantId: unknown, id: unknown) => dbRows.get(String(id)) ?? null,
    upsert: async (input: unknown) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      lastUpsertPayload = typed.payload;
      const row = { id: typed.id, payload: typed.payload };
      dbRows.set(typed.id, row);
      return row;
    },
    delete: async () => false,
  };

  const service = createService(repositoryStub);
  const created = await service.create(
    { id: 'fin-sec-1', amount: 77, note: 'private note' },
    undefined,
    'tenant-a',
  );

  assert.equal(created.id, 'fin-sec-1');
  assert.equal(created.note, 'private note');
  assert.ok(lastUpsertPayload && typeof lastUpsertPayload === 'object');
  assert.equal(Object.hasOwn(lastUpsertPayload || {}, '__enc_payload_v1'), false);
  assert.equal((lastUpsertPayload as Record<string, unknown> | null)?.note, 'private note');

  const listed = await service.list({}, 'tenant-a');
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].note, 'private note');
});
