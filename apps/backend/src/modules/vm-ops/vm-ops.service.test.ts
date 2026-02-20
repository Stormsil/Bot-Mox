// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { VmOpsService } = require('./vm-ops.service.ts');

function makeDbCommand(overrides = {}) {
  const now = new Date();
  return {
    id: 'db-command-id',
    tenantId: 'tenant-db',
    agentId: 'agent-db',
    commandType: 'proxmox.start',
    payload: { vm: 'vm-db' },
    status: 'queued',
    queuedAt: now,
    expiresAt: null,
    startedAt: null,
    completedAt: null,
    result: null,
    errorMessage: null,
    createdBy: null,
    ...overrides,
  };
}

function createRepositoryStub() {
  const store = new Map();

  const clone = (row) => ({
    ...row,
    payload: row.payload && typeof row.payload === 'object' ? { ...row.payload } : row.payload,
  });

  return {
    async create(input) {
      const row = makeDbCommand({
        id: input.id,
        tenantId: input.tenantId,
        agentId: input.agentId,
        commandType: input.commandType,
        payload: input.payload,
        status: input.status,
        expiresAt: input.expiresAt ?? null,
        createdBy: input.createdBy ?? null,
        queuedAt: new Date(),
      });
      store.set(row.id, row);
      return clone(row);
    },
    async findById(id) {
      const row = store.get(id);
      return row ? clone(row) : null;
    },
    async list(filters) {
      return Array.from(store.values())
        .filter((row) => !filters.tenantId || row.tenantId === filters.tenantId)
        .filter((row) => !filters.agentId || row.agentId === filters.agentId)
        .filter((row) => !filters.status || row.status === filters.status)
        .sort((a, b) => b.queuedAt.getTime() - a.queuedAt.getTime())
        .map(clone);
    },
    async claimNextQueued(input) {
      const next = Array.from(store.values())
        .filter(
          (row) =>
            row.tenantId === input.tenantId &&
            row.agentId === input.agentId &&
            row.status === 'queued',
        )
        .sort((a, b) => a.queuedAt.getTime() - b.queuedAt.getTime())[0];
      if (!next) {
        return null;
      }
      next.status = 'dispatched';
      return clone(next);
    },
    async updateStatus(input) {
      const row = store.get(input.id);
      if (!row) {
        return null;
      }
      row.status = input.status;
      if (Object.hasOwn(input, 'result')) {
        row.result = input.result ?? null;
      }
      if (Object.hasOwn(input, 'errorMessage')) {
        row.errorMessage = input.errorMessage ?? null;
      }
      if (Object.hasOwn(input, 'startedAt')) {
        row.startedAt = input.startedAt ?? null;
      }
      if (Object.hasOwn(input, 'completedAt')) {
        row.completedAt = input.completedAt ?? null;
      }
      return clone(row);
    },
    async expireStaleRunning() {
      return 0;
    },
    async listStaleDispatched() {
      return [];
    },
    async requeueDispatched(input) {
      const row = store.get(input.id);
      if (!row) {
        return null;
      }
      row.status = 'queued';
      row.queuedAt = new Date();
      row.startedAt = null;
      row.completedAt = null;
      row.errorMessage = input.errorMessage;
      return clone(row);
    },
    async deadLetterDispatched(input) {
      const row = store.get(input.id);
      if (!row) {
        return null;
      }
      row.status = 'failed';
      row.completedAt = new Date();
      row.errorMessage = input.errorMessage;
      return clone(row);
    },
    _store: store,
  };
}

test('VmOpsService keeps tenant boundaries across list/get', async () => {
  const repository = createRepositoryStub();
  const service = new VmOpsService(repository);

  await service.dispatch({
    tenantId: 'tenant-a',
    agentId: 'agent-1',
    commandType: 'proxmox.start',
    payload: { vm: 'vm-a' },
  });
  await service.dispatch({
    tenantId: 'tenant-b',
    agentId: 'agent-1',
    commandType: 'proxmox.stop',
    payload: { vm: 'vm-b' },
  });

  const tenantACommands = await service.listCommands({ tenantId: 'tenant-a' });
  const tenantBCommands = await service.listCommands({ tenantId: 'tenant-b' });

  assert.equal(tenantACommands.length, 1);
  assert.equal(tenantACommands[0].tenant_id, 'tenant-a');
  assert.equal(tenantBCommands.length, 1);
  assert.equal(tenantBCommands[0].tenant_id, 'tenant-b');

  const hidden = await service.getById(tenantACommands[0].id, 'tenant-b');
  assert.equal(hidden, null);
});

