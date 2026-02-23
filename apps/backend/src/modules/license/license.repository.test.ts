export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { LicenseRepository } = require('./license.repository.ts');
const { DataAtRestCrypto } = require('../common/data-at-rest-crypto.ts');

function createRepositoryWithInMemoryStore() {
  const store = new Map<string, Record<string, unknown>>();
  const prisma = {
    licenseLeaseItem: {
      findFirst: async ({ where }: { where: { tenantId: string; id: string } }) => {
        const tenantId = String(where.tenantId);
        const id = String(where.id);
        return store.get(`${tenantId}:${id}`) ?? null;
      },
      findMany: async ({ where }: { where: { tenantId: string } }) => {
        const prefix = `${String(where.tenantId)}:`;
        return [...store.entries()]
          .filter(([key]) => key.startsWith(prefix))
          .map(([, value]) => value);
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { tenantId_id: { tenantId: string; id: string } };
        create: { payload: unknown };
        update: { payload: unknown };
      }) => {
        const tenantId = String(where.tenantId_id.tenantId);
        const id = String(where.tenantId_id.id);
        const key = `${tenantId}:${id}`;
        const current = store.get(key);
        const next = current
          ? {
              ...current,
              payload: update.payload,
            }
          : {
              tenantId,
              id,
              payload: create.payload,
            };
        store.set(key, next);
        return next;
      },
    },
  };
  const repository = new LicenseRepository(prisma);
  return { repository, store };
}

test('LicenseRepository stores encrypted payload and returns decrypted record', async () => {
  const { repository, store } = createRepositoryWithInMemoryStore();
  const payload = {
    lease: {
      lease_id: 'lease-1',
      token: 'token-lease-1',
      expires_at: Date.now() + 60_000,
      tenant_id: 'tenant-a',
      user_id: 'user-a',
      vm_uuid: 'vm-1',
      module: 'bootstrap',
    },
    status: 'active',
  };

  const saved = await repository.upsert({
    tenantId: 'tenant-a',
    id: 'lease-1',
    payload,
  });
  assert.equal(saved.status, 'active');
  assert.equal(saved.lease.lease_id, 'lease-1');

  const raw = store.get('tenant-a:lease-1');
  assert.ok(raw && typeof raw === 'object');
  const rawPayload = (raw as { payload: unknown }).payload;
  assert.ok(rawPayload && typeof rawPayload === 'object');
  assert.ok(Object.hasOwn(rawPayload as Record<string, unknown>, '__enc_payload_v1'));

  const loaded = await repository.findById('tenant-a', 'lease-1');
  assert.equal(loaded?.lease.lease_id, 'lease-1');
  assert.equal(loaded?.status, 'active');
});

test('LicenseRepository keeps legacy plaintext payload compatible', async () => {
  const { repository, store } = createRepositoryWithInMemoryStore();
  store.set('tenant-a:legacy-1', {
    tenantId: 'tenant-a',
    id: 'legacy-1',
    payload: {
      lease: {
        lease_id: 'legacy-1',
        token: 'legacy-token',
        expires_at: Date.now() + 60_000,
        tenant_id: 'tenant-a',
        user_id: 'user-a',
        vm_uuid: 'vm-1',
        module: 'bootstrap',
      },
      status: 'active',
    },
  });

  const loaded = await repository.findById('tenant-a', 'legacy-1');
  assert.equal(loaded?.lease.lease_id, 'legacy-1');
  assert.equal(loaded?.status, 'active');
});

test('LicenseRepository findActiveByToken works with encrypted payloads', async () => {
  const { repository, store } = createRepositoryWithInMemoryStore();
  const crypto = new DataAtRestCrypto();
  store.set('tenant-a:lease-enc', {
    tenantId: 'tenant-a',
    id: 'lease-enc',
    payload: {
      __enc_payload_v1: crypto.encryptJson({
        lease: {
          lease_id: 'lease-enc',
          token: 'enc-token',
          expires_at: Date.now() + 60_000,
          tenant_id: 'tenant-a',
          user_id: 'user-a',
          vm_uuid: 'vm-enc',
          module: 'bootstrap',
        },
        status: 'active',
      }),
    },
  });

  const lease = await repository.findActiveByToken({
    tenantId: 'tenant-a',
    token: 'enc-token',
    vmUuid: 'vm-enc',
    module: 'bootstrap',
  });
  assert.equal(lease?.lease_id, 'lease-enc');
});
