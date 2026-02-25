import { financeOperationRecordSchema } from '@botmox/api-contract';
import type { FinanceCategory, FinanceOperation } from '../model/types';

type FinanceOperationsPageLike = { data?: unknown[] | null } | null | undefined;

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

export function mapFinanceOperationsFromInfinitePages(
  pages: readonly FinanceOperationsPageLike[] | null | undefined,
): FinanceOperation[] {
  if (!pages || pages.length === 0) {
    return [];
  }

  const byId = new Map<string, FinanceOperation>();

  for (const page of pages) {
    const items = Array.isArray(page?.data) ? page.data : [];
    for (const item of items) {
      const normalized = normalizeFinanceOperationRecord(item);
      if (!normalized) continue;
      if (byId.has(normalized.id)) continue;
      byId.set(normalized.id, normalized);
    }
  }

  return Array.from(byId.values()).sort((a, b) => b.date - a.date);
}
