// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ProvisioningService } = require('./provisioning.service.ts');

function createRepositoryStub(overrides = {}) {
  const profiles = new Map();
  const tokens = new Map();
  const progress = new Map();

  return {
    listProfiles: async (tenantId) =>
      Array.from(profiles.values())
        .filter((item) => item.tenant === tenantId)
        .map((item) => item.payload),
    findProfileById: async (tenantId, id) => profiles.get(`${tenantId}:${id}`)?.payload ?? null,
    upsertProfile: async (input) => {
      profiles.set(`${input.tenantId}:${input.id}`, {
        tenant: input.tenantId,
        payload: input.payload,
      });
      return input.payload;
    },
    deleteProfile: async (tenantId, id) => {
      profiles.delete(`${tenantId}:${id}`);
    },
    upsertToken: async (record) => {
      tokens.set(record.token, record);
    },
    findToken: async (token) => tokens.get(token) ?? null,
    deleteToken: async (token) => {
      tokens.delete(token);
    },
    appendProgress: async (input) => {
      const key = `${input.tenantId}:${input.vmUuid}`;
      const current = progress.get(key) ?? [];
      progress.set(key, [...current, input.payload]);
    },
    listProgressByVm: async (tenantId, vmUuid) => progress.get(`${tenantId}:${vmUuid}`) ?? [],
    ...overrides,
  };
}

function createService(repositoryOverrides = {}) {
  return new ProvisioningService(createRepositoryStub(repositoryOverrides));
}

test('ProvisioningService requires tenant/user identity on profile and token flows', async () => {
  const service = createService();
  await assert.rejects(() => service.listProfiles(''), /tenantId is required/);
  await assert.rejects(
    () => service.issueToken({ vmUuid: 'vm-1', tenantId: '', userId: 'u-1' }),
    /tenantId is required/,
  );
  await assert.rejects(
    () => service.issueToken({ vmUuid: 'vm-1', tenantId: 'tenant-a', userId: '' }),
    /userId is required/,
  );
});

test('ProvisioningService isolates profiles/progress by tenant and token context', async () => {
  const service = createService();

  const profileA = await service.createProfile(
    { name: 'A', config: { locale: 'en-US' }, is_default: true },
    'tenant-a',
  );
  await service.createProfile(
    { name: 'B', config: { locale: 'ru-RU' }, is_default: true },
    'tenant-b',
  );

  assert.equal((await service.listProfiles('tenant-a')).length, 1);
  assert.equal((await service.listProfiles('tenant-b')).length, 1);

  const payload = await service.generateIsoPayload(
    {
      vm_uuid: 'vm-a',
      vm_name: 'vm-a',
      ip: '10.0.0.2',
      profile_id: profileA.id,
      profile_config: { locale: 'en-US' },
    },
    { tenantId: 'tenant-a', userId: 'user-a' },
  );

  const tokenValidation = await service.validateToken({ token: payload.token });
  assert.equal(tokenValidation?.tenantId, 'tenant-a');
  assert.equal(tokenValidation?.userId, 'user-a');

  const wrongVmProgress = await service.reportProgress({
    token: payload.token,
    vm_uuid: 'vm-other',
    step: 'bootstrap',
    status: 'running',
    details: null,
  });
  assert.equal(wrongVmProgress, null);

  const progress = await service.reportProgress({
    token: payload.token,
    vm_uuid: 'vm-a',
    step: 'bootstrap',
    status: 'running',
    details: null,
  });
  assert.equal(progress?.vm_uuid, 'vm-a');

  const tenantAProgress = await service.getProgress('vm-a', 'tenant-a');
  const tenantBProgress = await service.getProgress('vm-a', 'tenant-b');
  assert.equal(tenantAProgress.events.length, 1);
  assert.equal(tenantBProgress.events.length, 0);
});

test('ProvisioningService uses repository and fails hard on repository errors', async () => {
  const tokenRecord = {
    token: 'token-vm-a-token-1',
    tokenId: 'token-1',
    tenantId: 'tenant-a',
    userId: 'user-a',
    vmUuid: 'vm-a',
    expiresAtMs: Date.now() + 60_000,
  };

  const service = createService({
    upsertProfile: async (input) => input.payload,
    listProfiles: async () => [
      {
        id: 'profile-db',
        name: 'db',
        is_default: true,
        config: { locale: 'en-US' },
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    ],
    upsertToken: async () => undefined,
    findToken: async () => tokenRecord,
    appendProgress: async () => undefined,
    listProgressByVm: async () => [
      {
        vm_uuid: 'vm-a',
        step: 'bootstrap',
        status: 'running',
        details: null,
        updated_at: new Date().toISOString(),
      },
    ],
  });

  const list = await service.listProfiles('tenant-a');
  assert.equal(list.length, 1);

  const iso = await service.generateIsoPayload(
    {
      vm_uuid: 'vm-a',
      vm_name: 'vm-a',
      ip: '10.0.0.2',
      profile_config: { locale: 'en-US' },
    },
    { tenantId: 'tenant-a', userId: 'user-a' },
  );
  assert.match(iso.token, /token-vm-a/);

  const tokenValidation = await service.validateToken({ token: 'token-vm-a-token-1' });
  assert.equal(tokenValidation?.tenantId, 'tenant-a');

  const progress = await service.getProgress('vm-a', 'tenant-a');
  assert.equal(progress.events.length, 1);

  const failing = createService({
    listProfiles: async () => {
      throw new Error('db unavailable');
    },
  });
  await assert.rejects(() => failing.listProfiles('tenant-a'), /db unavailable/);
});
