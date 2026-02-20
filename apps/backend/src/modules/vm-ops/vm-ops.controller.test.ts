// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
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
