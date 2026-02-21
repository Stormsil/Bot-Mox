export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { AgentsService } = require('./agents.service.ts');

type RepositoryStub = {
  list: (...args: unknown[]) => Promise<unknown[]>;
  createPairing: (...args: unknown[]) => Promise<unknown>;
  heartbeat: (...args: unknown[]) => Promise<unknown>;
};

function createService(repositoryStub: RepositoryStub) {
  return new AgentsService(repositoryStub);
}

test('AgentsService requires tenantId for service calls', async () => {
  const repositoryStub = {
    list: async () => [],
    createPairing: async () => {
      throw new Error('createPairing should not be called');
    },
    heartbeat: async () => {
      throw new Error('heartbeat should not be called');
    },
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list(undefined, ''), /tenantId is required/);
  await assert.rejects(
    () => service.createPairing({ tenantId: '', name: 'a' }),
    /tenantId is required/,
  );
  await assert.rejects(
    () => service.heartbeat({ tenantId: '', agentId: 'a-1', status: 'online', metadata: {} }),
    /tenantId is required/,
  );
});

test('AgentsService fails fast on repository list error', async () => {
  const repositoryStub = {
    list: async () => {
      throw new Error('db list failed');
    },
    createPairing: async () => {
      throw new Error('unexpected');
    },
    heartbeat: async () => {
      throw new Error('unexpected');
    },
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list(undefined, 'tenant-a'), /db list failed/);
});

test('AgentsService fails fast on repository list error (no fallback path)', async () => {
  const repositoryStub = {
    list: async () => {
      throw new Error('db list failed dual');
    },
    createPairing: async () => {
      throw new Error('unexpected');
    },
    heartbeat: async () => {
      throw new Error('unexpected');
    },
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list(undefined, 'tenant-a'), /db list failed dual/);
});
