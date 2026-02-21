export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { WorkspaceService } = require('./workspace.service.ts');

type RepositoryStub = {
  list: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
  findById: (...args: unknown[]) => Promise<Record<string, unknown> | null>;
  upsert: (...args: unknown[]) => Promise<Record<string, unknown>>;
  delete: (...args: unknown[]) => Promise<boolean>;
};

function createService(repositoryStub: RepositoryStub) {
  return new WorkspaceService(repositoryStub);
}

test('WorkspaceService requires tenantId', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => null,
    upsert: async () => ({}),
    delete: async () => false,
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list('notes', {}, ''), /tenantId is required/);
  await assert.rejects(() => service.getById('notes', 'n-1', ''), /tenantId is required/);
  await assert.rejects(
    () => service.create('notes', { title: 'a' }, 'n-1', ''),
    /tenantId is required/,
  );
});

test('WorkspaceService uses repository for create/list paths', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => null,
    upsert: async (input) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      return { id: typed.id, payload: typed.payload };
    },
    delete: async () => true,
  };
  const service = createService(repositoryStub);
  const created = await service.create('notes', { title: 'n1' }, 'n-1', 'tenant-a');
  assert.equal(created.id, 'n-1');

  const listed = await service.list('notes', {}, 'tenant-a');
  assert.equal(listed.total, 0);
});

test('WorkspaceService fails hard on repository errors', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => {
      throw new Error('db list failed');
    },
    findById: async () => null,
    upsert: async () => {
      throw new Error('db upsert failed');
    },
    delete: async () => false,
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list('notes', {}, 'tenant-a'), /db list failed/);
  await assert.rejects(
    () => service.create('notes', { title: 'n1' }, 'n-1', 'tenant-a'),
    /db upsert failed/,
  );
});

test('WorkspaceService fails fast on repository errors (no fallback path)', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => {
      throw new Error('db list failed dual');
    },
    findById: async () => {
      throw new Error('db find failed dual');
    },
    upsert: async () => {
      throw new Error('db upsert failed dual');
    },
    delete: async () => {
      throw new Error('db delete failed dual');
    },
  };
  const service = createService(repositoryStub);
  await assert.rejects(
    () => service.create('notes', { title: 'n1' }, 'n-1', 'tenant-a'),
    /db upsert failed dual/,
  );
  await assert.rejects(() => service.list('notes', {}, 'tenant-a'), /db list failed dual/);
  await assert.rejects(() => service.getById('notes', 'n-1', 'tenant-a'), /db find failed dual/);
  await assert.rejects(() => service.remove('notes', 'n-1', 'tenant-a'), /db delete failed dual/);
});
