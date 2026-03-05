export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BotsRepository } = require('./bots.repository.ts');

function withBotsTypedFirstEnv(run: () => Promise<void>) {
  const prev = {
    BOTMOX_TYPED_STORE_PARITY_GATE: process.env.BOTMOX_TYPED_STORE_PARITY_GATE,
    BOTMOX_BOTS_READ_PRECEDENCE: process.env.BOTMOX_BOTS_READ_PRECEDENCE,
    BOTMOX_BOTS_DUAL_WRITE: process.env.BOTMOX_BOTS_DUAL_WRITE,
  };

  process.env.BOTMOX_TYPED_STORE_PARITY_GATE = 'false';
  process.env.BOTMOX_BOTS_READ_PRECEDENCE = 'typed-first';
  process.env.BOTMOX_BOTS_DUAL_WRITE = 'true';

  return run().finally(() => {
    process.env.BOTMOX_TYPED_STORE_PARITY_GATE = prev.BOTMOX_TYPED_STORE_PARITY_GATE;
    process.env.BOTMOX_BOTS_READ_PRECEDENCE = prev.BOTMOX_BOTS_READ_PRECEDENCE;
    process.env.BOTMOX_BOTS_DUAL_WRITE = prev.BOTMOX_BOTS_DUAL_WRITE;
  });
}

test('BotsRepository typed read uses typed business columns as primary payload source', async () => {
  await withBotsTypedFirstEnv(async () => {
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          botEntity: {
            findMany: async () => [
              {
                id: 'bot-legacy',
                payload: { status: 'legacy-status' },
              },
            ],
          },
        });
      },
      $queryRaw: async () => [
        {
          id: 'bot-1',
          data: {
            status: 'legacy-status',
            platform: 'legacy-platform',
          },
          status: 'typed-status',
          lifecycle: { current_stage: 'farming' },
          platform: 'typed-platform',
          profile: 'typed-profile',
          version: 'typed-version',
          lastSeenAt: new Date(1_700_000_000_000),
          createdAt: new Date(1_700_000_000_000),
          updatedAt: new Date(1_700_000_100_000),
        },
      ],
    };

    const repository = new BotsRepository(prisma);
    const rows = await repository.list('tenant-a');

    assert.equal(rows.length, 1);
    const payload = rows[0].payload;
    assert.equal(payload.status, 'typed-status');
    assert.equal(payload.platform, 'typed-platform');
    assert.equal(payload.profile, 'typed-profile');
    assert.equal(payload.version, 'typed-version');
    assert.equal(payload.lifecycle.current_stage, 'farming');
    assert.equal(payload.last_seen_at, 1_700_000_000_000);
  });
});

test('BotsRepository typed upsert writes typed business columns from payload', async () => {
  await withBotsTypedFirstEnv(async () => {
    let capturedSqlValues: unknown[] = [];
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          botEntity: {
            upsert: async ({
              where,
              create,
            }: {
              where: { tenantId_id: { tenantId: string; id: string } };
              create: { payload: unknown };
            }) => {
              return {
                tenantId: where.tenantId_id.tenantId,
                id: where.tenantId_id.id,
                payload: create.payload,
              };
            },
          },
        });
      },
      $queryRaw: async (sql: { values?: unknown[] }) => {
        capturedSqlValues = Array.isArray(sql.values) ? sql.values : [];
        return [
          {
            id: 'bot-2',
            data: { status: 'legacy-status' },
            status: 'banned',
            lifecycle: { current_stage: 'banned' },
            platform: 'windows',
            profile: 'route-a',
            version: 'v2',
            lastSeenAt: new Date(1_710_000_000_000),
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      },
    };

    const repository = new BotsRepository(prisma);
    const row = await repository.upsert({
      tenantId: 'tenant-a',
      id: 'bot-2',
      payload: {
        id: 'bot-2',
        status: 'banned',
        lifecycle: { current_stage: 'banned' },
        platform: 'windows',
        profile: 'route-a',
        version: 'v2',
        last_seen_at: 1_710_000_000_000,
      },
    });

    assert.equal(capturedSqlValues[2], 'banned');
    assert.equal(capturedSqlValues[4], 'windows');
    assert.equal(capturedSqlValues[5], 'route-a');
    assert.equal(capturedSqlValues[6], 'v2');
    assert.ok(capturedSqlValues[7] instanceof Date);

    assert.equal(row.payload.status, 'banned');
    assert.equal(row.payload.platform, 'windows');
    assert.equal(row.payload.profile, 'route-a');
    assert.equal(row.payload.version, 'v2');
  });
});

test('BotsRepository typed findById prefers typed columns over stale JSON payload', async () => {
  await withBotsTypedFirstEnv(async () => {
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          botEntity: {
            findFirst: async () => ({
              id: 'bot-legacy',
              payload: {
                status: 'legacy-status',
                platform: 'legacy-platform',
              },
            }),
          },
        });
      },
      $queryRaw: async () => [
        {
          id: 'bot-typed',
          data: {
            status: 'legacy-status',
            platform: 'legacy-platform',
            profile: 'legacy-profile',
          },
          status: 'running',
          lifecycle: { current_stage: 'combat' },
          platform: 'windows',
          profile: 'route-b',
          version: 'v3',
          lastSeenAt: new Date(1_720_000_000_000),
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const repository = new BotsRepository(prisma);
    const row = await repository.findById('tenant-a', 'bot-typed');

    assert.ok(row);
    assert.equal(row.payload.status, 'running');
    assert.equal(row.payload.platform, 'windows');
    assert.equal(row.payload.profile, 'route-b');
    assert.equal(row.payload.version, 'v3');
    assert.equal(row.payload.lifecycle.current_stage, 'combat');
    assert.equal(row.payload.last_seen_at, 1_720_000_000_000);
  });
});
