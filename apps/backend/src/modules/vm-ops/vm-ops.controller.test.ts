// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ConflictException, NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { VmOpsController } = require('./vm-ops.controller.ts');
const { VmOpsService } = require('./vm-ops.service.ts');

function buildRequest(tenantId) {
  return {
    [REQUEST_IDENTITY_KEY]: {
      userId: 'user-1',
      email: `${tenantId}@example.local`,
      roles: ['admin'],
      tenantId,
      raw: {},
    },
  };
}

function buildAgentRequest(tenantId, agentId) {
  return {
    [REQUEST_IDENTITY_KEY]: {
      userId: `agent:${agentId}`,
      email: `agent:${agentId}@local`,
      roles: ['agent'],
      tenantId,
      raw: { agent_id: agentId },
    },
  };
}

function createRepositoryStub() {
  const store = new Map();
  return {
    async create(input) {
      const row = {
        id: input.id,
        tenantId: input.tenantId,
        agentId: input.agentId,
        commandType: input.commandType,
        payload: input.payload,
        status: input.status,
        queuedAt: new Date(),
        expiresAt: input.expiresAt ?? null,
        startedAt: null,
        completedAt: null,
        result: null,
        errorMessage: null,
        createdBy: input.createdBy ?? null,
      };
      store.set(row.id, row);
      return { ...row };
    },
    async findById(id) {
      const row = store.get(id);
      return row ? { ...row } : null;
    },
    async list(filters) {
      return Array.from(store.values())
        .filter((row) => !filters.tenantId || row.tenantId === filters.tenantId)
        .map((row) => ({ ...row }));
    },
    async claimNextQueued(input) {
      const row = Array.from(store.values()).find(
        (item) =>
          item.tenantId === input.tenantId &&
          item.agentId === input.agentId &&
          item.status === 'queued',
      );
      if (!row) {
        return null;
      }
      row.status = 'dispatched';
      return { ...row };
    },
    async updateStatus(input) {
      const row = store.get(input.id);
      if (!row) {
        return null;
      }
      row.status = input.status;
      return { ...row };
    },
    async expireStaleRunning() {
      return 0;
    },
    async listStaleDispatched() {
      return [];
    },
    async requeueDispatched() {
      return null;
    },
    async deadLetterDispatched() {
      return null;
    },
  };
}

function createController() {
  const repositoryStub = createRepositoryStub();
  const controller = new VmOpsController(new VmOpsService(repositoryStub));
  return { controller };
}

test('VmOpsController keeps command reads isolated by tenant identity', async () => {
  const { controller } = createController();
  const auth = 'Bearer test-token';

  const created = await controller.createCommand(
    auth,
    {
      agent_id: 'agent-1',
      command_type: 'proxmox.start',
      payload: { vm: 'vm-a' },
    },
    buildRequest('tenant-a'),
  );

  const commandId = String(created.data.id);

  const tenantAList = await controller.listCommands(auth, {}, buildRequest('tenant-a'));
  const tenantBList = await controller.listCommands(auth, {}, buildRequest('tenant-b'));

  assert.equal(tenantAList.data.length, 1);
  assert.equal(tenantAList.data[0].tenant_id, 'tenant-a');
  assert.equal(tenantBList.data.length, 0);

  await assert.rejects(
    () => controller.getById(auth, commandId, buildRequest('tenant-b')),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual(error.getResponse(), {
        code: 'VM_OPS_COMMAND_NOT_FOUND',
        message: 'Command not found',
      });
      return true;
    },
  );
});

test('VmOpsController returns deterministic code for missing bearer token', async () => {
  const { controller } = createController();

  await assert.rejects(
    () => controller.listCommands(undefined, { agent_id: 'agent-1' }, buildRequest('tenant-a')),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual(error.getResponse(), {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
      return true;
    },
  );
});

test('VmOpsController enforces agent_id match for next command when using agent token', async () => {
  const { controller } = createController();
  const auth = 'Bearer agent-token';

  await assert.rejects(
    () =>
      controller.getNextCommand(
        auth,
        { agent_id: 'agent-other', timeout_ms: 1000 },
        buildAgentRequest('tenant-a', 'agent-1'),
      ),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual(error.getResponse(), {
        code: 'AGENT_ID_MISMATCH',
        message: 'agent_id does not match authenticated agent token',
      });
      return true;
    },
  );
});

test('VmOpsController blocks agent token from patching another agent command', async () => {
  const { controller } = createController();
  const auth = 'Bearer test-token';

  const created = await controller.createCommand(
    auth,
    {
      agent_id: 'agent-1',
      command_type: 'proxmox.start',
      payload: { vm: 'vm-1' },
    },
    buildRequest('tenant-a'),
  );

  const commandId = String(created.data.id);

  await assert.rejects(
    () =>
      controller.patchCommand(
        auth,
        commandId,
        { status: 'running' },
        buildAgentRequest('tenant-a', 'agent-2'),
      ),
    (error) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual(error.getResponse(), {
        code: 'VM_OPS_COMMAND_NOT_FOUND',
        message: 'Command not found',
      });
      return true;
    },
  );
});

test('VmOpsController legacy proxmox GET returns AGENT_OFFLINE when no active agent can be resolved', async () => {
  const { controller } = createController();
  const auth = 'Bearer test-token';

  await assert.rejects(
    () =>
      controller.dispatchProxmoxLegacyGet(
        auth,
        'list-vms',
        { node: 'h1' },
        buildRequest('tenant-a'),
      ),
    (error) => {
      assert.ok(error instanceof ConflictException);
      assert.deepEqual(error.getResponse(), {
        code: 'AGENT_OFFLINE',
        message: 'No active agent available for this tenant',
      });
      return true;
    },
  );
});

test('VmOpsController legacy proxmox GET ignores stale active agents and returns AGENT_OFFLINE', async () => {
  const repositoryStub = createRepositoryStub();
  const staleDate = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const agentsService = {
    async list() {
      return [
        {
          id: 'agent-stale',
          tenant_id: 'tenant-a',
          name: 'stale-agent',
          status: 'active',
          last_seen_at: staleDate,
          metadata: {},
          updated_at: staleDate,
        },
      ];
    },
  };
  const controller = new VmOpsController(new VmOpsService(repositoryStub), agentsService);
  const auth = 'Bearer test-token';

  await assert.rejects(
    () => controller.dispatchProxmoxLegacyGet(auth, 'status', {}, buildRequest('tenant-a')),
    (error) => {
      assert.ok(error instanceof ConflictException);
      assert.deepEqual(error.getResponse(), {
        code: 'AGENT_OFFLINE',
        message: 'No active agent available for this tenant',
      });
      return true;
    },
  );
});
