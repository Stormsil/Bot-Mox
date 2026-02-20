export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { PlaybooksService } = require('./playbooks.service.ts');

type RepositoryStub = {
  list: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
  findById: (...args: unknown[]) => Promise<Record<string, unknown> | null>;
  upsert: (...args: unknown[]) => Promise<Record<string, unknown>>;
  delete: (...args: unknown[]) => Promise<boolean>;
};

function createService(repositoryStub: RepositoryStub) {
  return new PlaybooksService(repositoryStub);
}

test('PlaybooksService requires tenantId', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => null,
    upsert: async () => ({}),
    delete: async () => false,
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list(''), /tenantId is required/);
  await assert.rejects(() => service.getById('pb-1', ''), /tenantId is required/);
  await assert.rejects(
    () => service.create({ name: 'Test', content: 'name: x\nroles:\n- y' }, ''),
    /tenantId is required/,
  );
});

test('PlaybooksService uses repository list results', async () => {
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
  await service.create(
    { id: 'pb-a', name: 'Tenant A', content: 'name: a\nroles:\n- r' },
    'tenant-a',
  );
  const list = await service.list('tenant-a');
  assert.equal(list.length, 1);
  assert.equal(list[0].name, 'Tenant A');
});

test('PlaybooksService fails hard on repository errors', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => {
      throw new Error('repo list failed');
    },
    findById: async () => {
      throw new Error('repo find failed');
    },
    upsert: async () => {
      throw new Error('repo upsert failed');
    },
    delete: async () => {
      throw new Error('repo delete failed');
    },
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list('tenant-a'), /repo list failed/);
  await assert.rejects(
    () => service.create({ name: 'PB', content: 'name: x\nroles:\n- y' }, 'tenant-a'),
    /repo upsert failed/,
  );
});

test('PlaybooksService keeps single default flag when switching defaults', async () => {
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
  await service.create(
    { id: 'pb-1', name: 'Primary', content: 'name: a\nroles:\n- r', is_default: true },
    'tenant-a',
  );
  await service.create(
    { id: 'pb-2', name: 'Secondary', content: 'name: b\nroles:\n- r', is_default: true },
    'tenant-a',
  );
  const list = await service.list('tenant-a');
  const defaults = list.filter((record: Record<string, unknown>) => record.is_default === true);
  assert.equal(defaults.length, 1);
  assert.equal(defaults[0].id, 'pb-2');
});
