export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { InfraVmsController } = require('./infra-vms.controller.ts');

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
    async planVmConfigPatch(_tenantId: string, input: Record<string, unknown>) {
      return {
        vmid: input.vmid,
        patch: {
          patched: String(input.current_config || ''),
          changes: [],
          generatedIp: '192.168.110.10',
          generatedMac: '00:16:3E:00:00:10',
          generatedSerial: 'SERIAL-10',
          vncPort: 10,
          argsBlock: "args: -vnc 0.0.0.0:10 -smbios 'type=11,value=192.168.110.10'",
        },
      };
    },
    async applyVmConfigPatch(_tenantId: string, input: Record<string, unknown>) {
      return {
        vmid: input.vmid,
        applied: input.dry_run === true || input.apply === false ? false : true,
        patch: {
          patched: String(input.current_config || ''),
          changes: [],
          generatedIp: '192.168.110.10',
          generatedMac: '00:16:3E:00:00:10',
          generatedSerial: 'SERIAL-10',
          vncPort: 10,
          argsBlock: "args: -vnc 0.0.0.0:10 -smbios 'type=11,value=192.168.110.10'",
        },
      };
    },
  };
}

test('InfraVmsController returns deterministic code for missing bearer token', async () => {
  const controller = new InfraVmsController(createServiceStub());

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

test('InfraVmsController validates body and returns deterministic invalid-body envelope', async () => {
  const controller = new InfraVmsController(createServiceStub());

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

test('InfraVmsController evaluates mixed vm inputs through backend authority', async () => {
  const controller = new InfraVmsController(createServiceStub());

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

test('InfraVmsController validates patch-plan body with deterministic envelope', async () => {
  const controller = new InfraVmsController(createServiceStub());

  await assert.rejects(
    () => controller.patchPlan('Bearer token', {}, buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => Record<string, unknown> }).getResponse();
      assert.equal(response.code, 'VM_PATCH_PLAN_INVALID_BODY');
      assert.equal(response.message, 'Invalid VM patch plan payload');
      return true;
    },
  );
});

test('InfraVmsController validates patch-apply body with deterministic envelope', async () => {
  const controller = new InfraVmsController(createServiceStub());

  await assert.rejects(
    () => controller.patchApply('Bearer token', { vmid: '' }, buildRequest('tenant-a')),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => Record<string, unknown> }).getResponse();
      assert.equal(response.code, 'VM_PATCH_APPLY_INVALID_BODY');
      assert.equal(response.message, 'Invalid VM patch apply payload');
      return true;
    },
  );
});

test('InfraVmsController returns patch plan/apply payloads for tenant request', async () => {
  const controller = new InfraVmsController(createServiceStub());

  const plan = await controller.patchPlan(
    'Bearer token',
    {
      vmid: 108,
      current_config: 'name: WoW8\nballoon: 0',
    },
    buildRequest('tenant-a'),
  );
  assert.equal(plan.success, true);
  assert.equal((plan.data as { vmid: number }).vmid, 108);

  const apply = await controller.patchApply(
    'Bearer token',
    {
      vmid: 108,
      current_config: 'name: WoW8\nballoon: 0',
      dry_run: true,
    },
    buildRequest('tenant-a'),
  );
  assert.equal(apply.success, true);
  assert.equal((apply.data as { applied: boolean }).applied, false);
});
