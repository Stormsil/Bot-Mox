export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ArtifactsRepository } = require('./artifacts.repository.ts');
const { DataAtRestCrypto } = require('../common/data-at-rest-crypto.ts');

function createRepositoryWithInMemoryStore() {
  const releases = new Map<string, Record<string, unknown>>();
  const assignments = new Map<string, Record<string, unknown>>();
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
    artifactReleaseItem: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: Record<string, unknown>;
        orderBy?: unknown;
      }) => {
        if (where.tenantId && where.id !== undefined) {
          return releases.get(`${String(where.tenantId)}:${String(where.id)}`) ?? null;
        }
        if (where.tenantId && orderBy) {
          const tenantPrefix = `${String(where.tenantId)}:`;
          const ids = [...releases.keys()]
            .filter((key) => key.startsWith(tenantPrefix))
            .map((key) => Number(key.split(':')[1]))
            .filter(Number.isFinite)
            .sort((a, b) => b - a);
          if (ids.length === 0) return null;
          return releases.get(`${String(where.tenantId)}:${String(ids[0])}`) ?? null;
        }
        return null;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: { tenantId_id: { tenantId: string; id: number } };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const key = `${where.tenantId_id.tenantId}:${where.tenantId_id.id}`;
        const current = releases.get(key);
        const next = current
          ? { ...current, payload: update.payload }
          : {
              tenantId: create.tenantId,
              id: create.id,
              payload: create.payload,
            };
        releases.set(key, next);
        return next;
      },
      findMany: async () => [],
    },
    artifactAssignmentItem: {
      findFirst: async ({
        where,
        orderBy,
      }: {
        where: Record<string, unknown>;
        orderBy?: unknown;
      }) => {
        if (where.tenantId && where.module && where.platform && where.channel && where.userKey) {
          return (
            assignments.get(
              `${String(where.tenantId)}:${String(where.module)}:${String(where.platform)}:${String(where.channel)}:${String(where.userKey)}`,
            ) ?? null
          );
        }
        if (where.tenantId && orderBy) {
          const rows = [...assignments.values()]
            .filter((row) => String(row.tenantId || '') === String(where.tenantId))
            .sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
          return rows[0] ?? null;
        }
        return null;
      },
      upsert: async ({
        where,
        create,
        update,
      }: {
        where: {
          tenantId_module_platform_channel_userKey: {
            tenantId: string;
            module: string;
            platform: string;
            channel: string;
            userKey: string;
          };
        };
        create: Record<string, unknown>;
        update: Record<string, unknown>;
      }) => {
        const keyObj = where.tenantId_module_platform_channel_userKey;
        const key = `${keyObj.tenantId}:${keyObj.module}:${keyObj.platform}:${keyObj.channel}:${keyObj.userKey}`;
        const current = assignments.get(key);
        const next = current
          ? { ...current, id: update.id ?? current.id, payload: update.payload }
          : {
              tenantId: create.tenantId,
              id: create.id,
              module: create.module,
              platform: create.platform,
              channel: create.channel,
              userKey: create.userKey,
              payload: create.payload,
            };
        assignments.set(key, next);
        return next;
      },
    },
    getPayloadCryptoClient() {
      return {
        artifactReleaseItem: {
          findFirst: async (args: { where: Record<string, unknown>; orderBy?: unknown }) =>
            unwrapRow(await prisma.artifactReleaseItem.findFirst(args)),
          findMany: async () => [],
          upsert: async (args: {
            where: { tenantId_id: { tenantId: string; id: number } };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) =>
            unwrapRow(
              await prisma.artifactReleaseItem.upsert({
                ...args,
                create: { ...args.create, payload: wrapPayload(args.create.payload) },
                update: { ...args.update, payload: wrapPayload(args.update.payload) },
              }),
            ) as Record<string, unknown>,
        },
        artifactAssignmentItem: {
          findFirst: async (args: { where: Record<string, unknown>; orderBy?: unknown }) =>
            unwrapRow(await prisma.artifactAssignmentItem.findFirst(args)),
          upsert: async (args: {
            where: {
              tenantId_module_platform_channel_userKey: {
                tenantId: string;
                module: string;
                platform: string;
                channel: string;
                userKey: string;
              };
            };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) =>
            unwrapRow(
              await prisma.artifactAssignmentItem.upsert({
                ...args,
                create: { ...args.create, payload: wrapPayload(args.create.payload) },
                update: { ...args.update, payload: wrapPayload(args.update.payload) },
              }),
            ) as Record<string, unknown>,
        },
      };
    },
  };

  return {
    repository: new ArtifactsRepository(prisma),
    releases,
    assignments,
  };
}

test('ArtifactsRepository stores encrypted release payload and returns decrypted record', async () => {
  const { repository, releases } = createRepositoryWithInMemoryStore();
  const payload = {
    id: 1,
    tenant_id: 'tenant-a',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
    version: '1.0.0',
    object_key: 'artifact.zip',
    sha256: 'a'.repeat(64),
    size_bytes: 1234,
    status: 'active',
  };
  const saved = await repository.upsertRelease({
    tenantId: 'tenant-a',
    id: 1,
    payload,
  });
  assert.equal(saved.id, 1);
  const raw = releases.get('tenant-a:1');
  assert.ok(raw);
  assert.ok(
    Object.hasOwn(
      (raw as { payload: unknown }).payload as Record<string, unknown>,
      '__enc_payload_v1',
    ),
  );

  const loaded = await repository.findReleaseById('tenant-a', 1);
  assert.equal(loaded?.id, 1);
  assert.equal(loaded?.tenant_id, 'tenant-a');
});

test('ArtifactsRepository reads legacy plaintext assignment payload', async () => {
  const { repository, assignments } = createRepositoryWithInMemoryStore();
  assignments.set('tenant-a:core:windows:stable:__default__', {
    tenantId: 'tenant-a',
    id: 3,
    module: 'core',
    platform: 'windows',
    channel: 'stable',
    userKey: '__default__',
    payload: {
      id: 3,
      tenant_id: 'tenant-a',
      module: 'core',
      platform: 'windows',
      channel: 'stable',
      user_id: null,
      release_id: 1,
      is_default: true,
    },
  });
  const loaded = await repository.findAssignmentByScope({
    tenantId: 'tenant-a',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
    userKey: '__default__',
  });
  assert.equal(loaded?.id, 3);
  assert.equal(loaded?.is_default, true);
});

test('ArtifactsRepository reads encrypted assignment payload', async () => {
  const { repository, assignments } = createRepositoryWithInMemoryStore();
  const crypto = new DataAtRestCrypto();
  assignments.set('tenant-a:core:windows:stable:user-1', {
    tenantId: 'tenant-a',
    id: 4,
    module: 'core',
    platform: 'windows',
    channel: 'stable',
    userKey: 'user-1',
    payload: {
      __enc_payload_v1: crypto.encryptJson({
        id: 4,
        tenant_id: 'tenant-a',
        module: 'core',
        platform: 'windows',
        channel: 'stable',
        user_id: 'user-1',
        release_id: 2,
        is_default: false,
      }),
    },
  });
  const loaded = await repository.findAssignmentByScope({
    tenantId: 'tenant-a',
    module: 'core',
    platform: 'windows',
    channel: 'stable',
    userKey: 'user-1',
  });
  assert.equal(loaded?.id, 4);
  assert.equal(loaded?.release_id, 2);
});
