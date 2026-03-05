export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { VmDeletionOrchestratorService } = require('./vm-deletion-orchestrator.service.ts');

function createService(
  overrides: {
    infraReadFacade?: { listTenantVms?: (tenantId: string) => Promise<unknown[]> };
    botsReadFacade?: { listTenantBots?: (tenantId: string) => Promise<unknown[]> };
    resourcesReadFacade?: {
      listTenantResources?: (tenantId: string, kind: string) => Promise<unknown[]>;
    };
  } = {},
) {
  const infraReadFacade = {
    listTenantVms: async () => [],
  };
  const botsReadFacade = {
    listTenantBots: async () => [],
  };
  const resourcesReadFacade = {
    listTenantResources: async () => [],
  };

  return new VmDeletionOrchestratorService(
    { ...infraReadFacade, ...overrides.infraReadFacade },
    { ...botsReadFacade, ...overrides.botsReadFacade },
    { ...resourcesReadFacade, ...overrides.resourcesReadFacade },
  );
}

test('VmDeletionOrchestratorService evaluates deletion eligibility with deterministic reason codes', async () => {
  const service = createService({
    infraReadFacade: {
      listTenantVms: async () => [
        { vmid: '101', node: 'pve-a', name: 'Alpha', status: 'stopped', config: {} },
        { vmid: '102', node: 'pve-a', name: 'Beta', status: 'running', config: {} },
      ],
    },
    botsReadFacade: {
      listTenantBots: async () => [
        {
          id: 'bot-alpha',
          status: 'prepare',
          vmName: 'Alpha',
          accountEmail: '',
          accountPassword: '',
        },
        {
          id: 'bot-beta',
          status: 'farming',
          vmName: 'Beta',
          accountEmail: 'x@x.local',
          accountPassword: 'secret',
        },
      ],
    },
    resourcesReadFacade: {
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

test('VmDeletionOrchestratorService keeps deletion evaluation tenant-safe for foreign vm ids', async () => {
  const service = createService({
    infraReadFacade: {
      listTenantVms: async (tenantId: string) =>
        tenantId === 'tenant-a'
          ? [{ vmid: '501', node: 'pve-a', name: 'TenantA-VM', status: 'stopped', config: {} }]
          : [],
    },
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

test('VmDeletionOrchestratorService surfaces dependency failures without partial decisions', async () => {
  const service = createService({
    infraReadFacade: {
      listTenantVms: async () => {
        throw new Error('resources unavailable');
      },
    },
  });

  await assert.rejects(
    () => service.evaluateVmDeletion('tenant-a', { items: [{ vmid: 101 }] }),
    /resources unavailable/,
  );
});
