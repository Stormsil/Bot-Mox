import { z } from 'zod';

const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(jsonValueSchema),
    z.record(jsonValueSchema),
  ]),
);

export const jsonRecordSchema = z.record(jsonValueSchema);

export const authHeaderSchema = z.object({
  authorization: z.string().min(1),
});

export const successEnvelopeSchema = <TData extends z.ZodTypeAny>(dataSchema: TData) =>
  z.object({
    success: z.literal(true),
    data: dataSchema,
    meta: z.record(jsonValueSchema).optional(),
  });

export const errorEnvelopeSchema = z.object({
  success: z.literal(false),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: jsonValueSchema.optional(),
  }),
});

export const diagnosticsTraceResponseSchema = z.object({
  timestamp: z.string().trim().min(1),
  node_env: z.string().trim().min(1),
  received: z.object({
    traceparent: z.union([z.string().trim(), z.null()]).optional(),
    tracestate: z.union([z.string().trim(), z.null()]).optional(),
    baggage: z.union([z.string().trim(), z.null()]).optional(),
    correlation_id: z.union([z.string().trim(), z.null()]).optional(),
  }),
  active: z.object({
    trace_id: z.union([z.string().trim(), z.null()]),
    span_id: z.union([z.string().trim(), z.null()]),
  }),
  response_headers: z.object({
    x_trace_id: z.union([z.string().trim(), z.null()]).optional(),
    x_span_id: z.union([z.string().trim(), z.null()]).optional(),
    x_correlation_id: z.union([z.string().trim(), z.null()]).optional(),
  }),
});

export const clientLogErrorSchema = z
  .object({
    name: z.string().trim().max(128).optional(),
    code: z.string().trim().max(128).optional(),
    message: z.string().trim().max(1000).optional(),
    stack: z.string().trim().max(4000).optional(),
  })
  .partial();

export const clientLogEventSchema = z.object({
  ts: z.string().trim().min(1).max(64).optional(),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional().default('error'),
  event: z.string().trim().min(1).max(200),
  message: z.string().trim().min(1).max(1000),
  module: z.string().trim().min(1).max(200).optional(),
  path: z.string().trim().max(200).optional(),
  trace_id: z.union([z.string().trim(), z.null()]).optional(),
  span_id: z.union([z.string().trim(), z.null()]).optional(),
  correlation_id: z.union([z.string().trim(), z.null()]).optional(),
  error: clientLogErrorSchema.optional(),
  extra: z.record(jsonValueSchema).optional(),
});

export const clientLogsIngestSchema = z.object({
  events: z.array(clientLogEventSchema).min(1).max(20),
});

export const clientLogsIngestResultSchema = z.object({
  accepted: z.coerce.number().int().min(0),
  dropped: z.coerce.number().int().min(0),
});

export const healthSummarySchema = z.object({
  service: z.string(),
  timestamp: z.string(),
  data_backend: z.string(),
  supabase_ready: z.boolean().optional(),
  s3_ready: z.boolean().optional(),
  supabase_configured: z.boolean().optional(),
  s3_configured: z.boolean().optional(),
});

export const healthLiveSchema = z.object({
  service: z.string(),
  timestamp: z.string(),
  status: z.literal('live'),
});

export const healthReadySchema = z.object({
  status: z.enum(['ready', 'not-ready']),
  ready: z.boolean(),
  checks: z.record(jsonValueSchema),
  timestamp: z.string(),
});

export const authIdentitySchema = z.object({
  uid: z.string(),
  email: z.string().email().or(z.string().min(1)),
  roles: z.array(z.string()),
});

export const authVerifyResponseSchema = successEnvelopeSchema(
  z.object({
    valid: z.boolean(),
  }),
);

export const authWhoAmIResponseSchema = successEnvelopeSchema(authIdentitySchema);

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

export const agentStatusSchema = z
  .enum(['online', 'offline', 'degraded', 'pairing'])
  .or(z.string().min(1));

export const agentRecordSchema = z.object({
  id: z.string(),
  tenant_id: z.string().optional(),
  name: z.string().optional(),
  status: agentStatusSchema.optional(),
  last_seen_at: z.string().optional().nullable(),
  metadata: z.record(jsonValueSchema).optional(),
});

