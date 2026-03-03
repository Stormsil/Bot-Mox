export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { InfraService } = require('./infra.service.ts');

function createRepositoryStub(overrides = {}) {
  const configs = new Map();
  return {
    listVmsByNode: async () => [],
    findVm: async () => null,
    listTenantVms: async () => [],
    listTenantBots: async () => [],
    listTenantResources: async () => [],
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

test('InfraService stores encrypted vm config content at rest', async () => {
  let storedContent: string | null = null;
  const service = createService({
    upsertVmConfig: async (_tenantId: string, _vmid: string, content: string) => {
      storedContent = content;
    },
    findVmConfig: async () => storedContent,
  });

  await service.writeVmConfig('tenant-a', {
    vmid: '101',
    content: 'name: vm-secret\nmemory: 2048\n',
  });
  assert.equal(typeof storedContent, 'string');
  assert.match(String(storedContent), /__enc_v1/);
  assert.doesNotMatch(String(storedContent), /vm-secret/);

  const loaded = await service.readVmConfig('tenant-a', '101');
  assert.match(loaded.config, /vm-secret/);
});

test('InfraService reads legacy plaintext vm config content', async () => {
  const service = createService({
    findVmConfig: async () => 'name: vm-legacy\nmemory: 1024\n',
  });

  const loaded = await service.readVmConfig('tenant-a', '102');
  assert.match(loaded.config, /vm-legacy/);
});

test('InfraService evaluates deletion eligibility with deterministic reason codes', async () => {
  const service = createService({
    listTenantVms: async () => [
      { vmid: '101', node: 'pve-a', name: 'Alpha', status: 'stopped', config: {} },
      { vmid: '102', node: 'pve-a', name: 'Beta', status: 'running', config: {} },
    ],
    listTenantBots: async () => [
      {
        id: 'bot-alpha',
        payload: {
          id: 'bot-alpha',
          status: 'prepare',
          vm: { name: 'Alpha' },
          account: { email: '', password: '' },
        },
      },
      {
        id: 'bot-beta',
        payload: {
          id: 'bot-beta',
          status: 'farming',
          vm: { name: 'Beta' },
          account: { email: 'x@x.local', password: 'secret' },
        },
      },
    ],
    listTenantResources: async (_tenantId: string, kind: string) => {
      if (kind === 'proxies') {
        return [{ id: 'proxy-1', payload: { bot_id: 'bot-beta' } }];
      }
      if (kind === 'subscriptions') {
        return [{ id: 'sub-1', payload: { bot_id: 'bot-beta' } }];
      }
      if (kind === 'licenses') {
        return [{ id: 'lic-1', payload: { bot_ids: ['bot-beta'] } }];
      }
      return [];
    },
  });

  const result = await service.evaluateVmDeletion('tenant-a', {
    items: [{ vmid: 101 }, { vmid: 102 }, { vmid: 999 }],
    policy: {
      allowOrphan: true,
      allowBanned: true,
      allowPrepareNoResources: true,
    },
  });

  assert.equal(result.items.length, 3);
  assert.deepEqual(result.items[0], {
    vmid: 101,
    can_delete: true,
    reason: 'PREPARE_SEED_NO_CREDENTIALS_RESOURCES_ALLOWED',
    reasons: ['PREPARE_SEED_NO_CREDENTIALS_RESOURCES_ALLOWED'],
    node: 'pve-a',
    reason_code: 'PREPARE_SEED_NO_CREDENTIALS_RESOURCES_ALLOWED',
    linked_bot_ids: ['bot-alpha'],
    linked_bots: 1,
  });
  assert.equal(result.items[1].can_delete, false);
  assert.equal(result.items[1].reason, 'STATUS_NOT_PREPARE');
  assert.deepEqual(result.items[1].reasons, [
    'STATUS_NOT_PREPARE',
    'CREDENTIALS_PRESENT',
    'PROXY_LINKED',
    'SUBSCRIPTION_LINKED',
    'LICENSE_LINKED',
  ]);
  assert.deepEqual(result.items[2], {
    vmid: 999,
    can_delete: false,
    reason: 'VM_NOT_FOUND',
    reasons: ['VM_NOT_FOUND'],
    reason_code: 'VM_NOT_FOUND',
    linked_bot_ids: [],
    linked_bots: 0,
  });
});

test('InfraService keeps deletion evaluation tenant-safe for foreign vm ids', async () => {
  const service = createService({
    listTenantVms: async (tenantId: string) =>
      tenantId === 'tenant-a'
        ? [{ vmid: '501', node: 'pve-a', name: 'TenantA-VM', status: 'stopped', config: {} }]
        : [],
    listTenantBots: async () => [],
    listTenantResources: async () => [],
  });

  const tenantAResult = await service.evaluateVmDeletion('tenant-a', {
    items: [{ vmid: 501 }],
  });
  const tenantBResult = await service.evaluateVmDeletion('tenant-b', {
    items: [{ vmid: 501 }],
  });

  assert.equal(tenantAResult.items[0].can_delete, true);
  assert.equal(tenantAResult.items[0].reason, 'ORPHAN_ALLOWED');
  assert.equal(tenantBResult.items[0].can_delete, false);
  assert.equal(tenantBResult.items[0].reason, 'VM_NOT_FOUND');
});

test('InfraService vm patch plan keeps frontend parity semantics for bridge/port/ip/mac/serial', async () => {
  const service = createService();
  const currentConfig = [
    'name: WoW8',
    'net0: e1000=AA:AA:AA:AA:AA:AA,bridge=vmbr1,firewall=1',
    'sata0: local-lvm:vm-100-disk-0,serial=OLD-SERIAL',
    "args: -vnc 0.0.0.0:21 -smbios 'type=11,value=192.168.110.40'",
    'balloon: 0',
  ].join('\n');

  const first = await service.planVmConfigPatch('tenant-a', {
    vmid: 108,
    seed: 1337,
    current_config: currentConfig,
    intent: {
      vm_name: 'WoW8',
      mac: '00:16:3E:8A:22:01',
      ssdSerial: 'SN-NEW-0001',
      smbiosArgs: "args: -vnc 0.0.0.0:21 -smbios 'type=11,value=192.168.110.40'",
    },
  });
  const second = await service.planVmConfigPatch('tenant-a', {
    vmid: 108,
    seed: 1337,
    current_config: currentConfig,
    intent: {
      vm_name: 'WoW8',
      mac: '00:16:3E:8A:22:01',
      ssdSerial: 'SN-NEW-0001',
      smbiosArgs: "args: -vnc 0.0.0.0:21 -smbios 'type=11,value=192.168.110.40'",
    },
  });

  assert.equal(first.patch.generatedIp, second.patch.generatedIp);
  assert.equal(first.patch.patched, second.patch.patched);
  assert.match(first.patch.generatedIp, /^192\.168\.117\.\d{2}$/);
  assert.match(first.patch.patched, /bridge=vmbr8/);
  assert.match(first.patch.patched, /serial=SN-NEW-0001/);
  assert.match(first.patch.patched, /e1000=00:16:3E:8A:22:01/);
  assert.match(first.patch.patched, /0\.0\.0\.0:18/);
  assert.equal(first.patch.generatedMac, '00:16:3E:8A:22:01');
  assert.equal(first.patch.generatedSerial, 'SN-NEW-0001');
  assert.equal(first.patch.vncPort, 18);

  const fields = first.patch.changes.map((change: { field: string }) => change.field);
  assert.deepEqual(fields, ['MAC (e1000)', 'Serial (sata0)', 'Bridge', 'VNC port', 'IP (SMBIOS)']);
});

test('InfraService vm patch apply respects dry-run and applies tenant-scoped config writes', async () => {
  const service = createService();
  const currentConfig = [
    'name: WoW8',
    'net0: e1000=AA:AA:AA:AA:AA:AA,bridge=vmbr1,firewall=1',
    'sata0: local-lvm:vm-100-disk-0,serial=OLD-SERIAL',
    "args: -vnc 0.0.0.0:21 -smbios 'type=11,value=192.168.110.40'",
    'balloon: 0',
  ].join('\n');

  const dryRun = await service.applyVmConfigPatch('tenant-a', {
    vmid: 108,
    seed: 1337,
    dry_run: true,
    current_config: currentConfig,
    intent: {
      vm_name: 'WoW8',
      mac: '00:16:3E:8A:22:01',
      ssdSerial: 'SN-NEW-0001',
      smbiosArgs: "args: -vnc 0.0.0.0:21 -smbios 'type=11,value=192.168.110.40'",
    },
  });
  assert.equal(dryRun.applied, false);
  assert.equal(
    (await service.readVmConfig('tenant-a', '108')).config.includes('SN-NEW-0001'),
    false,
  );

  const apply = await service.applyVmConfigPatch('tenant-a', {
    vmid: 108,
    seed: 1337,
    current_config: currentConfig,
    intent: {
      vm_name: 'WoW8',
      mac: '00:16:3E:8A:22:01',
      ssdSerial: 'SN-NEW-0001',
      smbiosArgs: "args: -vnc 0.0.0.0:21 -smbios 'type=11,value=192.168.110.40'",
    },
  });
  assert.equal(apply.applied, true);
  assert.ok(typeof apply.task_id === 'string' && apply.task_id.length > 0);

  const tenantAConfig = await service.readVmConfig('tenant-a', '108');
  const tenantBConfig = await service.readVmConfig('tenant-b', '108');
  assert.match(tenantAConfig.config, /SN-NEW-0001/);
  assert.doesNotMatch(tenantBConfig.config, /SN-NEW-0001/);
});
