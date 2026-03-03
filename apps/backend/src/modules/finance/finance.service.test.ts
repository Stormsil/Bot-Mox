export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { FinanceService } = require('./finance.service.ts');

type RepositoryStub = {
  list: (...args: unknown[]) => Promise<Array<Record<string, unknown>>>;
  findById: (...args: unknown[]) => Promise<Record<string, unknown> | null>;
  upsert: (...args: unknown[]) => Promise<Record<string, unknown>>;
  delete: (...args: unknown[]) => Promise<boolean>;
};

function createService(repositoryStub: RepositoryStub) {
  return new FinanceService(repositoryStub);
}

test('FinanceService requires tenantId', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => null,
    upsert: async () => ({}),
    delete: async () => false,
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list({}, ''), /tenantId is required/);
  await assert.rejects(() => service.getById('id-1', ''), /tenantId is required/);
  await assert.rejects(() => service.create({ amount: 10 }, undefined, ''), /tenantId is required/);
});

test('FinanceService fails hard on repository errors', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => {
      throw new Error('repo list failed');
    },
    findById: async () => null,
    upsert: async () => {
      throw new Error('repo upsert failed');
    },
    delete: async () => false,
  };
  const service = createService(repositoryStub);
  await assert.rejects(() => service.list({}, 'tenant-a'), /repo list failed/);
  await assert.rejects(
    () => service.create({ amount: 10, type: 'income' }, undefined, 'tenant-a'),
    /repo upsert failed/,
  );
});

test('FinanceService CRUD/list use repository only', async () => {
  const records = new Map<string, Record<string, unknown>>();
  const dbRows = new Map<string, Record<string, unknown>>();
  const repositoryStub: RepositoryStub = {
    list: async () => [...dbRows.values()],
    findById: async (_tenantId: unknown, id: unknown) => {
      const key = String(id);
      return dbRows.get(key) ?? null;
    },
    upsert: async (input: unknown) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      dbRows.set(typed.id, { id: typed.id, payload: typed.payload });
      records.set(typed.id, typed.payload);
      return dbRows.get(typed.id) as Record<string, unknown>;
    },
    delete: async (_tenantId: unknown, id: unknown) => {
      const key = String(id);
      const existed = dbRows.has(key);
      dbRows.delete(key);
      records.delete(key);
      return existed;
    },
  };
  const service = createService(repositoryStub);
  const created = await service.create({ amount: 42, type: 'income' }, 'fin-1', 'tenant-a');
  assert.equal(created.id, 'fin-1');
  const listed = await service.list({}, 'tenant-a');
  assert.equal(listed.total, 1);
  const fetched = await service.getById('fin-1', 'tenant-a');
  assert.equal(fetched?.id, 'fin-1');
  const removed = await service.remove('fin-1', 'tenant-a');
  assert.equal(removed, true);
});

test('FinanceService passes plain payload to repository and returns record shape', async () => {
  let lastUpsertPayload: Record<string, unknown> | null = null;
  const dbRows = new Map<string, Record<string, unknown>>();
  const repositoryStub: RepositoryStub = {
    list: async () => [...dbRows.values()],
    findById: async (_tenantId: unknown, id: unknown) => dbRows.get(String(id)) ?? null,
    upsert: async (input: unknown) => {
      const typed = input as { id: string; payload: Record<string, unknown> };
      lastUpsertPayload = typed.payload;
      const row = { id: typed.id, payload: typed.payload };
      dbRows.set(typed.id, row);
      return row;
    },
    delete: async () => false,
  };

  const service = createService(repositoryStub);
  const created = await service.create(
    { id: 'fin-sec-1', amount: 77, note: 'private note' },
    undefined,
    'tenant-a',
  );

  assert.equal(created.id, 'fin-sec-1');
  assert.equal(created.note, 'private note');
  assert.ok(lastUpsertPayload && typeof lastUpsertPayload === 'object');
  assert.equal(Object.hasOwn(lastUpsertPayload || {}, '__enc_payload_v1'), false);
  assert.equal((lastUpsertPayload as Record<string, unknown> | null)?.note, 'private note');

  const listed = await service.list({}, 'tenant-a');
  assert.equal(listed.items.length, 1);
  assert.equal(listed.items[0].note, 'private note');
});

