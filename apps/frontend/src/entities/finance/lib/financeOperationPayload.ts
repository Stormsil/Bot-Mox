import { financeOperationCreateSchema, financeOperationPatchSchema } from '@botmox/api-contract';
import type { FinanceOperation, FinanceOperationFormData } from '../model/types';
import { parseDateToTimestamp } from './analyticsDate';

export type FinanceOperationCreatePayload = ReturnType<typeof financeOperationCreateSchema.parse>;
export type FinanceOperationPatchPayload = ReturnType<typeof financeOperationPatchSchema.parse>;

export function buildFinanceOperationCreatePayload(
  data: FinanceOperationFormData,
): FinanceOperationCreatePayload {
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

  const draft: Record<string, unknown> = {
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

  return financeOperationCreateSchema.parse(draft);
}

export function buildFinanceOperationPatchPayload(
  data: Partial<FinanceOperationFormData>,
): FinanceOperationPatchPayload {
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

  return financeOperationPatchSchema.parse(updates);
}