export const agentListQuerySchema = z.object({
  status: z.enum(['pending', 'active', 'offline', 'revoked']).optional(),
});

export const agentPairingCreateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  expires_in_minutes: z.coerce.number().int().min(5).max(1_440).optional(),
});

export const agentHeartbeatSchema = z.object({
  agent_id: z.string().trim().min(1),
  status: z.string().trim().min(1).default('active'),
  metadata: z.record(jsonValueSchema).optional(),
});

export const agentPairingRecordSchema = z
  .object({
    id: z.string(),
    tenant_id: z.string().optional(),
    name: z.string().optional(),
    status: z.string().optional(),
    pairing_code: z.string().optional(),
    pairing_expires_at: z.string().optional(),
    pairing_bundle: z.string().optional(),
    pairing_uri: z.string().optional(),
    pairing_url: z.string().optional(),
    server_url: z.string().optional(),
  })
  .passthrough();

export const vmOpsActionSchema = z
  .enum(['start', 'stop', 'restart', 'status'])
  .or(z.string().min(1));

export const vmOpsTargetSchema = z.enum(['proxmox', 'syncthing']);

export const vmOpsDispatchBodySchema = z.object({
  agent_id: z.string().trim().min(1).max(200),
  params: z.record(jsonValueSchema).optional(),
});

export const vmOpsCommandNextQuerySchema = z.object({
  agent_id: z.string().trim().min(1).max(200),
  timeout_ms: z.coerce.number().int().min(1_000).max(60_000).optional(),
});

export const vmOpsCommandCreateSchema = z.object({
  agent_id: z.string().trim().min(1).max(200),
  command_type: z.string().trim().min(1).max(200),
  payload: z.record(jsonValueSchema).optional().default({}),
  expires_in_seconds: z.coerce.number().int().min(10).max(3_600).optional().default(300),
});

export const vmOpsCommandListQuerySchema = z.object({
  agent_id: z.string().trim().min(1).max(200).optional(),
  status: z.string().trim().min(1).max(100).optional(),
});

export const vmOpsCommandStatusSchema = z.enum([
  'queued',
  'dispatched',
  'running',
  'succeeded',
  'failed',
  'expired',
  'cancelled',
]);

export const vmOpsCommandSchema = z.object({
  id: z.string(),
  tenant_id: z.string().optional(),
  agent_id: z.string().optional(),
  command_type: z.string(),
  status: vmOpsCommandStatusSchema,
  payload: z.record(jsonValueSchema).optional(),
  result: jsonValueSchema.optional().nullable(),
  error_message: z.string().optional().nullable(),
  queued_at: z.string().optional(),
  expires_at: z.string().optional().nullable(),
  started_at: z.string().optional().nullable(),
  completed_at: z.string().optional().nullable(),
  created_by: z.string().optional().nullable(),
});

export const vmOpsCommandUpdateSchema = z.object({
  status: z.enum(['running', 'succeeded', 'failed']),
  result: jsonValueSchema.optional(),
  error_message: z.string().trim().max(2_000).optional(),
});

const vmUuidSchema = z
  .string()
  .trim()
  .min(8)
  .max(128)
  .regex(/^[A-Za-z0-9:_-]+$/);

export const vmRegisterSchema = z.object({
  vm_uuid: vmUuidSchema,
  user_id: z.string().trim().min(1).max(200).optional(),
  vm_name: z.string().trim().max(200).optional(),
  project_id: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'paused', 'revoked']).optional(),
  metadata: z.record(jsonValueSchema).optional(),
});

export const vmResolvePathSchema = z.object({
  uuid: z.string().trim().min(1),
});

export const vmRecordSchema = z
  .object({
    tenant_id: z.string().trim().min(1),
    vm_uuid: vmUuidSchema,
    user_id: z.string().trim().min(1),
    vm_name: z.string().trim().optional(),
    project_id: z.string().trim().optional(),
    status: z.string().trim().min(1),
    metadata: z.record(jsonValueSchema).optional(),
    created_at: z.coerce.number().int().nonnegative(),
    updated_at: z.coerce.number().int().nonnegative(),
  })
  .passthrough();

export const artifactReleaseStatusSchema = z.enum(['draft', 'active', 'disabled', 'archived']);

