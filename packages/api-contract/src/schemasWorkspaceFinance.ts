import { z } from 'zod';
import { jsonValueSchema } from './schemasCommon.js';

export const workspaceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  q: z.string().trim().optional(),
});

export const workspaceKindSchema = z.enum(['notes', 'calendar', 'kanban']);

export const workspaceNotesRecordSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough();

export const workspaceCalendarRecordSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    date: z.string().optional(),
    linked_note_id: z.union([z.string().min(1), z.null()]).optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

export const workspaceKanbanStatusSchema = z.enum(['todo', 'in_progress', 'done']);

export const workspaceKanbanRecordSchema = z
  .object({
    id: z.string().min(1),
    title: z.string().optional(),
    description: z.string().optional(),
    status: workspaceKanbanStatusSchema.optional(),
    due_date: z.union([z.string(), z.null()]).optional(),
    order: z.number().optional(),
    created_at: z.number().optional(),
    updated_at: z.number().optional(),
  })
  .passthrough();

export const workspaceCalendarMutationSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().optional(),
    description: z.string().optional(),
    date: z
      .string()
      .trim()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD format')
      .optional(),
    linked_note_id: z.union([z.string().trim().min(1), z.null()]).optional(),
    created_at: z.coerce.number().int().nonnegative().optional(),
    updated_at: z.coerce.number().int().nonnegative().optional(),
  })
  .passthrough()
  .refine(
    (payload) => Object.keys(payload || {}).length > 0,
    'Payload must contain at least one field',
  );

export const workspaceNotesMutationSchema = z
  .record(jsonValueSchema)
  .refine(
    (payload) => Object.keys(payload || {}).length > 0,
    'Payload must contain at least one field',
  );

export const workspaceKanbanMutationSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    title: z.string().trim().optional(),
    description: z.string().optional(),
    status: workspaceKanbanStatusSchema.optional(),
    due_date: z
      .union([
        z
          .string()
          .trim()
          .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD format'),
        z.null(),
      ])
      .optional(),
    order: z.coerce.number().int().optional(),
    created_at: z.coerce.number().int().nonnegative().optional(),
    updated_at: z.coerce.number().int().nonnegative().optional(),
  })
  .passthrough()
  .refine(
    (payload) => Object.keys(payload || {}).length > 0,
    'Payload must contain at least one field',
  );

export const workspaceDeleteResultSchema = z.object({
  id: z.string().min(1),
  deleted: z.boolean(),
});

export const financeListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  q: z.string().trim().optional(),
});

export const financeOperationRecordSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum(['income', 'expense']).optional(),
    category: z.string().trim().min(1).optional(),
    amount: z.coerce.number().finite().optional(),
    currency: z.string().trim().min(1).optional(),
    date: z.coerce.number().int().nonnegative().optional(),
    description: z.string().optional(),
    bot_id: z.union([z.string().trim(), z.null()]).optional(),
    project_id: z.union([z.string().trim(), z.null()]).optional(),
    gold_amount: z.union([z.coerce.number().finite(), z.null()]).optional(),
    gold_price_at_time: z.union([z.coerce.number().finite(), z.null()]).optional(),
    updated_at: z.coerce.number().int().nonnegative().optional(),
    created_at: z.coerce.number().int().nonnegative().optional(),
  })
  .passthrough();

export const financeOperationCreateSchema = z
  .object({
    id: z.string().trim().min(1).optional(),
    type: z.enum(['income', 'expense']),
    category: z.string().trim().min(1),
    amount: z.coerce.number().finite(),
    currency: z.string().trim().min(1),
    date: z.coerce.number().int().nonnegative(),
    description: z.string().trim().max(1000).optional(),
    bot_id: z.union([z.string().trim(), z.null()]).optional(),
    project_id: z.union([z.string().trim(), z.null()]).optional(),
    gold_amount: z.union([z.coerce.number().finite(), z.null()]).optional(),
    gold_price_at_time: z.union([z.coerce.number().finite(), z.null()]).optional(),
    updated_at: z.coerce.number().int().nonnegative().optional(),
    created_at: z.coerce.number().int().nonnegative().optional(),
  })
  .passthrough();

export const financeOperationPatchSchema = financeOperationCreateSchema
  .partial()
  .refine(
    (payload) => Object.keys(payload || {}).length > 0,
    'Finance operation patch must not be empty',
  );

export const financeDeleteResultSchema = z.object({
  id: z.string().min(1),
  deleted: z.boolean(),
});

export const financeDailyStatsEntrySchema = z
  .object({
    date: z.string().optional(),
    total_expenses: z.coerce.number().finite().optional(),
    total_revenue: z.coerce.number().finite().optional(),
    net_profit: z.coerce.number().finite().optional(),
    active_bots: z.coerce.number().int().optional(),
    total_farmed: z.record(jsonValueSchema).optional(),
  })
  .passthrough();

export const financeDailyStatsSchema = z.record(financeDailyStatsEntrySchema);

export const financeGoldPriceHistoryEntrySchema = z
  .object({
    price: z.coerce.number().finite(),
  })
  .passthrough();

export const financeGoldPriceHistorySchema = z.record(financeGoldPriceHistoryEntrySchema);