test('VmOpsService dispatch + next command updates status to dispatched', async () => {
  const repository = createRepositoryStub();
  const service = new VmOpsService(repository);

  const created = await service.dispatch({
    tenantId: 'tenant-a',
    agentId: 'agent-queue',
    commandType: 'proxmox.start',
    payload: { vm: 'vm-a' },
  });
  assert.equal(created.status, 'queued');

  const next = await service.waitForNextAgentCommand({
    tenantId: 'tenant-a',
    agentId: 'agent-queue',
    timeoutMs: 30,
  });
  assert.ok(next);
  assert.equal(next?.id, created.id);
  assert.equal(next?.status, 'dispatched');
});

test('VmOpsService resolves waiter when command arrives', async () => {
  const repository = createRepositoryStub();
  const service = new VmOpsService(repository);

  const waiting = service.waitForNextAgentCommand({
    tenantId: 'tenant-w',
    agentId: 'agent-w',
    timeoutMs: 300,
  });

  await new Promise((resolve) => setTimeout(resolve, 20));

  const created = await service.dispatch({
    tenantId: 'tenant-w',
    agentId: 'agent-w',
    commandType: 'proxmox.start',
    payload: { vm: 'vm-w' },
  });

  const next = await waiting;
  assert.ok(next);
  assert.equal(next?.id, created.id);
  assert.equal(next?.status, 'dispatched');
});

test('VmOpsService updates command status and emits events', async () => {
  const repository = createRepositoryStub();
  const service = new VmOpsService(repository);

  const created = await service.dispatch({
    tenantId: 'tenant-a',
    agentId: 'agent-status',
    commandType: 'proxmox.start',
    payload: {},
  });

  const updated = await service.updateCommandStatus({
    id: created.id,
    status: 'running',
    tenantId: 'tenant-a',
  });
  assert.equal(updated?.status, 'running');

  const events = service.listEventsSince(0);
  assert.ok(events.length >= 2);
});

test('VmOpsService does not update command status across tenant boundary', async () => {
  const repository = createRepositoryStub();
  const service = new VmOpsService(repository);

  const created = await service.dispatch({
    tenantId: 'tenant-a',
    agentId: 'agent-status',
    commandType: 'proxmox.start',
    payload: {},
  });

  const blocked = await service.updateCommandStatus({
    id: created.id,
    status: 'running',
    tenantId: 'tenant-b',
  });
  assert.equal(blocked, null);

  const command = await service.getById(created.id, 'tenant-a');
  assert.equal(command?.status, 'queued');
});

test('VmOpsService reliability sweep requeues stale dispatched', async () => {
  const repository = createRepositoryStub();
  const service = new VmOpsService(repository);

  const created = await service.dispatch({
    tenantId: 'tenant-a',
    agentId: 'agent-sweep',
    commandType: 'proxmox.start',
    payload: {},
  });

  const row = repository._store.get(created.id);
  row.status = 'dispatched';
  row.errorMessage = null;

  repository.listStaleDispatched = async () => [
    makeDbCommand({
      ...row,
      errorMessage: row.errorMessage,
    }),
  ];

  const internals = service as unknown as { sweepStaleRunningCommands: () => Promise<void> };
  await internals.sweepStaleRunningCommands();

  const updated = await service.getById(created.id, 'tenant-a');
  assert.equal(updated?.status, 'queued');
  assert.match(String(updated?.error_message || ''), /REQUEUE_COUNT:1/);
});

test('VmOpsService reliability sweep dead-letters stale dispatched after max requeues', async () => {
  const repository = createRepositoryStub();
  const service = new VmOpsService(repository);

  const created = await service.dispatch({
    tenantId: 'tenant-a',
    agentId: 'agent-dead-letter',
    commandType: 'proxmox.start',
    payload: {},
  });

  const row = repository._store.get(created.id);
  row.status = 'dispatched';
  row.errorMessage = 'REQUEUE_COUNT:999';

  repository.listStaleDispatched = async () => [
    makeDbCommand({
      ...row,
      errorMessage: row.errorMessage,
    }),
  ];

  const internals = service as unknown as { sweepStaleRunningCommands: () => Promise<void> };
  await internals.sweepStaleRunningCommands();

  const updated = await service.getById(created.id, 'tenant-a');
  assert.equal(updated?.status, 'failed');
  assert.match(String(updated?.error_message || ''), /DEAD_LETTERED/);
});
