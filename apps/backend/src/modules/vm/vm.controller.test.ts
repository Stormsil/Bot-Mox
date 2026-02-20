export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { NotFoundException, UnauthorizedException } = require('@nestjs/common');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');
const { VmController } = require('./vm.controller.ts');
const { VmService } = require('./vm.service.ts');

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

function createController() {
  const records = new Map<string, Record<string, unknown>>();
  const repositoryStub = {
    upsert: async (input: unknown) => {
      const typed = input as {
        tenantId: string;
        vmUuid: string;
        userId: string;
        vmName: string;
        projectId: string;
        status: string;
        metadata: Record<string, unknown>;
        createdAtMs: number;
        updatedAtMs: number;
      };
      const key = `${typed.tenantId}:${typed.vmUuid}`;
      const next = {
        tenant_id: typed.tenantId,
        vm_uuid: typed.vmUuid,
        user_id: typed.userId,
        vm_name: typed.vmName,
        project_id: typed.projectId,
        status: typed.status,
        metadata: typed.metadata,
        created_at_ms: typed.createdAtMs,
        updated_at_ms: typed.updatedAtMs,
      };
      records.set(key, next);
      return next;
    },
    findById: async (tenantId: unknown, vmUuid: unknown) =>
      records.get(`${String(tenantId)}:${String(vmUuid)}`) ?? null,
  };
  const controller = new VmController(new VmService(repositoryStub));
  return {
    controller,
    restore: () => {},
  };
}

test('VmController resolves VM records only inside the requesting tenant', async () => {
  const { controller, restore } = createController();
  const auth = 'Bearer test-token';

  try {
    await controller.register(
      auth,
      {
        vm_uuid: 'VM-UUID-001',
        user_id: 'user-a',
        vm_name: 'tenant-a-vm',
      },
      buildRequest('tenant-a'),
    );

    await controller.register(
      auth,
      {
        vm_uuid: 'VM-UUID-001',
        user_id: 'user-b',
        vm_name: 'tenant-b-vm',
      },
      buildRequest('tenant-b'),
    );

    const tenantARecord = await controller.resolve(auth, 'VM-UUID-001', buildRequest('tenant-a'));
    const tenantBRecord = await controller.resolve(auth, 'VM-UUID-001', buildRequest('tenant-b'));

    assert.equal(
      (tenantARecord.data as { tenant_id: string; vm_name: string }).tenant_id,
      'tenant-a',
    );
    assert.equal(
      (tenantARecord.data as { tenant_id: string; vm_name: string }).vm_name,
      'tenant-a-vm',
    );
    assert.equal(
      (tenantBRecord.data as { tenant_id: string; vm_name: string }).tenant_id,
      'tenant-b',
    );
    assert.equal(
      (tenantBRecord.data as { tenant_id: string; vm_name: string }).vm_name,
      'tenant-b-vm',
    );

    await assert.rejects(
      () => controller.resolve(auth, 'VM-UUID-001', buildRequest('tenant-c')),
      (error: unknown) => {
        assert.ok(error instanceof NotFoundException);
        assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
          code: 'VM_UUID_NOT_FOUND',
          message: 'VM UUID not found',
        });
        return true;
      },
    );
  } finally {
    restore();
  }
});

test('VmController returns deterministic code for missing bearer token', async () => {
  const { controller, restore } = createController();
  try {
    await assert.rejects(
      () => controller.resolve(undefined, 'VM-UUID-001', buildRequest('tenant-a')),
      (error: unknown) => {
        assert.ok(error instanceof UnauthorizedException);
        assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
          code: 'MISSING_BEARER_TOKEN',
          message: 'Missing bearer token',
        });
        return true;
      },
    );
  } finally {
    restore();
  }
});
