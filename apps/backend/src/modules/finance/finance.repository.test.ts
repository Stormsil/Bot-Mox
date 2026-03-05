export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { FinanceRepository } = require('./finance.repository.ts');

function withFinanceTypedFirstEnv(run: () => Promise<void>) {
  const prev = {
    BOTMOX_TYPED_STORE_PARITY_GATE: process.env.BOTMOX_TYPED_STORE_PARITY_GATE,
    BOTMOX_FINANCE_READ_PRECEDENCE: process.env.BOTMOX_FINANCE_READ_PRECEDENCE,
    BOTMOX_FINANCE_DUAL_WRITE: process.env.BOTMOX_FINANCE_DUAL_WRITE,
  };

  process.env.BOTMOX_TYPED_STORE_PARITY_GATE = 'false';
  process.env.BOTMOX_FINANCE_READ_PRECEDENCE = 'typed-first';
  process.env.BOTMOX_FINANCE_DUAL_WRITE = 'true';

  return run().finally(() => {
    process.env.BOTMOX_TYPED_STORE_PARITY_GATE = prev.BOTMOX_TYPED_STORE_PARITY_GATE;
    process.env.BOTMOX_FINANCE_READ_PRECEDENCE = prev.BOTMOX_FINANCE_READ_PRECEDENCE;
    process.env.BOTMOX_FINANCE_DUAL_WRITE = prev.BOTMOX_FINANCE_DUAL_WRITE;
  });
}

test('FinanceRepository typed list uses typed business columns over stale data/payload JSON', async () => {
  await withFinanceTypedFirstEnv(async () => {
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          financeOperation: {
            findMany: async () => [],
          },
        });
      },
      $queryRaw: async () => [
        {
          id: 'fin-1',
          data: {
            type: 'legacy-type',
            amount: 10,
            status: 'legacy-status',
            bot_id: 'legacy-bot',
            operation_at: 1,
          },
          payload: {
            type: 'legacy-payload-type',
            category: 'legacy-payload-category',
            amount: 11,
            currency: 'EUR',
            status: 'legacy-payload-status',
            project_id: 'legacy-project',
            bot_id: 'legacy-bot-2',
            gold_amount: 99,
            gold_price_at_time: 3.14,
            operation_at: 2,
          },
          type: 'withdrawal',
          category: 'market',
          amount: 150,
          currency: 'USD',
          operationAt: new Date(1_730_000_000_000),
          status: 'booked',
          projectId: 'project-typed',
          botId: 'bot-typed',
          goldAmount: 1500,
          goldPriceAtTime: 1.5,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const repository = new FinanceRepository(prisma);
    const rows = await repository.list('tenant-a');

    assert.equal(rows.length, 1);
    const payload = rows[0].payload;
    assert.equal(payload.type, 'withdrawal');
    assert.equal(payload.category, 'market');
    assert.equal(payload.amount, 150);
    assert.equal(payload.currency, 'USD');
    assert.equal(payload.status, 'booked');
    assert.equal(payload.project_id, 'project-typed');
    assert.equal(payload.bot_id, 'bot-typed');
    assert.equal(payload.gold_amount, 1500);
    assert.equal(payload.gold_price_at_time, 1.5);
    assert.equal(payload.operation_at, 1_730_000_000_000);
    assert.equal(payload.date, 1_730_000_000_000);
  });
});

test('FinanceRepository typed findById uses typed business columns over stale JSON', async () => {
  await withFinanceTypedFirstEnv(async () => {
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          financeOperation: {
            findFirst: async () => null,
          },
        });
      },
      $queryRaw: async () => [
        {
          id: 'fin-2',
          data: {
            status: 'legacy-status',
            operation_at: 123,
          },
          payload: {
            status: 'legacy-payload-status',
            operation_at: 456,
          },
          type: 'deposit',
          category: 'salary',
          amount: 77,
          currency: 'RUB',
          operationAt: '2024-01-01T00:00:00.000Z',
          status: 'confirmed',
          projectId: 'project-2',
          botId: 'bot-2',
          goldAmount: 333,
          goldPriceAtTime: 2.2,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ],
    };

    const repository = new FinanceRepository(prisma);
    const row = await repository.findById('tenant-a', 'fin-2');

    assert.ok(row);
    assert.equal(row.payload.type, 'deposit');
    assert.equal(row.payload.category, 'salary');
    assert.equal(row.payload.status, 'confirmed');
    assert.equal(row.payload.operation_at, 1_704_067_200_000);
    assert.equal(row.payload.project_id, 'project-2');
    assert.equal(row.payload.bot_id, 'bot-2');
  });
});

test('FinanceRepository typed upsert writes typed columns from payload values', async () => {
  await withFinanceTypedFirstEnv(async () => {
    let capturedSqlValues = [] as unknown[];
    const prisma = {
      withTenantContext: async (_tenantId: string, handler: (tx: unknown) => Promise<unknown>) => {
        return handler({
          financeOperation: {
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
            id: 'fin-3',
            data: {},
            payload: {},
            type: 'expense',
            category: 'infra',
            amount: 420,
            currency: 'USD',
            operationAt: new Date('2024-05-15T12:00:00.000Z'),
            status: 'approved',
            projectId: 'project-upsert',
            botId: 'bot-upsert',
            goldAmount: 11,
            goldPriceAtTime: 4.2,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ];
      },
    };

    const repository = new FinanceRepository(prisma);
    const row = await repository.upsert({
      tenantId: 'tenant-a',
      id: 'fin-3',
      payload: {
        id: 'fin-3',
        type: 'expense',
        category: 'infra',
        amount: 420,
        currency: 'USD',
        operation_at: 1_715_774_400_000,
        status: 'approved',
        project_id: 'project-upsert',
        bot_id: 'bot-upsert',
        gold_amount: 11,
        gold_price_at_time: 4.2,
      },
    });

    assert.equal(capturedSqlValues[2], 'expense');
    assert.equal(capturedSqlValues[3], 'infra');
    assert.equal(capturedSqlValues[4], 420);
    assert.equal(capturedSqlValues[5], 'USD');
    assert.equal(capturedSqlValues[6], '2024-05-15T12:00:00.000Z');
    assert.equal(capturedSqlValues[7], 'approved');
    assert.equal(capturedSqlValues[8], 'project-upsert');
    assert.equal(capturedSqlValues[9], 'bot-upsert');
    assert.equal(capturedSqlValues[10], 11);
    assert.equal(capturedSqlValues[11], 4.2);

    assert.equal(row.payload.type, 'expense');
    assert.equal(row.payload.category, 'infra');
    assert.equal(row.payload.amount, 420);
    assert.equal(row.payload.operation_at, 1_715_774_400_000);
  });
});