export const artifactReleaseCreateSchema = z.object({
  module: z.string().trim().min(1).max(200),
  platform: z.string().trim().min(1).max(100),
  channel: z.string().trim().min(1).max(100).optional().default('stable'),
  version: z.string().trim().min(1).max(100),
  object_key: z.string().trim().min(1).max(1_024),
  sha256: z
    .string()
    .trim()
    .regex(/^[a-fA-F0-9]{64}$/),
  size_bytes: z.coerce.number().int().positive(),
  status: artifactReleaseStatusSchema.optional().default('active'),
});

export const artifactReleaseRecordSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    tenant_id: z.string().trim().min(1),
    module: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    channel: z.string().trim().min(1),
    version: z.string().trim().min(1),
    object_key: z.string().trim().min(1),
    sha256: z.string().trim().min(1),
    size_bytes: z.coerce.number().int().positive(),
    status: artifactReleaseStatusSchema,
  })
  .passthrough();

export const artifactAssignSchema = z.object({
  user_id: z.string().trim().min(1).max(200).optional(),
  module: z.string().trim().min(1).max(200),
  platform: z.string().trim().min(1).max(100),
  channel: z.string().trim().min(1).max(100).optional().default('stable'),
  release_id: z.coerce.number().int().positive(),
});

export const artifactAssignmentPathSchema = z.object({
  userId: z.string().trim().min(1).max(200),
  module: z.string().trim().min(1).max(200),
});

export const artifactAssignmentQuerySchema = z.object({
  platform: z.preprocess((value) => {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  }, z.string().trim().min(1).max(100).optional().default('windows')),
  channel: z.preprocess((value) => {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  }, z.string().trim().min(1).max(100).optional().default('stable')),
});

export const artifactAssignmentRecordSchema = z
  .object({
    id: z.coerce.number().int().positive(),
    tenant_id: z.string().trim().min(1),
    module: z.string().trim().min(1),
    platform: z.string().trim().min(1),
    channel: z.string().trim().min(1),
    user_id: z.string().trim().min(1).nullable().optional(),
    release_id: z.coerce.number().int().positive(),
    is_default: z.boolean().optional(),
  })
  .passthrough();

export const artifactEffectiveAssignmentSchema = z.object({
  user_assignment: z.union([artifactAssignmentRecordSchema, z.null()]).optional(),
  default_assignment: z.union([artifactAssignmentRecordSchema, z.null()]).optional(),
  effective_assignment: z.union([artifactAssignmentRecordSchema, z.null()]).optional(),
});

export const artifactResolveDownloadSchema = z.object({
  lease_token: z.string().trim().min(1),
  vm_uuid: vmUuidSchema,
  module: z.string().trim().min(1).max(200),
  platform: z.string().trim().min(1).max(100),
  channel: z.string().trim().min(1).max(100).optional().default('stable'),
});

export const artifactDownloadResolutionSchema = z.object({
  download_url: z.string().trim().min(1),
  url_expires_at: z.coerce.number().int().positive(),
  release_id: z.coerce.number().int().positive(),
  version: z.string().trim().min(1),
  sha256: z.string().trim().min(1),
  size_bytes: z.coerce.number().int().positive(),
});

export const secretScopeTypeSchema = z.enum(['bot', 'vm', 'agent', 'tenant']);

export const secretCreateSchema = z.object({
  label: z.string().trim().min(1).max(200),
  ciphertext: z.string().trim().min(1),
  alg: z.string().trim().min(1).max(50).optional().default('AES-256-GCM'),
  key_id: z.string().trim().min(1).max(200),
  nonce: z.string().trim().min(1).max(200),
  aad_meta: z.record(jsonValueSchema).optional().default({}),
});

export const secretRotateSchema = z.object({
  ciphertext: z.string().trim().min(1),
  alg: z.string().trim().min(1).max(50).optional(),
  key_id: z.string().trim().min(1).max(200),
  nonce: z.string().trim().min(1).max(200),
  aad_meta: z.record(jsonValueSchema).optional(),
});

export const secretBindingCreateSchema = z.object({
  scope_type: secretScopeTypeSchema,
  scope_id: z.string().trim().min(1).max(200),
  secret_ref: z.string().trim().min(1).max(200),
  field_name: z.string().trim().min(1).max(200),
});

