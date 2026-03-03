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

test('ResourcesService passes plain payload to repository and returns record shape', async () => {
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
  assert.equal(
    Boolean(lastUpsertPayload && Object.hasOwn(lastUpsertPayload, '__enc_payload_v1')),
    false,
  );
  assert.equal((lastUpsertPayload as Record<string, unknown> | null)?.token, 'top-secret');

  const listed = await service.list('subscriptions', {}, 'tenant-a');
  assert.equal(listed.items[0].token, 'top-secret');
});

test('ResourcesService computes status metadata for proxies, licenses and subscriptions', async () => {
  const fixedNow = 1_700_000_000_000;
  const day = 24 * 60 * 60 * 1000;
  const originalNow = Date.now;
  Date.now = () => fixedNow;

  try {
    const repository: RepositoryStub = {
      list: async (_tenantId: unknown, kind: unknown) => {
        if (kind === 'proxies') {
          return [
            {
              id: 'proxy-banned',
              payload: { id: 'proxy-banned', status: 'banned', expires_at: fixedNow + 10 * day },
            },
            {
              id: 'proxy-expiring',
              payload: { id: 'proxy-expiring', status: 'active', expires_at: fixedNow + 3 * day },
            },
            {
              id: 'proxy-active',
              payload: { id: 'proxy-active', status: 'active', expires_at: fixedNow + 30 * day },
            },
          ];
        }

        if (kind === 'licenses') {
          return [
            {
              id: 'license-expired',
              payload: { id: 'license-expired', status: 'active', expires_at: fixedNow - day },
            },
            {
              id: 'license-expiring',
              payload: { id: 'license-expiring', status: 'active', expires_at: fixedNow + 2 * day },
            },
          ];
        }

        return [
          {
            id: 'sub-active',
            payload: { id: 'sub-active', status: 'active', expires_at: fixedNow + 20 * day },
          },
        ];
      },
      findById: async (_tenantId: unknown, kind: unknown, id: unknown) => {
        if (kind === 'subscriptions' && String(id) === 'sub-missing-expiry') {
          return {
            id: 'sub-missing-expiry',
            payload: { id: 'sub-missing-expiry', status: 'active' },
          };
        }
        return null;
      },
      upsert: async () => ({ id: 'noop', payload: {} }),
      delete: async () => true,
    };

    const service = createService(repository);

    const proxies = await service.list('proxies', {}, 'tenant-a');
    const bannedProxy = proxies.items.find(
      (item: Record<string, unknown>) => item.id === 'proxy-banned',
    );
    assert.equal(bannedProxy?.computed_status, 'banned');
    assert.equal(bannedProxy?.days_remaining, 0);
    assert.equal(bannedProxy?.is_expiring_soon, false);

    const expiringProxy = proxies.items.find(
      (item: Record<string, unknown>) => item.id === 'proxy-expiring',
    );
    assert.equal(expiringProxy?.computed_status, 'expiring');
    assert.equal(expiringProxy?.days_remaining, 3);
    assert.equal(expiringProxy?.is_expiring_soon, true);

    const licenses = await service.list('licenses', {}, 'tenant-a');
    const expiredLicense = licenses.items.find(
      (item: Record<string, unknown>) => item.id === 'license-expired',
    );
    assert.equal(expiredLicense?.computed_status, 'expired');
    assert.equal(expiredLicense?.days_remaining, 0);
    assert.equal(expiredLicense?.is_expiring_soon, false);

    const expiringLicense = licenses.items.find(
      (item: Record<string, unknown>) => item.id === 'license-expiring',
    );
    assert.equal(expiringLicense?.computed_status, 'expiring');
    assert.equal(expiringLicense?.days_remaining, 2);
    assert.equal(expiringLicense?.is_expiring_soon, true);

    const subscriptions = await service.list('subscriptions', {}, 'tenant-a');
    const activeSubscription = subscriptions.items[0];
    assert.equal(activeSubscription.computed_status, 'active');
    assert.equal(activeSubscription.days_remaining, 20);
    assert.equal(activeSubscription.is_expiring_soon, false);

    const missingExpiry = await service.getById('subscriptions', 'sub-missing-expiry', 'tenant-a');
    assert.equal(missingExpiry?.computed_status, 'active');
    assert.equal(missingExpiry?.days_remaining, null);
    assert.equal(missingExpiry?.is_expiring_soon, false);
  } finally {
    Date.now = originalNow;
  }
});
