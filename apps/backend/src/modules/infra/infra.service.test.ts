export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { InfraService } = require('./infra.service.ts');

function createRepositoryStub(overrides = {}) {
  const configs = new Map();
  return {
    listVmsByNode: async () => [],
    findVm: async () => null,
    upsertVm: async (input: { payload: unknown }) => input.payload,
    deleteVm: async () => undefined,
    findVmConfig: async (tenantId: string, vmid: string) =>
      configs.get(`${tenantId}:${vmid}`) ?? null,
    upsertVmConfig: async (tenantId: string, vmid: string, content: string) => {
      configs.set(`${tenantId}:${vmid}`, content);
    },
    ...overrides,
  };
}

function createService(repositoryOverrides = {}) {
  const repository = createRepositoryStub(repositoryOverrides);
  return new InfraService(repository);
}

test('InfraService requires tenantId on tenant-scoped methods', async () => {
  const service = createService();
  await assert.rejects(() => service.login(''), /tenantId is required/);
  await assert.rejects(() => service.listNodeVms('', 'pve'), /tenantId is required/);
});

test('InfraService isolates vm config state by tenant', async () => {
  const service = createService();
  await service.writeVmConfig('tenant-a', { vmid: '100', content: 'name: vm-a\nmemory: 4096\n' });
  await service.writeVmConfig('tenant-b', { vmid: '100', content: 'name: vm-b\nmemory: 8192\n' });

  const a = await service.readVmConfig('tenant-a', '100');
  const b = await service.readVmConfig('tenant-b', '100');
  assert.match(a.config, /vm-a/);
  assert.match(b.config, /vm-b/);
});

test('InfraService uses repository paths and fails hard on repository errors', async () => {
  const service = createService({
    findVmConfig: async () => 'name: vm-db\nmemory: 16384\n',
  });

  const login = await service.login('tenant-a');
  assert.equal(login.connected, true);

  const config = await service.readVmConfig('tenant-a', '100');
  assert.match(config.config, /vm-db/);

  const failing = createService({
    findVmConfig: async () => {
      throw new Error('db unavailable');
    },
  });
  await assert.rejects(() => failing.readVmConfig('tenant-a', '100'), /db unavailable/);
});