export const secretBindingsListQuerySchema = z.object({
  scope_type: secretScopeTypeSchema.optional(),
  scope_id: z.preprocess((value) => {
    const normalized = String(value ?? '').trim();
    return normalized.length > 0 ? normalized : undefined;
  }, z.string().trim().min(1).max(200).optional()),
});

export const secretMetaRecordSchema = z
  .object({
    id: z.string().trim().min(1),
    tenant_id: z.string().trim().min(1),
    label: z.string().trim().min(1),
    alg: z.string().trim().min(1),
    key_id: z.string().trim().min(1),
    aad_meta: z.record(jsonValueSchema).optional(),
    rotated_at: z.union([z.string().trim(), z.null()]).optional(),
    created_at: z.string().trim().optional(),
    updated_at: z.string().trim().optional(),
  })
  .passthrough();

export const secretBindingRecordSchema = z
  .object({
    id: z.string().trim().min(1),
    tenant_id: z.string().trim().min(1),
    scope_type: secretScopeTypeSchema,
    scope_id: z.string().trim().min(1),
    secret_ref: z.string().trim().min(1),
    field_name: z.string().trim().min(1),
    created_at: z.string().trim().optional(),
    updated_at: z.string().trim().optional(),
  })
  .passthrough();

const optionalBooleanFlagSchema = z.preprocess((value) => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  if (typeof value === 'boolean') {
    return value;
  }
  const normalized = String(value).trim().toLowerCase();
  if (['1', 'true', 'yes', 'on'].includes(normalized)) {
    return true;
  }
  if (['0', 'false', 'no', 'off'].includes(normalized)) {
    return false;
  }
  return value;
}, z.boolean().optional());

export const infraNodePathSchema = z.object({
  node: z.string().trim().min(1),
});

export const infraNodeVmidPathSchema = z.object({
  node: z.string().trim().min(1),
  vmid: z.string().trim().min(1),
});

export const infraTaskStatusPathSchema = z.object({
  node: z.string().trim().min(1),
  upid: z.string().trim().min(1),
});

export const infraVmActionPathSchema = z.object({
  node: z.string().trim().min(1),
  vmid: z.string().trim().min(1),
  action: z.string().trim().min(1),
});

export const infraDeleteVmQuerySchema = z.object({
  purge: optionalBooleanFlagSchema,
  'destroy-unreferenced-disks': optionalBooleanFlagSchema,
});

export const infraSendKeyBodySchema = z.object({
  key: z.string().trim().min(1),
});

export const infraSshVmConfigPathSchema = z.object({
  vmid: z.string().trim().min(1),
});

export const infraCloneRequestSchema = z
  .object({
    newid: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).optional(),
    storage: z.string().trim().min(1).optional(),
    format: z.string().trim().min(1).optional(),
    full: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  })
  .passthrough();

export const infraVmConfigUpdateSchema = z
  .record(jsonValueSchema)
  .refine(
    (payload) => Object.keys(payload || {}).length > 0,
    'Payload must contain at least one field',
  );

export const infraUpidResponseSchema = z.object({
  upid: z.union([z.string().trim(), z.null()]),
});

export const infraConnectionStatusSchema = z.object({
  connected: z.boolean(),
  version: jsonValueSchema.optional(),
});

export const infraSshExecSchema = z.object({
  command: z.string().trim().min(1),
  timeout: z.coerce.number().int().min(1_000).max(120_000).optional(),
});

export const infraSshExecResultSchema = z.object({
  stdout: z.string(),
  stderr: z.string(),
  exitCode: z.coerce.number().int(),
  allowlisted: z.boolean().optional(),
});

export const infraVmConfigWriteSchema = z.object({
  content: z.string().min(1),
});

export const infraVmConfigReadResultSchema = z.object({
  config: z.string(),
});

export const infraVmConfigWriteResultSchema = z.object({
  written: z.boolean(),
});

