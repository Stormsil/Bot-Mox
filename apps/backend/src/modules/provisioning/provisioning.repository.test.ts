export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ProvisioningRepository } = require('./provisioning.repository.ts');
const { DataAtRestCrypto } = require('../common/data-at-rest-crypto.ts');

function createRepositoryWithInMemoryStore() {
  const tokens = new Map<string, Record<string, unknown>>();
  const crypto = new DataAtRestCrypto();
  const wrapPayload = (payload: unknown) =>
    payload &&
    typeof payload === 'object' &&
    !Object.hasOwn(payload as Record<string, unknown>, '__enc_payload_v1')
      ? { __enc_payload_v1: crypto.encryptJson(payload) }
      : payload;
  const unwrapRow = (row: Record<string, unknown> | null) => {
    if (!row || !row.payload || typeof row.payload !== 'object') return row;
    const payloadObj = row.payload as Record<string, unknown>;
    if (!Object.hasOwn(payloadObj, '__enc_payload_v1')) return row;
    return { ...row, payload: crypto.decryptJson(payloadObj.__enc_payload_v1) };
  };
  const prisma = {
    provisioningProfileItem: {
      findMany: async () => [],
      findFirst: async () => null,
      upsert: async () => ({}),
      delete: async () => undefined,
    },
    provisioningTokenItem: {
      findFirst: async ({ where }: { where: { token: string } }) => {
        return tokens.get(String(where.token)) ?? null;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { token: string };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const key = String(where.token);
        const current = tokens.get(key);
        const next = current
          ? { ...current, payload: update.payload, tenantId: update.tenantId }
          : {
              token: create.token,
              tenantId: create.tenantId,
              payload: create.payload,
              expiresAt: create.expiresAt,
            };
        tokens.set(key, next);
        return next;
      },
      delete: async ({ where }: { where: { token: string } }) => {
        tokens.delete(String(where.token));
      },
    },
    provisioningProgressItem: {
      findMany: async () => [],
      create: async () => ({}),
    },
    getPayloadCryptoClient() {
      return {
        provisioningProfileItem: prisma.provisioningProfileItem,
        provisioningProgressItem: prisma.provisioningProgressItem,
        provisioningTokenItem: {
          findFirst: async (args: { where: { token: string } }) =>
            unwrapRow(await prisma.provisioningTokenItem.findFirst(args)),
          upsert: async (args: {
            where: { token: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) =>
            unwrapRow(
              await prisma.provisioningTokenItem.upsert({
                ...args,
                create: { ...args.create, payload: wrapPayload(args.create.payload) },
                update: { ...args.update, payload: wrapPayload(args.update.payload) },
              }),
            ),
          delete: prisma.provisioningTokenItem.delete,
        },
      };
    },
  };

  return { repository: new ProvisioningRepository(prisma), tokens };
}

test('ProvisioningRepository stores encrypted token payload and returns decrypted token', async () => {
  const { repository, tokens } = createRepositoryWithInMemoryStore();
  const record = {
    token: 'tok-1',
    tokenId: 'token-1',
    tenantId: 'tenant-a',
    userId: 'user-a',
    vmUuid: 'vm-1',
    expiresAtMs: Date.now() + 60_000,
  };

  await repository.upsertToken(record);
  const raw = tokens.get('tok-1');
  assert.ok(raw);
  const rawPayload = (raw as { payload: unknown }).payload;
  assert.ok(rawPayload && typeof rawPayload === 'object');
  assert.ok(Object.hasOwn(rawPayload as Record<string, unknown>, '__enc_payload_v1'));

  const loaded = await repository.findToken('tok-1');
  assert.equal(loaded?.token, 'tok-1');
  assert.equal(loaded?.tenantId, 'tenant-a');
});

test('ProvisioningRepository keeps legacy plaintext token payload compatible', async () => {
  const { repository, tokens } = createRepositoryWithInMemoryStore();
  tokens.set('tok-legacy', {
    token: 'tok-legacy',
    tenantId: 'tenant-a',
    payload: {
      token: 'tok-legacy',
      tokenId: 'legacy-1',
      tenantId: 'tenant-a',
      userId: 'user-a',
      vmUuid: 'vm-legacy',
      expiresAtMs: Date.now() + 60_000,
    },
    expiresAt: new Date(Date.now() + 60_000),
  });

  const loaded = await repository.findToken('tok-legacy');
  assert.equal(loaded?.tokenId, 'legacy-1');
  assert.equal(loaded?.vmUuid, 'vm-legacy');
});
