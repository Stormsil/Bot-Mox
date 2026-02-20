export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { SettingsService } = require('./settings.service.ts');

type RepositoryStub = {
  findByPath: (...args: unknown[]) => Promise<Record<string, unknown> | null>;
  upsert: (...args: unknown[]) => Promise<Record<string, unknown>>;
};

function createService(repositoryStub: RepositoryStub) {
  return new SettingsService(repositoryStub);
}

test('SettingsService requires tenantId', async () => {
  const repositoryStub: RepositoryStub = {
    findByPath: async () => null,
    upsert: async () => ({ payload: {} }),
  };
  const service = createService(repositoryStub);
  assert.throws(() => service.getApiKeys(''), /tenantId is required/);
  assert.throws(() => service.getProxy(''), /tenantId is required/);
  assert.throws(
    () => service.updateNotificationEvents({ channels: ['telegram'] }, ''),
    /tenantId is required/,
  );
});

test('SettingsService uses repository storage for proxy settings', async () => {
  const records = new Map<string, Record<string, unknown>>();
  const repositoryStub: RepositoryStub = {
    findByPath: async (tenantId: unknown, path: unknown) => {
      const key = `${String(tenantId)}:${String(path)}`;
      const payload = records.get(key);
      return payload ? { payload } : null;
    },
    upsert: async (input: unknown) => {
      const typed = input as { tenantId: string; path: string; payload: Record<string, unknown> };
      records.set(`${typed.tenantId}:${typed.path}`, typed.payload);
      return { payload: typed.payload };
    },
  };
  const service = createService(repositoryStub);
  const tenantA = await service.updateProxy({ host: 'proxy-a.local', port: 8080 }, 'tenant-a');
  const tenantB = await service.updateProxy({ host: 'proxy-b.local', port: 8081 }, 'tenant-b');
  assert.equal(tenantA.host, 'proxy-a.local');
  assert.equal(tenantB.host, 'proxy-b.local');
  assert.equal((await service.getProxy('tenant-a'))?.host, 'proxy-a.local');
  assert.equal((await service.getProxy('tenant-b'))?.host, 'proxy-b.local');
});

test('SettingsService uses repository read paths', async () => {
  const repositoryStub: RepositoryStub = {
    findByPath: async (_tenantId, path) => {
      if (path === 'settings/proxy') {
        return { payload: { host: 'proxy-db.local', port: 8088 } };
      }
      return null;
    },
    upsert: async (input) => {
      const typed = input as { payload: Record<string, unknown> };
      return { payload: typed.payload };
    },
  };
  const service = createService(repositoryStub);
  const proxy = await service.getProxy('tenant-a');
  assert.equal(proxy?.host, 'proxy-db.local');
  const updated = await service.updateProxy({ host: 'proxy-updated.local' }, 'tenant-a');
  assert.equal(updated.host, 'proxy-updated.local');
});

test('SettingsService fails hard on repository errors', async () => {
  const repositoryStub: RepositoryStub = {
    findByPath: async () => {
      throw new Error('repo read failed');
    },
    upsert: async () => {
      throw new Error('repo write failed');
    },
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.getApiKeys('tenant-a'), /repo read failed/);
  await assert.rejects(
    () => service.updateApiKeys({ openai_api_key: 'k' }, 'tenant-a'),
    /repo read failed|repo write failed/,
  );
});
