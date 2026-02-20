export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { VmService } = require('./vm.service.ts');

function createRepositoryStub() {
  const records = new Map<string, Record<string, unknown>>();
  return {
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
    findById: async (tenantId: unknown, vmUuid: unknown) => {
      const key = `${String(tenantId)}:${String(vmUuid)}`;
      return records.get(key) ?? null;
    },
  };
}

test('VmService isolates VM registry records by tenant', async () => {
  const service = new VmService(createRepositoryStub());
  await service.registerVm({
    tenantId: 'tenant-a',
    userId: 'user-a',
    vmUuid: 'VM-001',
    vmName: 'tenant-a-vm',
  });
  await service.registerVm({
    tenantId: 'tenant-b',
    userId: 'user-b',
    vmUuid: 'VM-001',
    vmName: 'tenant-b-vm',
  });

  const tenantARecord = await service.resolveVm('vm-001', 'tenant-a');
  const tenantBRecord = await service.resolveVm('vm-001', 'tenant-b');
  const wrongTenantRecord = await service.resolveVm('vm-001', 'tenant-c');

  assert.equal(tenantARecord?.tenant_id, 'tenant-a');
  assert.equal(tenantARecord?.vm_name, 'tenant-a-vm');
  assert.equal(tenantBRecord?.tenant_id, 'tenant-b');
  assert.equal(tenantBRecord?.vm_name, 'tenant-b-vm');
  assert.equal(wrongTenantRecord, null);
});

test('VmService fails hard when repository upsert fails', async () => {
  const service = new VmService({
    upsert: async () => {
      throw new Error('repo upsert failed');
    },
    findById: async () => null,
  });

  await assert.rejects(
    () =>
      service.registerVm({
        tenantId: 'tenant-a',
        userId: 'user-a',
        vmUuid: 'VM-001',
        vmName: 'tenant-a-vm',
      }),
    /repo upsert failed/,
  );
});

test('VmService requires tenantId', async () => {
  const service = new VmService(createRepositoryStub());

  await assert.rejects(
    () =>
      service.registerVm({
        tenantId: '',
        userId: 'user-a',
        vmUuid: 'VM-001',
        vmName: 'tenant-a-vm',
      }),
    /tenantId is required/,
  );

  await service.registerVm({
    tenantId: 'tenant-a',
    userId: 'user-a',
    vmUuid: 'VM-001',
    vmName: 'tenant-a-vm',
  });
  await assert.rejects(() => service.resolveVm('VM-001', ''), /tenantId is required/);
});
