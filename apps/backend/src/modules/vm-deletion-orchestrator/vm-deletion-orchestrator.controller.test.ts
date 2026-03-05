export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { VmDeletionOrchestratorController } = require('./vm-deletion-orchestrator.controller.ts');

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

function createServiceStub() {
  return {
    async evaluateVmDeletion(_tenantId: string, input: { items: unknown[]; policy?: unknown }) {
      return {
        items: input.items.map((item) => ({
          vmid: (item as { vmid: unknown }).vmid,
          can_delete: true,
          reason: 'ORPHAN_ALLOWED',
          reasons: ['ORPHAN_ALLOWED'],
          reason_code: 'ORPHAN_ALLOWED',
          linked_bot_ids: [],
          linked_bots: 0,
        })),
      };
    },
  };
}

test('VmDeletionOrchestratorController returns deterministic code for missing bearer token', async () => {
  const controller = new VmDeletionOrchestratorController(createServiceStub());

  await assert.rejects(
    () =>
      controller.evaluateDeletion(undefined, { items: [{ vmid: 101 }] }, buildRequest('tenant-a')),
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

test('VmDeletionOrchestratorController validates body with deterministic invalid-body envelope', async () => {
  const controller = new VmDeletionOrchestratorController(createServiceStub());

  await assert.rejects(
    () => controller.evaluateDeletion('Bearer token', { items: [] }, buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => Record<string, unknown> }).getResponse();
      assert.equal(response.code, 'VM_DELETE_EVALUATE_INVALID_BODY');
      assert.equal(response.message, 'Invalid VM deletion evaluate payload');
      return true;
    },
  );
});

test('VmDeletionOrchestratorController evaluates mixed vm inputs through orchestrator authority', async () => {
  const controller = new VmDeletionOrchestratorController(createServiceStub());

  const result = await controller.evaluateDeletion(
    'Bearer token',
    {
      items: [{ vmid: 101 }, { vmid: 'custom-id', node: 'pve-a' }],
      policy: {
        allowOrphan: false,
      },
    },
    buildRequest('tenant-a'),
  );

  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    items: [
      {
        vmid: 101,
        can_delete: true,
        reason: 'ORPHAN_ALLOWED',
        reasons: ['ORPHAN_ALLOWED'],
        reason_code: 'ORPHAN_ALLOWED',
        linked_bot_ids: [],
        linked_bots: 0,
      },
      {
        vmid: 'custom-id',
        can_delete: true,
        reason: 'ORPHAN_ALLOWED',
        reasons: ['ORPHAN_ALLOWED'],
        reason_code: 'ORPHAN_ALLOWED',
        linked_bot_ids: [],
        linked_bots: 0,
      },
    ],
  });
});
