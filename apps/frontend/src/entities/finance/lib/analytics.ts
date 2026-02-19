import {
  financeOperationCreateSchema,
  financeOperationPatchSchema,
  financeOperationRecordSchema,
} from '@botmox/api-contract';
import {
  createFinanceOperationViaContract,
  deleteFinanceOperationViaContract,
  listFinanceOperationsViaContract,
  patchFinanceOperationViaContract,
} from '../../../providers/finance-contract-client';
import type {
  CategoryBreakdown,
  FinanceCategory,
  FinanceOperation,
  FinanceOperationFormData,
  FinanceOperationType,
  FinanceSummary,
  GoldPriceHistoryEntry,
  TimeSeriesData,
} from '../model/types';

const FETCH_LIMIT = 200;

export function parseDateToTimestamp(dateString: string): number {
  if (!dateString || typeof dateString !== 'string') {
    return Number.NaN;
  }

  const dateStr = dateString.includes(' ') ? dateString : `${dateString} 00:00:00`;
  const date = new Date(dateStr.replace(' ', 'T'));
  const timestamp = date.getTime();

  if (Number.isNaN(timestamp)) {
    return Number.NaN;
  }

  return timestamp;
}

export function formatTimestampToDay(timestamp: number): string {
  const date = new Date(timestamp);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function normalizeFinanceOperationRecord(raw: unknown): FinanceOperation | null {
  const parsed = financeOperationRecordSchema.safeParse(raw);
  if (!parsed.success) return null;

  const source = parsed.data;
  const id = String(source.id || '').trim();
  if (!id) return null;

  const type = source.type === 'expense' ? 'expense' : 'income';
  const category = String(
    source.category || (type === 'income' ? 'sale' : 'other'),
  ) as FinanceCategory;
  const projectIdRaw = source.project_id;
  const project_id =
    projectIdRaw === 'wow_tbc' || projectIdRaw === 'wow_midnight' ? projectIdRaw : null;
  const currency = source.currency === 'gold' ? 'gold' : 'USD';

  const date = Number(source.date || source.created_at || Date.now());
  const created_at = Number(source.created_at || date || Date.now());
  const updated_at =
    source.updated_at === undefined ? undefined : Number(source.updated_at || created_at);
  const gold_amount = source.gold_amount === null ? undefined : source.gold_amount;
  const gold_price_at_time =
    source.gold_price_at_time === undefined ? null : source.gold_price_at_time;

  return {
    id,
    type,
    category,
    bot_id: source.bot_id ? String(source.bot_id) : null,
    project_id,
    description: String(source.description || ''),
    amount: Number(source.amount || 0),
    currency,
    gold_price_at_time: Number.isFinite(gold_price_at_time as number) ? gold_price_at_time : null,
    ...(Number.isFinite(gold_amount as number) ? { gold_amount } : {}),
    date: Number.isFinite(date) ? date : Date.now(),
    created_at: Number.isFinite(created_at) ? created_at : Date.now(),
    ...(updated_at !== undefined && Number.isFinite(updated_at) ? { updated_at } : {}),
  };
}

async function fetchFinanceOperationsPage(
  page: number,
  limit: number,
): Promise<FinanceOperation[]> {
  const query = {
    page,
    limit,
    sort: 'date',
    order: 'desc',
  } as const;

  const response = await listFinanceOperationsViaContract(query);
  const payload = Array.isArray(response.data) ? response.data : [];
  return payload
    .map(normalizeFinanceOperationRecord)
    .filter((item): item is FinanceOperation => Boolean(item));
}

async function fetchAllFinanceOperations(): Promise<FinanceOperation[]> {
  const result: FinanceOperation[] = [];
  let page = 1;
  let guard = 0;

  while (guard < 1000) {
    guard += 1;
    const items = await fetchFinanceOperationsPage(page, FETCH_LIMIT);
    result.push(...items);
    if (items.length < FETCH_LIMIT) break;
    page += 1;
  }

  result.sort((a, b) => b.date - a.date);
  return result;
}

export async function createFinanceOperation(data: FinanceOperationFormData): Promise<string> {
  if (!data.type) {
    throw new Error('type is required');
  }

  const category = data.category || (data.type === 'income' ? 'sale' : null);
  if (!category) {
    throw new Error('category is required');
  }

  if (data.amount === undefined || data.amount === null) {
    throw new Error('amount is required');
  }

  const dateTimestamp = parseDateToTimestamp(data.date);
  if (Number.isNaN(dateTimestamp)) {
    throw new Error(`Invalid date format: ${data.date}. Expected YYYY-MM-DD`);
  }

  const operationDraft: Record<string, unknown> = {
    type: data.type,
    category,
    ...(data.bot_id ? { bot_id: data.bot_id } : {}),
    ...(data.project_id ? { project_id: data.project_id } : {}),
    ...(data.description ? { description: data.description } : {}),
    amount: Number(data.amount),
    currency: data.currency || 'USD',
    ...(data.gold_price_at_time !== null && data.gold_price_at_time !== undefined
      ? { gold_price_at_time: Number(data.gold_price_at_time) }
      : {}),
    ...(data.gold_amount !== undefined && data.gold_amount !== null
      ? { gold_amount: Number(data.gold_amount) }
      : {}),
    date: dateTimestamp,
    created_at: Date.now(),
  };

  const operation = financeOperationCreateSchema.parse(operationDraft);
  const response = await createFinanceOperationViaContract(operation);
  const id = String(response.data?.id || '').trim();
  if (!id) {
    throw new Error('Failed to generate operation ID');
  }
  return id;
}

export async function updateFinanceOperation(
  id: string,
  data: Partial<FinanceOperationFormData>,
): Promise<void> {
  const updates: Partial<FinanceOperation> = {
    updated_at: Date.now(),
  };

  if (data.type !== undefined) updates.type = data.type;
  if (data.category !== undefined) updates.category = data.category;
  if (data.bot_id !== undefined) updates.bot_id = data.bot_id || null;
  if (data.project_id !== undefined) updates.project_id = data.project_id || null;
  if (data.description !== undefined) updates.description = data.description;
  if (data.amount !== undefined) updates.amount = Number(data.amount);
  if (data.currency !== undefined) updates.currency = data.currency;
  if (data.gold_price_at_time !== undefined) updates.gold_price_at_time = data.gold_price_at_time;
  if (data.gold_amount !== undefined) updates.gold_amount = Number(data.gold_amount);
  if (data.date !== undefined) {
    const dateTimestamp = parseDateToTimestamp(data.date);
    if (!Number.isNaN(dateTimestamp)) {
      updates.date = dateTimestamp;
    }
  }

  const patchPayload = financeOperationPatchSchema.parse(updates);
  await patchFinanceOperationViaContract(String(id), patchPayload);
}

export async function deleteFinanceOperation(id: string): Promise<void> {
  await deleteFinanceOperationViaContract(String(id));
}

export async function getFinanceOperations(): Promise<FinanceOperation[]> {
  return fetchAllFinanceOperations();
}

export function calculateFinanceSummary(operations: FinanceOperation[]): FinanceSummary {
  const totalIncome = operations
    .filter((op) => op.type === 'income')
    .reduce((acc, op) => acc + op.amount, 0);

  const totalExpenses = operations
    .filter((op) => op.type === 'expense')
    .reduce((acc, op) => acc + op.amount, 0);

  const totalGoldSold = operations
    .filter((op) => op.type === 'income' && op.category === 'sale')
    .reduce((acc, op) => acc + (op.gold_amount || 0), 0);

  const goldSaleOperations = operations.filter(
    (op) => op.type === 'income' && op.category === 'sale' && op.gold_price_at_time,
  );

  const averageGoldPrice =
    goldSaleOperations.length > 0
      ? goldSaleOperations.reduce((acc, op) => acc + (op.gold_price_at_time || 0), 0) /
        goldSaleOperations.length
      : 0;

  return {
    totalIncome,
    totalExpenses,
    netProfit: totalIncome - totalExpenses,
    totalGoldSold,
    totalGoldFarmed: 0,
    averageGoldPrice,
  };
}

export function calculateCategoryBreakdown(
  operations: FinanceOperation[],
  type: FinanceOperationType,
): CategoryBreakdown[] {
  const filteredOps = operations.filter((op) => op.type === type);
  const total = filteredOps.reduce((acc, op) => acc + op.amount, 0);
  const categoryMap = new Map<string, number>();

  filteredOps.forEach((op) => {
    const current = categoryMap.get(op.category) || 0;
    categoryMap.set(op.category, current + op.amount);
  });

  return Array.from(categoryMap.entries())
    .map(([category, amount]) => ({
      category: category as FinanceCategory,
      amount,
      percentage: total > 0 ? Math.round((amount / total) * 100) : 0,
    }))
    .sort((a, b) => b.amount - a.amount);
}

export function prepareTimeSeriesData(
  operations: FinanceOperation[],
  startDate: number,
  endDate: number,
): TimeSeriesData[] {
  const grouped = new Map<string, { income: number; expense: number }>();

  const start = new Date(startDate);
  start.setHours(0, 0, 0, 0);
  const end = new Date(endDate);
  end.setHours(23, 59, 59, 999);

  const current = new Date(start);
  while (current <= end) {
    const dateStr = formatTimestampToDay(current.getTime());
    grouped.set(dateStr, { income: 0, expense: 0 });
    current.setDate(current.getDate() + 1);
  }

  operations.forEach((op) => {
    if (op.date < start.getTime() || op.date > end.getTime()) return;
    const dateStr = formatTimestampToDay(op.date);
    const currentData = grouped.get(dateStr);
    if (!currentData) return;
    if (op.type === 'income') {
      currentData.income += op.amount;
    } else {
      currentData.expense += op.amount;
    }
    grouped.set(dateStr, currentData);
  });

  const sortedData = Array.from(grouped.entries())
    .map(([date, data]) => ({
      date,
      income: data.income,
      expense: data.expense,
      dailyProfit: data.income - data.expense,
    }))
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  let runningTotal = 0;
  return sortedData.map((item) => {
    runningTotal += item.dailyProfit;
    return {
      ...item,
      profit: runningTotal,
      cumulativeProfit: runningTotal,
      dailyProfit: item.dailyProfit,
    };
  });
}

export function getGoldPriceHistoryFromOperations(
  operations: FinanceOperation[],
): GoldPriceHistoryEntry[] {
  const saleOperations = operations.filter(
    (op) =>
      op.type === 'income' && op.category === 'sale' && op.gold_price_at_time && op.project_id,
  );

  const grouped = new Map<string, GoldPriceHistoryEntry>();

  saleOperations.forEach((op) => {
    const dateStr = formatTimestampToDay(op.date);
    const key = `${dateStr}_${op.project_id}`;
    const existing = grouped.get(key);

    if (existing) {
      existing.price = (existing.price + (op.gold_price_at_time || 0)) / 2;
    } else {
      grouped.set(key, {
        date: dateStr,
        price: op.gold_price_at_time || 0,
        project_id: op.project_id as 'wow_tbc' | 'wow_midnight',
      });
    }
  });

  return Array.from(grouped.values()).sort(
    (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime(),
  );
}

export function filterOperations(
  operations: FinanceOperation[],
  filters: {
    type?: FinanceOperationType | 'all';
    category?: FinanceCategory | 'all';
    project_id?: string | 'all';
    dateFrom?: string | null;
    dateTo?: string | null;
  },
): FinanceOperation[] {
  return operations.filter((operation) => {
    if (filters.type && filters.type !== 'all' && operation.type !== filters.type) return false;
    if (filters.category && filters.category !== 'all' && operation.category !== filters.category) {
      return false;
    }
    if (
      filters.project_id &&
      filters.project_id !== 'all' &&
      operation.project_id !== filters.project_id
    ) {
      return false;
    }
    if (filters.dateFrom) {
      const fromTimestamp = parseDateToTimestamp(filters.dateFrom);
      if (operation.date < fromTimestamp) return false;
    }
    if (filters.dateTo) {
      const toTimestamp = parseDateToTimestamp(filters.dateTo);
      if (operation.date > toTimestamp) return false;
    }
    return true;
  });
}
