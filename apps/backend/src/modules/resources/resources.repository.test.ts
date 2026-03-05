export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ResourcesRepository } = require('./resources.repository.ts');

function withResourcesTypedFirstEnv(run: () => Promise<void>) {
  const prev = {
    BOTMOX_TYPED_STORE_PARITY_GATE: process.env.BOTMOX_TYPED_STORE_PARITY_GATE,
    BOTMOX_RESOURCES_READ_PRECEDENCE: process.env.BOTMOX_RESOURCES_READ_PRECEDENCE,
    BOTMOX_RESOURCES_DUAL_WRITE: process.env.BOTMOX_RESOURCES_DUAL_WRITE,
  };

  process.env.BOTMOX_TYPED_STORE_PARITY_GATE = 'false';
  process.env.BOTMOX_RESOURCES_READ_PRECEDENCE = 'typed-first';
  process.env.BOTMOX_RESOURCES_DUAL_WRITE = 'true';

  return run().finally(() => {
    process.env.BOTMOX_TYPED_STORE_PARITY_GATE = prev.BOTMOX_TYPED_STORE_PARITY_GATE;
    process.env.BOTMOX_RESOURCES_READ_PRECEDENCE = prev.BOTMOX_RESOURCES_READ_PRECEDENCE;
    process.env.BOTMOX_RESOURCES_DUAL_WRITE = prev.BOTMOX_RESOURCES_DUAL_WRITE;
  });
}

function asSqlText(sql: { strings?: string[] } | undefined): string {
  if (!sql || !Array.isArray(sql.strings)) {
    return '';
  }
  return sql.strings.join('?').toLowerCase();
}

test('ResourcesRepository typed read uses typed business columns as primary payload source', async () => {
  await withResourcesTypedFirstEnv(async () => {
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          resourceItem: {
            findMany: async () => [
              {
                id: 'res-legacy',
                payload: { status: 'legacy-status' },
              },
            ],
          },
        });
      },
      $queryRaw: async () => [
        {
          id: 'proxy-1',
          data: {
            status: 'legacy-status',
            bot_id: 'legacy-bot',
            expires_at: 111,
          },
          type: 'residential',
          status: 'active',
          botId: 'typed-bot',
          country: 'RU',
          countryCode: 'RU',
          ip: '127.0.0.1',
          port: 8080,
          expiresAt: new Date(1_720_000_000_000),
          daysRemaining: 8,
          isExpiringSoon: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const repository = new ResourcesRepository(prisma);
    const rows = await repository.list('tenant-a', 'proxies');

    assert.equal(rows.length, 1);
    const payload = rows[0].payload;
    assert.equal(payload.status, 'active');
    assert.equal(payload.type, 'residential');
    assert.equal(payload.bot_id, 'typed-bot');
    assert.equal(payload.country, 'RU');
    assert.equal(payload.country_code, 'RU');
    assert.equal(payload.ip, '127.0.0.1');
    assert.equal(payload.port, 8080);
    assert.equal(payload.days_remaining, 8);
    assert.equal(payload.is_expiring_soon, false);
    assert.equal(payload.expires_at, 1_720_000_000_000);
  });
});

