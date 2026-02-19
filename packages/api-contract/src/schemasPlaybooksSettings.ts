import { z } from 'zod';
import { jsonValueSchema } from './schemasCommon.js';

export const playbookRecordSchema = z
  .object({
    id: z.string().min(1),
    tenant_id: z.string().trim().min(1).optional(),
    user_id: z.string().trim().min(1).optional(),
    name: z.string().trim().min(1),
    is_default: z.boolean().optional(),
    content: z.string(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const playbookCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  is_default: z.boolean().optional().default(false),
  content: z.string().min(1).max(65_536),
});

export const playbookUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  is_default: z.boolean().optional(),
  content: z.string().min(1).max(65_536).optional(),
});

export const playbookValidateBodySchema = z.object({
  content: z.string().trim().min(1),
});

export const playbookValidationIssueSchema = z.object({
  path: z.string().trim().optional(),
  message: z.string().trim().min(1),
});

export const playbookValidationWarningSchema = z.object({
  message: z.string().trim().min(1),
});

export const playbookValidationResultSchema = z.object({
  valid: z.boolean(),
  errors: z.array(playbookValidationIssueSchema),
  warnings: z.array(playbookValidationWarningSchema),
});

export const playbookDeleteResultSchema = z.object({
  deleted: z.boolean(),
});

export const settingsApiKeysSchema = z
  .object({
    ipqs: z
      .object({
        api_key: z.string().optional(),
        enabled: z.boolean().optional(),
      })
      .partial()
      .optional(),
    telegram: z
      .object({
        bot_token: z.string().optional(),
        chat_id: z.string().optional(),
        enabled: z.boolean().optional(),
      })
      .partial()
      .optional(),
  })
  .passthrough();

export const settingsApiKeysMutationSchema = settingsApiKeysSchema.refine(
  (payload) => Object.keys(payload || {}).length > 0,
  'API keys payload must not be empty',
);

export const settingsProxySchema = z
  .object({
    auto_check_on_add: z.boolean().optional(),
    fraud_score_threshold: z.coerce.number().int().min(0).max(100).optional(),
    check_interval_hours: z.coerce.number().int().min(0).max(168).optional(),
  })
  .passthrough();

export const settingsProxyMutationSchema = settingsProxySchema.refine(
  (payload) => Object.keys(payload || {}).length > 0,
  'Proxy settings payload must not be empty',
);

export const settingsNotificationEventsSchema = z
  .object({
    bot_banned: z.boolean().optional(),
    bot_offline: z.boolean().optional(),
    bot_online: z.boolean().optional(),
    level_up: z.boolean().optional(),
    profession_maxed: z.boolean().optional(),
    low_fraud_score: z.boolean().optional(),
    daily_report: z.boolean().optional(),
  })
  .passthrough();

export const settingsNotificationEventsMutationSchema = settingsNotificationEventsSchema.refine(
  (payload) => Object.keys(payload || {}).length > 0,
  'Notification events payload must not be empty',
);

export const themeAssetSchema = z.object({
  id: z.string().trim().min(1),
  object_key: z.string().trim().min(1),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.coerce.number().int().nonnegative(),
  width: z.coerce.number().int().min(1).max(8192).nullable().optional(),
  height: z.coerce.number().int().min(1).max(8192).nullable().optional(),
  status: z.enum(['pending', 'ready', 'failed', 'deleted']),
  image_url: z.union([z.string().trim().min(1), z.null()]).optional(),
  image_url_expires_at_ms: z.coerce.number().int().nonnegative().nullable().optional(),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
});

export const themeAssetsListSchema = z.object({
  generated_at_ms: z.coerce.number().int().nonnegative(),
  items: z.array(themeAssetSchema),
});

export const themeAssetPresignUploadSchema = z.object({
  filename: z.string().trim().min(1).max(255),
  mime_type: z.enum(['image/jpeg', 'image/png', 'image/webp']),
  size_bytes: z.coerce
    .number()
    .int()
    .min(1)
    .max(20 * 1024 * 1024),
});

export const themeAssetPresignUploadResponseSchema = z.object({
  asset_id: z.string().trim().min(1),
  object_key: z.string().trim().min(1),
  upload_url: z.string().trim().min(1),
  expires_at_ms: z.coerce.number().int().nonnegative(),
  expires_in_seconds: z.coerce.number().int().positive(),
});

export const themeAssetCompleteSchema = z.object({
  asset_id: z.string().trim().min(1),
  width: z.coerce.number().int().min(1).max(8192).optional(),
  height: z.coerce.number().int().min(1).max(8192).optional(),
});

export const themeAssetDeleteResultSchema = z.object({
  id: z.string().trim().min(1),
  status: z.literal('deleted'),
});

export const ipqsStatusSchema = z
  .object({
    enabled: z.boolean(),
    configured: z.boolean(),
    supabaseSettingsConnected: z.boolean(),
  })
  .passthrough();

export const ipqsCheckBodySchema = z.object({
  ip: z.string().trim().min(1),
});

export const ipqsCheckBatchBodySchema = z.object({
  ips: z.array(z.string().trim().min(1)).min(1).max(10),
});

export const ipqsCheckResponseSchema = z
  .object({
    success: z.boolean(),
    message: z.string().optional(),
    fraud_score: z.coerce.number().finite(),
    country_code: z.string().optional(),
    region: z.string().optional(),
    city: z.string().optional(),
    zip_code: z.string().optional(),
    isp: z.string().optional(),
    organization: z.string().optional(),
    timezone: z.string().optional(),
    latitude: z.coerce.number().finite().optional(),
    longitude: z.coerce.number().finite().optional(),
    vpn: z.boolean().optional(),
    proxy: z.boolean().optional(),
    tor: z.boolean().optional(),
    bot_status: z.boolean().optional(),
    bot: z.boolean().optional(),
  })
  .passthrough();

export const ipqsBatchResultSchema = z
  .object({
    ip: z.string().trim(),
    success: z.boolean(),
    data: ipqsCheckResponseSchema.optional(),
    error: z.string().optional(),
    details: jsonValueSchema.optional(),
  })
  .passthrough();

export const ipqsBatchResponseSchema = z.object({
  results: z.array(ipqsBatchResultSchema),
});

export const wowNamesQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(100).optional(),
  batches: z.coerce.number().int().min(1).max(20).optional(),
});

export const wowNamesResponseSchema = z
  .object({
    names: z.array(z.string()),
    random: z.string().optional(),
    source: z.string().optional(),
    batches: z.coerce.number().int().nonnegative().optional(),
  })
  .passthrough();
