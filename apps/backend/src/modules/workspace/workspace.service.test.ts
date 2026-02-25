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
      const typed = input as { id: string; kind: string; payload: Record<string, unknown> };
      return { id: typed.id, kind: typed.kind, payload: typed.payload };
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

test('WorkspaceService encrypts sensitive notes fields and returns decrypted shape', async () => {
  let storedPayload = {} as Record<string, unknown>;

  const repositoryStub: RepositoryStub = {
    list: async () => [{ id: 'n-enc', kind: 'notes', payload: storedPayload }],
    findById: async () => ({ id: 'n-enc', kind: 'notes', payload: storedPayload }),
    upsert: async (input) => {
      const typed = input as { id: string; kind: string; payload: Record<string, unknown> };
      storedPayload = typed.payload;
      return { id: typed.id, kind: typed.kind, payload: typed.payload };
    },
    delete: async () => true,
  };

  const service = createService(repositoryStub);
  const created = await service.create(
    'notes',
    {
      title: 'private title',
      content: 'private body',
      preview: 'private preview',
      tags: ['personal'],
      blocks: {
        b1: { id: 'b1', type: 'text', content: 'super secret block' },
      },
    },
    'n-enc',
    'tenant-a',
  );

  assert.equal(created.title, 'private title');
  assert.equal(created.content, 'private body');
  assert.equal(Array.isArray(created.tags), true);
  assert.equal((created.tags as unknown[])[0], 'personal');
  assert.equal(
    ((created.blocks as Record<string, unknown>).b1 as Record<string, unknown>).content,
    'super secret block',
  );

  assert.equal(Object.hasOwn(storedPayload, '__enc_payload_v1'), false);
  assert.equal(typeof storedPayload.title, 'object');
  assert.equal(typeof storedPayload.content, 'object');

  const loaded = await service.getById('notes', 'n-enc', 'tenant-a');
  assert.equal(loaded?.title, 'private title');
  assert.equal(loaded?.content, 'private body');
});

test('WorkspaceService stores non-notes workspace payload without service-side envelope wrapping', async () => {
  let storedPayload = {} as Record<string, unknown>;

  const repositoryStub: RepositoryStub = {
    list: async () => [{ id: 'k-1', kind: 'kanban', payload: storedPayload }],
    findById: async () => ({ id: 'k-1', kind: 'kanban', payload: storedPayload }),
    upsert: async (input) => {
      const typed = input as { id: string; kind: string; payload: Record<string, unknown> };
      storedPayload = typed.payload;
      return { id: typed.id, kind: typed.kind, payload: typed.payload };
    },
    delete: async () => true,
  };

  const service = createService(repositoryStub);
  const created = await service.create(
    'kanban',
    {
      title: 'personal board',
      columns: [{ id: 'c1', name: 'todo', tasks: [{ id: 't1', text: 'private task body' }] }],
    },
    'k-1',
    'tenant-a',
  );

  assert.equal(created.title, 'personal board');
  assert.equal(Object.hasOwn(storedPayload, '__enc_payload_v1'), false);
  assert.equal(storedPayload.title, 'personal board');

  const loaded = await service.getById('kanban', 'k-1', 'tenant-a');
  assert.equal(loaded?.title, 'personal board');
});

test('WorkspaceService keeps legacy plaintext notes compatible', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => ({
      id: 'n-legacy',
      kind: 'notes',
      payload: {
        id: 'n-legacy',
        title: 'legacy title',
        content: 'legacy content',
        blocks: {
          b1: { id: 'b1', type: 'text', content: 'legacy block' },
        },
      },
    }),
    upsert: async () => ({}),
    delete: async () => false,
  };

  const service = createService(repositoryStub);
  const loaded = await service.getById('notes', 'n-legacy', 'tenant-a');
  assert.equal(loaded?.title, 'legacy title');
  assert.equal(loaded?.content, 'legacy content');
  assert.equal(
    ((loaded?.blocks as Record<string, unknown>).b1 as Record<string, unknown>).content as string,
    'legacy block',
  );
});
