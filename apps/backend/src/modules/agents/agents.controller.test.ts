export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { AgentsController } = require('./agents.controller.ts');

function buildRequest(tenantId: string) {
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

function buildAgentRequest(tenantId: string, agentId: string) {
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

test('AgentsController returns deterministic code for missing bearer token', async () => {
  const controller = new AgentsController(
    {
      list: async () => [],
      createPairing: async () => ({}),
      heartbeat: async () => ({}),
    },
    {
      signInWithPassword: async () => ({
        accessToken: 'token',
        identity: { tenantId: 'tenant-a', uid: 'user-1', raw: {} },
      }),
    },
  );

  await assert.rejects(
    () => controller.list(undefined, {}, buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
      return true;
    },
  );
});

test('AgentsController returns deterministic code for invalid heartbeat payload', async () => {
  const controller = new AgentsController(
    {
      list: async () => [],
      createPairing: async () => ({}),
      heartbeat: async () => ({}),
    },
    {
      signInWithPassword: async () => ({
        accessToken: 'token',
        identity: { tenantId: 'tenant-a', uid: 'user-1', raw: {} },
      }),
    },
  );

  await assert.rejects(
    () => controller.heartbeat('Bearer test-token', { agent_id: '' }, buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => unknown }).getResponse() as {
        code?: string;
        message?: string;
      };
      assert.equal(response.code, 'AGENTS_HEARTBEAT_INVALID_BODY');
      assert.equal(response.message, 'Invalid agents heartbeat payload');
      return true;
    },
  );
});

test('AgentsController enforces heartbeat agent_id match for agent token identity', async () => {
  const controller = new AgentsController(
    {
      list: async () => [],
      createPairing: async () => ({}),
      heartbeat: async () => ({}),
    },
    {
      signInWithPassword: async () => ({
        accessToken: 'token',
        identity: { tenantId: 'tenant-a', uid: 'user-1', raw: {} },
      }),
    },
  );

  await assert.rejects(
    () =>
      controller.heartbeat(
        'Bearer test-token',
        { agent_id: 'agent-2', status: 'active', metadata: {} },
        buildAgentRequest('tenant-a', 'agent-1'),
      ),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'AGENT_ID_MISMATCH',
        message: 'agent_id does not match authenticated agent token',
      });
      return true;
    },
  );
});

test('AgentsController requires dedicated agent token for heartbeat endpoint', async () => {
  const controller = new AgentsController(
    {
      list: async () => [],
      createPairing: async () => ({}),
      heartbeat: async () => ({}),
    },
    {
      signInWithPassword: async () => ({
        accessToken: 'token',
        identity: { tenantId: 'tenant-a', uid: 'user-1', raw: {} },
      }),
    },
  );

  await assert.rejects(
    () =>
      controller.heartbeat(
        'Bearer test-token',
        { agent_id: 'agent-1', status: 'active', metadata: {} },
        buildRequest('tenant-a'),
      ),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'AGENT_TOKEN_REQUIRED',
        message: 'Agent token is required for heartbeat endpoint',
      });
      return true;
    },
  );
});

test('AgentsController quickPair issues dedicated tenant-bound agent token', async () => {
  const calls: Array<Record<string, unknown>> = [];
  const auditCalls: Array<Record<string, unknown>> = [];
  const controller = new AgentsController(
    {
      list: async () => [],
      createPairing: async () => ({}),
      heartbeat: async () => ({}),
      createQuickPairAgent: async () => ({
        id: 'agent-42',
        name: 'agent-42',
        status: 'active',
        paired_at: '2026-01-01T00:00:00.000Z',
      }),
    },
    {
      signInWithPassword: async () => ({
        accessToken: 'user-token-should-not-leak',
        identity: { tenantId: 'tenant-a', uid: 'user-1', raw: {} },
      }),
      issueAgentToken: async (input: Record<string, unknown>) => {
        calls.push(input);
        return {
          token: 'agent-token-1',
          expiresAt: '2026-01-01T01:00:00.000Z',
        };
      },
    },
    {
      log: async (input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
    },
  );

  const response = await controller.quickPair({
    login: 'admin@localhost',
    password: 'secret',
    machine_name: 'host-1',
    version: '1.0.0',
    platform: 'win32',
    capabilities: ['proxmox'],
  });

  assert.equal(response.success, true);
  assert.equal(response.data.agent_token, 'agent-token-1');
  assert.equal(response.data.agent_token_expires_at, '2026-01-01T01:00:00.000Z');
  assert.equal(calls.length, 1);
  assert.deepEqual(calls[0], {
    tenantId: 'tenant-a',
    agentId: 'agent-42',
    pairedByUserId: 'user-1',
  });
  assert.equal(auditCalls.length, 1);
  const quickPairAudit = auditCalls[0];
  if (!quickPairAudit) {
    throw new Error('Expected quick-pair audit record');
  }
  assert.equal(quickPairAudit.action, 'agents.quick_pair');
});

test('AgentsController repair logs audit event', async () => {
  const auditCalls: Array<Record<string, unknown>> = [];
  const controller = new AgentsController(
    {
      list: async () => [],
      createPairing: async () => ({}),
      heartbeat: async () => ({}),
      repair: async () => ({
        id: 'agent-1',
        tenant_id: 'tenant-a',
        status: 'pending',
      }),
    },
    {
      signInWithPassword: async () => ({
        accessToken: 'token',
        identity: { tenantId: 'tenant-a', uid: 'user-1', raw: {} },
      }),
    },
    {
      log: async (input: Record<string, unknown>) => {
        auditCalls.push(input);
      },
    },
  );

  const response = await controller.repair(
    'Bearer test-token',
    { agent_id: 'agent-1', reason: 'manual-repair' },
    buildRequest('tenant-a'),
  );

  assert.equal(response.success, true);
  assert.equal(auditCalls.length, 1);
  const repairAudit = auditCalls[0];
  if (!repairAudit) {
    throw new Error('Expected repair audit record');
  }
  assert.equal(repairAudit.action, 'agents.repair');
  assert.equal(repairAudit.targetTenantId, 'tenant-a');
});

test('AgentsController repair rejects cross-tenant agent id with AGENT_NOT_FOUND', async () => {
  const controller = new AgentsController(
    {
      list: async () => [],
      createPairing: async () => ({}),
      heartbeat: async () => ({}),
      repair: async () => {
        throw new NotFoundException({
          code: 'AGENT_NOT_FOUND',
          message: 'Agent not found for this tenant',
        });
      },
    },
    {
      signInWithPassword: async () => ({
        accessToken: 'token',
        identity: { tenantId: 'tenant-b', uid: 'user-2', raw: {} },
      }),
    },
  );

  await assert.rejects(
    () =>
      controller.repair(
        'Bearer test-token',
        { agent_id: 'agent-owned-by-tenant-a', reason: 'cross-tenant-attempt' },
        buildRequest('tenant-b'),
      ),
    (error: unknown) => {
      assert.ok(error instanceof NotFoundException);
      assert.deepEqual((error as { getResponse?: () => unknown }).getResponse?.(), {
        code: 'AGENT_NOT_FOUND',
        message: 'Agent not found for this tenant',
      });
      return true;
    },
  );
});