export const licenseLeaseRequestSchema = z.object({
  vm_uuid: z
    .string()
    .trim()
    .min(8)
    .max(128)
    .regex(/^[A-Za-z0-9:_-]+$/),
  user_id: z.string().trim().min(1).max(200).optional(),
  agent_id: z.string().trim().min(1).max(200),
  runner_id: z.string().trim().min(1).max(200),
  module: z.string().trim().min(1).max(200),
  version: z.string().trim().max(100).optional(),
});

export const licenseLeaseResponseSchema = z.object({
  lease_id: z.string().trim().min(1).max(200),
  token: z.string().trim().min(1),
  expires_at: z.coerce.number().int().positive(),
  tenant_id: z.string().trim().min(1),
  user_id: z.string().trim().min(1),
  vm_uuid: z.string().trim().min(8).max(128),
  module: z.string().trim().min(1).max(200),
});

export const licenseHeartbeatSchema = z.object({
  lease_id: z.string().trim().min(1).max(200),
});

export const licenseHeartbeatResponseSchema = z.object({
  lease_id: z.string().trim().min(1).max(200),
  status: z.literal('active'),
  expires_at: z.coerce.number().int().positive(),
  last_heartbeat_at: z.coerce.number().int().positive(),
});

export const licenseRevokeSchema = z.object({
  lease_id: z.string().trim().min(1).max(200),
  reason: z.string().trim().max(500).optional(),
});

export const licenseRevokeResponseSchema = z.object({
  lease_id: z.string().trim().min(1).max(200),
  status: z.literal('revoked'),
  revoked_at: z.coerce.number().int().positive(),
});

const keyboardLayoutPairSchema = z.object({
  language: z.string().trim().min(1),
  layout: z.string().trim().min(1),
});

export const unattendProfileConfigSchema = z
  .object({
    user: z.object({
      nameMode: z.enum(['random', 'fixed', 'custom']),
      customName: z.string().trim().max(200).optional(),
      customNameSuffix: z.enum(['none', 'random_digits', 'sequential']).optional().default('none'),
      displayName: z.string().trim().max(200).optional(),
      password: z.string().max(200).default('1204'),
      group: z.enum(['Administrators', 'Users']).default('Administrators'),
      autoLogonCount: z.coerce.number().int().min(0).default(9_999_999),
    }),
    computerName: z.object({
      mode: z.enum(['random', 'fixed', 'custom']),
      customName: z.string().trim().max(15).optional(),
    }),
    locale: z.object({
      uiLanguage: z.string().trim().default('en-US'),
      inputLocales: z.array(z.string().trim()).optional(),
      keyboardLayouts: z.array(keyboardLayoutPairSchema).optional(),
      timeZone: z.string().trim().default('Turkey Standard Time'),
      geoLocation: z.coerce.number().int().default(235),
    }),
    softwareRemoval: z.object({
      mode: z.enum(['fixed', 'random', 'mixed', 'fixed_random']),
      fixedPackages: z.array(z.string().trim()).default([]),
      randomPool: z.array(z.string().trim()).default([]),
      neverRemove: z.array(z.string().trim()).optional().default([]),
      randomCount: z
        .object({
          min: z.coerce.number().int().min(0).default(5),
          max: z.coerce.number().int().min(0).default(15),
        })
        .optional(),
    }),
    capabilityRemoval: z.object({
      mode: z.enum(['fixed', 'random', 'mixed', 'fixed_random']),
      fixedCapabilities: z.array(z.string().trim()).default([]),
      randomPool: z.array(z.string().trim()).default([]),
    }),
    windowsSettings: z.object({
      disableDefender: z.boolean().default(true),
      disableWindowsUpdate: z.boolean().default(true),
      disableUac: z.boolean().default(true),
      disableSmartScreen: z.boolean().default(true),
      disableSystemRestore: z.boolean().default(true),
      enableLongPaths: z.boolean().default(true),
      allowPowerShellScripts: z.boolean().default(true),
      disableWidgets: z.boolean().default(true),
      disableEdgeStartup: z.boolean().default(true),
      preventDeviceEncryption: z.boolean().default(true),
      disableStickyKeys: z.boolean().default(true),
      enableRemoteDesktop: z.boolean().optional().default(false),
    }),
    visualEffects: z.object({
      mode: z
        .enum([
          'default',
          'appearance',
          'performance',
          'custom',
          'custom_randomize',
          'balanced',
          'random',
        ])
        .default('performance'),
      effects: z.record(z.boolean()).optional().default({}),
      cursorShadow: z.boolean().optional(),
      fontSmoothing: z.boolean().optional(),
    }),
    desktopIcons: z.object({
      mode: z.enum(['default', 'custom', 'custom_randomize']).optional().default('default'),
      icons: z.record(z.boolean()).optional().default({}),
      startFolders: z.record(z.boolean()).optional().default({}),
      deleteEdgeShortcut: z.boolean().optional().default(true),
      recycleBin: z.boolean().optional(),
      thisPC: z.boolean().optional(),
    }),
    customScript: z
      .object({
        executable: z.string().trim().default('START.exe'),
        delaySeconds: z.coerce.number().int().min(0).max(600).default(20),
      })
      .optional(),
  })
  .passthrough();

