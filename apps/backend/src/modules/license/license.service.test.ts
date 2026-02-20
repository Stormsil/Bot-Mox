export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { LicenseService } = require('./license.service.ts');

function createRepositoryStub(overrides = {}) {
  return {
    findById: async () => null,
    upsert: async (input: unknown) => input,
    ...overrides,
  };
}

function createService(repositoryOverrides = {}) {
  const repository = createRepositoryStub(repositoryOverrides);
  const service = new LicenseService(repository);
  return { service };
}

test('LicenseService requires tenantId and userId when issuing lease', async () => {
  const { service } = createService();
  await assert.rejects(
    () =>
      service.issueLease(
        { vm_uuid: 'vm-1', module: 'bootstrap' },
        { tenantId: '', userId: 'user-1' },
      ),
    /tenantId is required/,
  );
  await assert.rejects(
    () =>
      service.issueLease(
        { vm_uuid: 'vm-1', module: 'bootstrap' },
        { tenantId: 'tenant-a', userId: '' },
      ),
    /userId is required/,
  );
});

test('LicenseService isolates lease heartbeat/revoke by tenant', async () => {
  const records = new Map<string, Record<string, unknown>>();
  const { service } = createService({
    upsert: async (input: unknown) => {
      const typed = input as { tenantId: string; id: string; payload: Record<string, unknown> };
      records.set(`${typed.tenantId}:${typed.id}`, typed.payload);
      return typed.payload;
    },
    findById: async (tenantId: unknown, id: unknown) =>
      (records.get(`${String(tenantId)}:${String(id)}`) as unknown) ?? null,
  });

  const lease = await service.issueLease(
    { vm_uuid: 'vm-1', module: 'bootstrap' },
    { tenantId: 'tenant-a', userId: 'user-a' },
  );

  const heartbeatWrongTenant = await service.heartbeatLease(lease.lease_id, 'tenant-b');
  assert.equal(heartbeatWrongTenant, null);

  const heartbeat = await service.heartbeatLease(lease.lease_id, 'tenant-a');
  assert.equal(heartbeat?.status, 'active');

  const revokedWrongTenant = await service.revokeLease(lease.lease_id, 'tenant-b');
  assert.equal(revokedWrongTenant, null);

  const revoked = await service.revokeLease(lease.lease_id, 'tenant-a');
  assert.equal(revoked?.status, 'revoked');
});

test('LicenseService uses repository path', async () => {
  const repoRecord = {
    lease: {
      lease_id: 'lease-a',
      token: 'token-lease-a',
      expires_at: Date.now() + 1000,
      tenant_id: 'tenant-a',
      user_id: 'user-a',
      vm_uuid: 'vm-a',
      module: 'bootstrap',
    },
    status: 'active',
  };

  const { service } = createService({
    upsert: async (input: { payload: unknown }) => input.payload,
    findById: async () => repoRecord,
  });
  const lease = await service.issueLease(
    { vm_uuid: 'vm-a', module: 'bootstrap' },
    { tenantId: 'tenant-a', userId: 'user-a' },
  );
  assert.equal(lease.tenant_id, 'tenant-a');
  const heartbeat = await service.heartbeatLease('lease-a', 'tenant-a');
  assert.equal(heartbeat?.status, 'active');
  const revoked = await service.revokeLease('lease-a', 'tenant-a');
  assert.equal(revoked?.status, 'revoked');
});

test('LicenseService fails hard on repository errors', async () => {
  const { service } = createService({
    upsert: async () => {
      throw new Error('repo unavailable');
    },
  });
  await assert.rejects(
    () =>
      service.issueLease(
        { vm_uuid: 'vm-1', module: 'bootstrap' },
        { tenantId: 'tenant-a', userId: 'user-a' },
      ),
    /repo unavailable/,
  );
});