test('FinanceService aggregate DTOs are stable for normal filtered period', async () => {
  const day1 = Date.UTC(2026, 0, 1, 12, 0, 0, 0);
  const day2 = Date.UTC(2026, 0, 2, 12, 0, 0, 0);
  const day4 = Date.UTC(2026, 0, 4, 12, 0, 0, 0);
  const rows = [
    {
      id: 'fin-1',
      payload: {
        id: 'fin-1',
        type: 'income',
        category: 'sale',
        amount: 100,
        currency: 'usd',
        project_id: 'wow_tbc',
        date: day1,
      },
    },
    {
      id: 'fin-2',
      payload: {
        id: 'fin-2',
        type: 'expense',
        category: 'consumables',
        amount: 30,
        currency: 'usd',
        project_id: 'wow_tbc',
        date: day2,
      },
    },
    {
      id: 'fin-3',
      payload: {
        id: 'fin-3',
        type: 'income',
        category: 'sale',
        amount: 50,
        currency: 'usd',
        project_id: 'wow_tbc',
        date: day4,
      },
    },
    {
      id: 'fin-4',
      payload: {
        id: 'fin-4',
        type: 'expense',
        category: 'consumables',
        amount: 999,
        currency: 'usd',
        project_id: 'wow_midnight',
        date: day1,
      },
    },
  ];

  const repositoryStub: RepositoryStub = {
    list: async () => rows,
    findById: async () => null,
    upsert: async () => ({ id: 'x', payload: {} }),
    delete: async () => false,
  };
  const service = createService(repositoryStub);

  const summary = await service.getSummary(
    {
      from_ts: Date.UTC(2026, 0, 1, 0, 0, 0, 0),
      to_ts: Date.UTC(2026, 0, 3, 23, 59, 59, 999),
      project_id: 'wow_tbc',
      currency: 'usd',
    },
    'tenant-a',
  );

  assert.deepEqual(summary, {
    income_total: 100,
    expense_total: 30,
    net_total: 70,
    margin_percent: 70,
    operation_count: 2,
    period: {
      from_ts: Date.UTC(2026, 0, 1, 0, 0, 0, 0),
      to_ts: Date.UTC(2026, 0, 3, 23, 59, 59, 999),
    },
  });

  const breakdown = await service.getBreakdown(
    {
      from_ts: Date.UTC(2026, 0, 1, 0, 0, 0, 0),
      to_ts: Date.UTC(2026, 0, 3, 23, 59, 59, 999),
      project_id: 'wow_tbc',
      currency: 'usd',
    },
    'tenant-a',
  );

  assert.equal(breakdown.group_by, 'category');
  assert.equal(breakdown.items.length, 2);
  assert.deepEqual(breakdown.items[0], {
    key: 'sale',
    label: 'sale',
    amount: 100,
    share_percent: (100 / 130) * 100,
    count: 1,
    income_total: 100,
    expense_total: 0,
    net_total: 100,
  });
  assert.deepEqual(breakdown.items[1], {
    key: 'consumables',
    label: 'consumables',
    amount: 30,
    share_percent: (30 / 130) * 100,
    count: 1,
    income_total: 0,
    expense_total: 30,
    net_total: -30,
  });

  const timeSeries = await service.getTimeSeries(
    {
      from_ts: Date.UTC(2026, 0, 1, 0, 0, 0, 0),
      to_ts: Date.UTC(2026, 0, 3, 23, 59, 59, 999),
      granularity: 'day',
      project_id: 'wow_tbc',
      currency: 'usd',
    },
    'tenant-a',
  );

  assert.equal(timeSeries.granularity, 'day');
  assert.deepEqual(timeSeries.points, [
    {
      bucket: '2026-01-01',
      income_total: 100,
      expense_total: 0,
      net_total: 100,
      operation_count: 1,
    },
    {
      bucket: '2026-01-02',
      income_total: 0,
      expense_total: 30,
      net_total: -30,
      operation_count: 1,
    },
    {
      bucket: '2026-01-03',
      income_total: 0,
      expense_total: 0,
      net_total: 0,
      operation_count: 0,
    },
  ]);
  assert.deepEqual(timeSeries.totals, summary);
});

test('FinanceService aggregate DTOs handle empty dataset', async () => {
  const repositoryStub: RepositoryStub = {
    list: async () => [],
    findById: async () => null,
    upsert: async () => ({ id: 'x', payload: {} }),
    delete: async () => false,
  };
  const service = createService(repositoryStub);

  const query = {
    from_ts: Date.UTC(2026, 1, 1, 0, 0, 0, 0),
    to_ts: Date.UTC(2026, 1, 2, 23, 59, 59, 999),
  };

  const summary = await service.getSummary(query, 'tenant-a');
  assert.deepEqual(summary, {
    income_total: 0,
    expense_total: 0,
    net_total: 0,
    margin_percent: 0,
    operation_count: 0,
    period: query,
  });

  const breakdown = await service.getBreakdown(query, 'tenant-a');
  assert.deepEqual(breakdown, {
    group_by: 'category',
    items: [],
    totals: summary,
  });

  const timeSeries = await service.getTimeSeries({ ...query, granularity: 'day' }, 'tenant-a');
  assert.equal(timeSeries.points.length, 2);
  assert.deepEqual(timeSeries.points[0], {
    bucket: '2026-02-01',
    income_total: 0,
    expense_total: 0,
    net_total: 0,
    operation_count: 0,
  });
  assert.deepEqual(timeSeries.points[1], {
    bucket: '2026-02-02',
    income_total: 0,
    expense_total: 0,
    net_total: 0,
    operation_count: 0,
  });
});