export const unattendProfileRecordSchema = z
  .object({
    id: z.string().trim().min(1),
    name: z.string().trim().min(1).max(200),
    is_default: z.boolean().optional(),
    config: unattendProfileConfigSchema.optional(),
    created_at: z.string().optional(),
    updated_at: z.string().optional(),
  })
  .passthrough();

export const unattendProfileCreateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  is_default: z.boolean().optional().default(false),
  config: unattendProfileConfigSchema,
});

export const unattendProfileUpdateSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  is_default: z.boolean().optional(),
  config: unattendProfileConfigSchema.optional(),
});

export const unattendProfilePathSchema = z.object({
  id: z.string().trim().min(1),
});

export const provisioningGenerateIsoPayloadSchema = z.object({
  profile_id: z.string().trim().min(1).optional(),
  profile_config: unattendProfileConfigSchema.optional(),
  playbook_id: z.string().trim().min(1).optional(),
  vm_uuid: z.string().trim().min(1),
  ip: z.object({
    address: z.string().trim().min(1),
    netmask: z.string().trim().default('255.255.255.0'),
    gateway: z.string().trim().min(1),
    dns: z.array(z.string().trim()).default(['8.8.8.8']),
  }),
  vm_name: z.string().trim().max(200).optional(),
});

export const provisioningGenerateIsoPayloadResponseSchema = z
  .object({
    files: z.record(z.string().trim().min(1)),
    token: z.string().trim().min(1),
    tokenId: z.string().trim().min(1),
    expiresAt: z.string().trim().min(1),
    computerName: z.string().trim().min(1),
    username: z.string().trim().min(1),
    vmUuid: z.string().trim().min(1),
    playbookId: z.union([z.string().trim().min(1), z.null()]).optional(),
  })
  .passthrough();

export const unattendProfileDeleteResponseSchema = z.object({
  deleted: z.boolean(),
});

export const provisioningValidateTokenSchema = z.object({
  token: z.string().trim().min(1),
  vm_uuid: z.string().trim().min(1),
});

export const provisioningReportProgressSchema = z.object({
  token: z.string().trim().min(1),
  vm_uuid: z.string().trim().min(1),
  step: z.string().trim().min(1).max(200),
  status: z.enum(['pending', 'running', 'completed', 'failed']),
  details: z.record(jsonValueSchema).optional().default({}),
});

export const provisioningProgressPathSchema = z.object({
  vmUuid: z.string().trim().min(1),
});

export const provisioningValidateTokenResponseSchema = z.object({
  valid: z.literal(true),
  userId: z.string().trim().min(1),
  tenantId: z.string().trim().min(1),
  bootstrap_url: z.union([z.string().trim(), z.null()]).optional(),
  app_url: z.union([z.string().trim(), z.null()]).optional(),
});

export const provisioningReportProgressResponseSchema = z
  .object({
    vm_uuid: z.string().trim().min(1),
    step: z.string().trim().min(1).max(200),
    status: z.enum(['pending', 'running', 'completed', 'failed']),
    details: z.record(jsonValueSchema).optional(),
    updated_at: z.string().trim().min(1),
  })
  .passthrough();

export const provisioningProgressResponseSchema = z
  .object({
    vm_uuid: z.string().trim().min(1),
    events: z.array(provisioningReportProgressResponseSchema),
    updated_at: z.string().trim().min(1),
  })
  .passthrough();
