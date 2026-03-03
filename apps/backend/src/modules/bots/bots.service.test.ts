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

test('BotsService passes plain payload to repository and returns record shape', async () => {
  let persistedRow: Record<string, unknown> | null = null;

  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => null,
    upsert: async (input: unknown) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      persistedRow = {
        id: typed.id,
        payload: typed.payload,
      };
      return persistedRow;
    },
    delete: async () => false,
  };

  const service = createService(repositoryStub);
  const created = await service.create({ status: 'offline', name: 'bot enc' }, 'b-enc', 'tenant-a');

  assert.equal(created.id, 'b-enc');
  assert.equal(created.name, 'bot enc');
  assert.ok(persistedRow);

  const persisted = persistedRow as unknown as Record<string, unknown>;
  const persistedPayload = persisted.payload as Record<string, unknown>;
  assert.equal(Object.hasOwn(persistedPayload, '__enc_payload_v1'), false);
  assert.equal(persistedPayload.name, 'bot enc');
  assert.equal(persistedPayload.id, 'b-enc');
});

test('BotsService keeps legacy plaintext payload compatible', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => ({
      id: 'b-legacy',
      payload: {
        id: 'b-legacy',
        name: 'legacy bot',
        status: 'offline',
      },
    }),
    upsert: async () => {
      throw new Error('should_not_upsert');
    },
    delete: async () => false,
  };

  const service = createService(repositoryStub);
  const item = await service.getById('b-legacy', 'tenant-a');
  assert.equal(item?.id, 'b-legacy');
  assert.equal(item?.name, 'legacy bot');
});

test('BotsService computes status metadata with banned and offline precedence', async () => {
  const fixedNow = 1_700_000_000_000;
  const originalNow = Date.now;
  Date.now = () => fixedNow;

  try {
    const repositoryStub: RepositoryStub = {
      list: async () => [
        {
          id: 'bot-banned',
          payload: {
            id: 'bot-banned',
            status: 'banned',
            last_seen: fixedNow - 60_000,
          },
        },
        {
          id: 'bot-offline',
          payload: {
            id: 'bot-offline',
            status: 'farming',
            last_seen: fixedNow - 6 * 60 * 1000,
          },
        },
        {
          id: 'bot-online',
          payload: {
            id: 'bot-online',
            status: 'prepare',
            last_seen: fixedNow - 2 * 60 * 1000,
          },
        },
      ],
      findById: async (_tenantId: unknown, id: unknown) => {
        if (String(id) === 'bot-missing-seen') {
          return {
            id: 'bot-missing-seen',
            payload: {
              id: 'bot-missing-seen',
            },
          };
        }
        return null;
      },
      upsert: async () => {
        throw new Error('not_needed');
      },
      delete: async () => false,
    };

    const service = createService(repositoryStub);
    const listed = await service.list({}, 'tenant-a');

    const banned = listed.items.find((item: Record<string, unknown>) => item.id === 'bot-banned');
    assert.equal(banned?.computed_status, 'banned');
    assert.equal(banned?.days_remaining, null);
    assert.equal(banned?.is_expiring_soon, false);

    const offline = listed.items.find((item: Record<string, unknown>) => item.id === 'bot-offline');
    assert.equal(offline?.computed_status, 'offline');

    const online = listed.items.find((item: Record<string, unknown>) => item.id === 'bot-online');
    assert.equal(online?.computed_status, 'prepare');

    const missingSeen = await service.getById('bot-missing-seen', 'tenant-a');
    assert.equal(missingSeen?.computed_status, 'offline');
    assert.equal(missingSeen?.days_remaining, null);
    assert.equal(missingSeen?.is_expiring_soon, false);
  } finally {
    Date.now = originalNow;
  }
});
