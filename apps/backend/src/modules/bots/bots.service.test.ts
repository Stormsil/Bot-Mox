export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BotsService } = require('./bots.service.ts');

type RepositoryStub = {
  list: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
  findById: (...args: unknown[]) => Promise<Record<string, unknown> | null>;
  upsert: (...args: unknown[]) => Promise<Record<string, unknown>>;
  delete: (...args: unknown[]) => Promise<boolean>;
};

function createService(repositoryStub: RepositoryStub) {
  return new BotsService(repositoryStub);
}

test('BotsService requires tenantId', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => null,
    upsert: async () => ({}),
    delete: async () => false,
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list({}, ''), /tenantId is required/);
  await assert.rejects(() => service.getById('b-1', ''), /tenantId is required/);
  await assert.rejects(() => service.create({ name: 'bot-1' }, 'b-1', ''), /tenantId is required/);
});

test('BotsService fails hard on repository errors', async () => {
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
    () => service.create({ status: 'offline' }, 'b-1', 'tenant-a'),
    /repo upsert failed/,
  );
});

test('BotsService CRUD/list use repository only', async () => {
  const records = new Map<string, Record<string, unknown>>();
  const repositoryStub: RepositoryStub = {
    list: async () => [...records.values()].map((record) => ({ id: record.id, payload: record })),
    findById: async (_tenantId: unknown, id: unknown) => {
      const key = String(id);
      const record = records.get(key);
      return record ? { id: key, payload: record } : null;
    },
    upsert: async (input: unknown) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      records.set(typed.id, typed.payload);
      return { id: typed.id, payload: typed.payload };
    },
    delete: async (_tenantId: unknown, id: unknown) => {
      const key = String(id);
      const existed = records.has(key);
      records.delete(key);
      return existed;
    },
  };
  const service = createService(repositoryStub);
  const created = await service.create({ status: 'offline' }, 'b-1', 'tenant-a');
  assert.equal(created.id, 'b-1');
  const listed = await service.list({}, 'tenant-a');
  assert.equal(listed.total, 1);
  const fetched = await service.getById('b-1', 'tenant-a');
  assert.equal(fetched?.id, 'b-1');
  const removed = await service.remove('b-1', 'tenant-a');
  assert.equal(removed, true);
});
