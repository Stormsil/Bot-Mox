import { z } from 'zod';
import { jsonValueSchema } from './schemasCommon.js';

export const botRecordSchema = z
  .object({
    id: z.string().min(1),
  })
  .passthrough();

export const botStatusSchema = z.enum([
  'offline',
  'prepare',
  'leveling',
  'profession',
  'farming',
  'banned',
]);

export const botLifecycleStageSchema = z.enum([
  'prepare',
  'leveling',
  'profession',
  'farming',
  'banned',
]);

export const botLifecycleTransitionItemSchema = z.object({
  from: z.enum(['prepare', 'leveling', 'profession', 'farming', 'create']),
  to: z.enum(['prepare', 'leveling', 'profession', 'farming']),
  timestamp: z.coerce.number().int().nonnegative(),
});

export const botBanMechanismSchema = z.enum([
  'battlenet_account_closure',
  'battlenet_account_suspension',
  'game_suspension',
  'hardware_ban',
  'ip_ban',
  'other',
]);

export const botBanDetailsSchema = z.object({
  ban_date: z
    .string()
    .trim()
    .regex(/^\d{2}\.\d{2}\.\d{4}$/, 'Expected DD.MM.YYYY format'),
  ban_reason: z.string().trim().min(1).max(1000),
  ban_mechanism: botBanMechanismSchema,
  unbanned_at: z.coerce.number().int().nonnegative().optional(),
  ban_timestamp: z.coerce.number().int().nonnegative().optional(),
});

export const botLifecycleSchema = z.object({
  current_stage: botLifecycleStageSchema,
  previous_status: botStatusSchema.optional(),
  stage_transitions: z.array(botLifecycleTransitionItemSchema),
  ban_details: botBanDetailsSchema.optional(),
});

export const botListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  q: z.string().trim().optional(),
});

export const botMutationSchema = z
  .record(jsonValueSchema)
  .refine(
    (payload) => Object.keys(payload || {}).length > 0,
    'Payload must contain at least one field',
  );

export const botDeleteResultSchema = z.object({
  id: z.string().min(1),
  deleted: z.boolean(),
});

export const botLifecycleTransitionSchema = z.object({
  status: botStatusSchema,
});

export const botLifecycleIsBannedSchema = z.object({
  banned: z.boolean(),
});

export const resourceKindSchema = z.enum(['licenses', 'proxies', 'subscriptions']);
export const resourceRecordSchema = z.record(jsonValueSchema);
export const resourceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  q: z.string().trim().optional(),
});

export const resourceMutationSchema = z
  .record(jsonValueSchema)
  .refine(
    (payload) => Object.keys(payload || {}).length > 0,
    'Payload must contain at least one field',
  );
export const resourceDeleteResultSchema = z.object({
  id: z.string().min(1),
  deleted: z.boolean(),
});
