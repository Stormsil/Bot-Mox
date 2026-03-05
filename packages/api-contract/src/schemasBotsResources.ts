import { z } from 'zod';
import { jsonValueSchema } from './schemasCommon.js';

export const botRecordSchema = z
  .object({
    id: z.string().min(1),
    computed_status: z.string().trim().min(1),
    days_remaining: z.coerce.number().int().nullable(),
    is_expiring_soon: z.boolean(),
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
export const resourceComputedStatusSchema = z.enum([
  'active',
  'expiring',
  'expiring_soon',
  'expired',
  'banned',
]);

// Thin-client migration source-of-truth: frontend business status consumes backend computed fields.
export const resourceStatusVocabularySchema = z.object({
  computed_status: resourceComputedStatusSchema,
  status: z.string().trim().min(1).optional(),
  days_remaining: z.coerce.number().int().nullable(),
  is_expiring_soon: z.boolean(),
});

export const resourceRecordSchema = z.record(jsonValueSchema).and(resourceStatusVocabularySchema);
export const resourceListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  sort: z.string().min(1).optional(),
  order: z.enum(['asc', 'desc']).optional(),
  q: z.string().trim().optional(),
  status: z.string().trim().min(1).optional(),
  type: z.string().trim().min(1).optional(),
  country: z.string().trim().min(1).optional(),
  country_code: z.string().trim().min(1).optional(),
  bot_id: z.string().trim().min(1).optional(),
});

export const resourceMutationSchema = z
  .record(jsonValueSchema)
  .refine(
    (payload) => Object.keys(payload || {}).length > 0,
    'Payload must contain at least one field',
  );

export const proxyTypeSchema = z.enum(['http', 'socks5']);
export const proxyStatusSchema = z.enum(['active', 'expired', 'banned']);

export const proxyResourceCreateSchema = z.object({
  ip: z.string().trim().min(1),
  port: z.coerce.number().int().min(1).max(65535),
  login: z.string().trim().min(1),
  password: z.string().min(1),
  provider: z.string().trim().min(1),
  country: z.string().trim().min(1),
  country_code: z.string().trim().optional(),
  type: proxyTypeSchema,
  status: proxyStatusSchema,
  bot_id: z.union([z.string().trim().min(1), z.null()]),
  fraud_score: z.coerce.number().finite(),
  vpn: z.boolean().optional(),
  proxy: z.boolean().optional(),
  tor: z.boolean().optional(),
  bot_status: z.boolean().optional(),
  isp: z.string().optional(),
  organization: z.string().optional(),
  city: z.string().optional(),
  region: z.string().optional(),
  zip_code: z.string().optional(),
  timezone: z.string().optional(),
  latitude: z.coerce.number().finite().optional(),
  longitude: z.coerce.number().finite().optional(),
  expires_at: z.coerce.number().int().nonnegative(),
  created_at: z.coerce.number().int().nonnegative(),
  updated_at: z.coerce.number().int().nonnegative(),
  last_checked: z.coerce.number().int().nonnegative().optional(),
});

export const proxyResourceUpdateSchema = proxyResourceCreateSchema
  .partial()
  .refine(
    (payload) => Object.keys(payload || {}).length > 0,
    'Proxy update payload must not be empty',
  );
export const resourceDeleteResultSchema = z.object({
  id: z.string().min(1),
  deleted: z.boolean(),
});

export const resourceStatusProjectionSchema = z.object({
  status: z.enum(['none', 'active', 'expiring', 'expired', 'banned']),
  label: z.string().trim().min(1),
  color: z.enum(['default', 'success', 'warning', 'error']),
  sort: z.coerce.number().int(),
  days_remaining: z.coerce.number().int().optional(),
});

export const resourcesStatusAggregateSchema = z.object({
  generated_at: z.coerce.number().int().nonnegative(),
  summary: z.object({
    licenses: z.object({
      total: z.coerce.number().int().nonnegative(),
      active: z.coerce.number().int().nonnegative(),
      expiring_soon: z.coerce.number().int().nonnegative(),
      expired: z.coerce.number().int().nonnegative(),
      unassigned: z.coerce.number().int().nonnegative(),
    }),
    proxies: z.object({
      total: z.coerce.number().int().nonnegative(),
      active: z.coerce.number().int().nonnegative(),
      expiring_soon: z.coerce.number().int().nonnegative(),
      expired: z.coerce.number().int().nonnegative(),
      unassigned: z.coerce.number().int().nonnegative(),
    }),
    subscriptions: z.object({
      total: z.coerce.number().int().nonnegative(),
      active: z.coerce.number().int().nonnegative(),
      expiring_soon: z.coerce.number().int().nonnegative(),
      expired: z.coerce.number().int().nonnegative(),
    }),
  }),
  expiring_items: z.array(
    z.object({
      id: z.string().trim().min(1),
      type: z.enum(['license', 'proxy', 'subscription']),
      name: z.string().trim().min(1),
      bot_id: z.string().trim().min(1).optional(),
      days_remaining: z.coerce.number().int().nonnegative(),
      expires_at: z.coerce.number().int().nonnegative().optional(),
    }),
  ),
  by_bot: z.record(
    z.object({
      license_status: resourceStatusProjectionSchema,
      proxy_status: resourceStatusProjectionSchema,
      subscription_status: resourceStatusProjectionSchema,
      subscriptions_summary: z.object({
        total: z.coerce.number().int().nonnegative(),
        active_count: z.coerce.number().int().nonnegative(),
        next_expiry_days_remaining: z.coerce.number().int().optional(),
        next_expiry_at: z.coerce.number().int().optional(),
      }),
    }),
  ),
});
