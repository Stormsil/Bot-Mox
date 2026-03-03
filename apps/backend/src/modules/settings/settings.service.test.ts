export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ScheduleValidationError, SettingsService } = require('./settings.service.ts');

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
  const dbRows = new Map<string, Record<string, unknown>>();
  const repositoryStub: RepositoryStub = {
    findByPath: async (tenantId: unknown, path: unknown) => {
      const key = `${String(tenantId)}:${String(path)}`;
      return dbRows.get(key) ?? null;
    },
    upsert: async (input: unknown) => {
      const typed = input as { tenantId: string; path: string; payload: Record<string, unknown> };
      records.set(`${typed.tenantId}:${typed.path}`, typed.payload);
      const row = { payload: typed.payload };
      dbRows.set(`${typed.tenantId}:${typed.path}`, row);
      return row;
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

test('SettingsService passes plain payload to repository and returns settings shape', async () => {
  let lastPayload: Record<string, unknown> | null = null;
  const dbRows = new Map<string, Record<string, unknown>>();
  const repositoryStub: RepositoryStub = {
    findByPath: async (tenantId: unknown, path: unknown) =>
      dbRows.get(`${String(tenantId)}:${String(path)}`) ?? null,
    upsert: async (input: unknown) => {
      const typed = input as { tenantId: string; path: string; payload: Record<string, unknown> };
      lastPayload = typed.payload;
      const row = { payload: typed.payload };
      dbRows.set(`${typed.tenantId}:${typed.path}`, row);
      return row;
    },
  };
  const service = createService(repositoryStub);

  const updated = await service.updateApiKeys({ openai_api_key: 'super-secret' }, 'tenant-a');
  assert.equal(updated.openai_api_key, 'super-secret');
  assert.equal(Boolean(lastPayload && Object.hasOwn(lastPayload, '__enc_payload_v1')), false);
  assert.equal((lastPayload as Record<string, unknown> | null)?.openai_api_key, 'super-secret');

  const read = await service.getApiKeys('tenant-a');
  assert.equal(read?.openai_api_key, 'super-secret');
});

test('SettingsService keeps legacy plaintext payload compatible', async () => {
  const repositoryStub: RepositoryStub = {
    findByPath: async (_tenantId: unknown, path: unknown) => {
      if (String(path) === 'settings/api_keys') {
        return { payload: { openai_api_key: 'legacy-key' } };
      }
      return null;
    },
    upsert: async (input: unknown) => {
      const typed = input as { payload: Record<string, unknown> };
      return { payload: typed.payload };
    },
  };
  const service = createService(repositoryStub);
  const read = await service.getApiKeys('tenant-a');
  assert.equal(read?.openai_api_key, 'legacy-key');
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

test('SettingsService schedule generation is deterministic for same seed and params', () => {
  const repositoryStub: RepositoryStub = {
    findByPath: async () => null,
    upsert: async () => ({ payload: {} }),
  };
  const service = createService(repositoryStub);
  const request = {
    seed: 1337,
    params: {
      startTime: '07:00',
      endTime: '23:30',
      useSecondWindow: false,
      targetActiveMinutes: 600,
      minSessionMinutes: 60,
      minBreakMinutes: 30,
      randomOffsetMinutes: 15,
      profile: 'farming',
    },
  };

  const first = service.generateScheduleFromRequest(request, 'tenant-a');
  const second = service.generateScheduleFromRequest(request, 'tenant-a');

  assert.deepEqual(first, second);
  assert.equal(first.mode, 'seeded');
  assert.equal(first.meta.deterministic, true);
  assert.equal(first.meta.validation.valid, true);
  assert.equal(Array.isArray(first.items), true);
});

test('SettingsService schedule generation rejects overlapping windows with validation errors', () => {
  const repositoryStub: RepositoryStub = {
    findByPath: async () => null,
    upsert: async () => ({ payload: {} }),
  };
  const service = createService(repositoryStub);
  const request = {
    seed: 1337,
    params: {
      startTime: '10:00',
      endTime: '14:00',
      useSecondWindow: true,
      startTime2: '13:00',
      endTime2: '15:00',
      targetActiveMinutes: 240,
      minSessionMinutes: 60,
      minBreakMinutes: 30,
      randomOffsetMinutes: 15,
      profile: 'farming',
    },
  };

  assert.throws(
    () => service.generateScheduleFromRequest(request, 'tenant-a'),
    (error: unknown) => {
      assert.ok(error instanceof ScheduleValidationError);
      assert.deepEqual((error as { errors: string[] }).errors, ['Windows must not overlap']);
      return true;
    },
  );
});