test('ResourcesRepository typed upsert writes typed business columns from payload', async () => {
  await withResourcesTypedFirstEnv(async () => {
    let capturedSqlValues: unknown[] = [];
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          resourceItem: {
            upsert: async ({
              where,
              create,
            }: {
              where: { tenantId_kind_id: { tenantId: string; kind: string; id: string } };
              create: { payload: unknown };
            }) => {
              return {
                tenantId: where.tenantId_kind_id.tenantId,
                kind: where.tenantId_kind_id.kind,
                id: where.tenantId_kind_id.id,
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
            id: 'proxy-2',
            data: {},
            type: 'residential',
            status: 'active',
            botId: 'bot-2',
            country: 'DE',
            countryCode: 'DE',
            ip: '10.0.0.2',
            port: 3128,
            expiresAt: new Date(1_730_000_000_000),
            daysRemaining: 12,
            isExpiringSoon: false,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      },
    };

    const repository = new ResourcesRepository(prisma);
    const row = await repository.upsert({
      tenantId: 'tenant-a',
      kind: 'proxies',
      id: 'proxy-2',
      payload: {
        id: 'proxy-2',
        type: 'residential',
        status: 'active',
        bot_id: 'bot-2',
        country: 'DE',
        country_code: 'DE',
        ip: '10.0.0.2',
        port: 3128,
        expires_at: 1_730_000_000_000,
        days_remaining: 12,
        is_expiring_soon: false,
      },
    });

    assert.equal(capturedSqlValues[2], 'residential');
    assert.equal(capturedSqlValues[3], 'active');
    assert.equal(capturedSqlValues[4], 'bot-2');
    assert.equal(capturedSqlValues[5], 'DE');
    assert.equal(capturedSqlValues[6], 'DE');
    assert.equal(capturedSqlValues[7], '10.0.0.2');
    assert.equal(capturedSqlValues[8], 3128);
    assert.ok(capturedSqlValues[9] instanceof Date);
    assert.equal(capturedSqlValues[10], 12);
    assert.equal(capturedSqlValues[11], false);

    assert.equal(row.payload.bot_id, 'bot-2');
    assert.equal(row.payload.country_code, 'DE');
    assert.equal(row.payload.port, 3128);
  });
});

test('ResourcesRepository deleteLinkedToBot uses typed bot_id predicates only', async () => {
  await withResourcesTypedFirstEnv(async () => {
    const executedSql: string[] = [];
    const counts = [2, 3, 4];
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          resourceItem: {
            deleteMany: async () => ({ count: 0 }),
          },
        });
      },
      $executeRaw: async (sql: { strings?: string[] }) => {
        executedSql.push(asSqlText(sql));
        return counts.shift() ?? 0;
      },
      $queryRaw: async () => [],
    };

    const repository = new ResourcesRepository(prisma);
    const deleted = await repository.deleteLinkedToBot('tenant-a', 'bot-77');

    assert.equal(deleted, 9);
    assert.equal(executedSql.length, 3);
    const proxiesDeleteSql = executedSql[0] ?? '';
    const licensesDeleteSql = executedSql[2] ?? '';
    assert.ok(proxiesDeleteSql.includes('bot_id = ?'));
    assert.ok(!proxiesDeleteSql.includes("data->>'bot_id' = ?"));
    assert.ok(licensesDeleteSql.includes('bot_id = ?'));
    assert.ok(!licensesDeleteSql.includes("(data->'bot_ids') ? ?"));
  });
});

test('ResourcesRepository typed findById prefers typed columns over stale JSON payload', async () => {
  await withResourcesTypedFirstEnv(async () => {
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          resourceItem: {
            findFirst: async () => ({
              id: 'proxy-legacy',
              payload: {
                status: 'legacy-status',
                bot_id: 'legacy-bot',
              },
            }),
          },
        });
      },
      $queryRaw: async () => [
        {
          id: 'proxy-typed',
          data: {
            status: 'legacy-status',
            bot_id: 'legacy-bot',
            country_code: 'ZZ',
          },
          type: 'mobile',
          status: 'active',
          botId: 'typed-bot',
          country: 'US',
          countryCode: 'US',
          ip: '10.10.10.10',
          port: 1080,
          expiresAt: new Date(1_740_000_000_000),
          daysRemaining: 15,
          isExpiringSoon: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const repository = new ResourcesRepository(prisma);
    const row = await repository.findById('tenant-a', 'proxies', 'proxy-typed');

    assert.ok(row);
    assert.equal(row.payload.status, 'active');
    assert.equal(row.payload.type, 'mobile');
    assert.equal(row.payload.bot_id, 'typed-bot');
    assert.equal(row.payload.country_code, 'US');
    assert.equal(row.payload.port, 1080);
    assert.equal(row.payload.is_expiring_soon, true);
    assert.equal(row.payload.expires_at, 1_740_000_000_000);
  });
});
