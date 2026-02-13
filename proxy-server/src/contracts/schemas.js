const { z } = require('zod');

const BOT_STATUSES = ['offline', 'prepare', 'leveling', 'profession', 'farming', 'banned'];
const RESOURCE_KINDS = ['licenses', 'proxies', 'subscriptions'];
const WORKSPACE_KINDS = ['notes', 'calendar', 'kanban'];
const PROJECT_IDS = ['wow_tbc', 'wow_midnight'];
const STORAGE_OPERATIONAL_MODES = ['local', 'cloud'];
const ARTIFACT_RELEASE_STATUSES = ['draft', 'active', 'disabled', 'archived'];

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TIME_24H_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

const requireNonEmpty = (schema, message) =>
  schema.refine((value) => Object.keys(value || {}).length > 0, message);

const nonEmptyObjectSchema = requireNonEmpty(
  z.object({}).passthrough(),
  'Payload must contain at least one field'
);

const timestampSchema = z.coerce.number().int().nonnegative();
const stringIdSchema = z.string().trim().min(1);

const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  sort: z.string().trim().min(1).optional(),
  order: z.enum(['asc', 'desc']).optional().default('asc'),
  q: z.string().trim().optional(),
});

const idParamSchema = z.object({
  id: stringIdSchema,
});

const vmResolveParamSchema = z.object({
  uuid: stringIdSchema,
});

const resourceKindParamSchema = z.object({
  kind: z.enum(RESOURCE_KINDS),
});

const workspaceKindParamSchema = z.object({
  kind: z.enum(WORKSPACE_KINDS),
});

const characterSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    level: z.coerce.number().int().min(1).max(100).optional(),
    class: z.string().trim().min(1).optional(),
    race: z.string().trim().min(1).optional(),
    server: z.string().trim().min(1).optional(),
    faction: z.enum(['alliance', 'horde']).optional(),
  })
  .partial();

const banDetailsSchema = z.object({
  ban_date: z
    .string()
    .trim()
    .regex(/^\d{2}\.\d{2}\.\d{4}$/, 'Expected DD.MM.YYYY format'),
  ban_reason: z.string().trim().min(1).max(1000),
  ban_mechanism: z.enum([
    'battlenet_account_closure',
    'battlenet_account_suspension',
    'game_suspension',
    'hardware_ban',
    'ip_ban',
    'other',
  ]),
});

const lifecycleSchema = z
  .object({
    current_stage: z.enum(['prepare', 'leveling', 'profession', 'farming', 'banned']).optional(),
    previous_status: z.enum(BOT_STATUSES).optional(),
    stage_transitions: z
      .array(
        z.object({
          from: z.enum(['prepare', 'leveling', 'profession', 'farming', 'create']),
          to: z.enum(['prepare', 'leveling', 'profession', 'farming']),
          timestamp: timestampSchema,
        })
      )
      .optional(),
    ban_details: banDetailsSchema
      .extend({
        unbanned_at: timestampSchema.optional(),
      })
      .optional(),
  })
  .partial();

const botCreateSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      name: z.string().trim().min(1).optional(),
      project_id: z.string().trim().min(1).optional(),
      status: z.enum(BOT_STATUSES).optional(),
      character: characterSchema.optional(),
      lifecycle: lifecycleSchema.optional(),
    })
    .passthrough(),
  'Bot payload must not be empty'
);

const botPatchSchema = botCreateSchema;

const botLifecycleTransitionSchema = z.object({
  status: z.enum(BOT_STATUSES),
});

const licenseMutationSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      key: z.string().trim().min(1).optional(),
      type: z.string().trim().min(1).optional(),
      status: z.enum(['active', 'expired', 'revoked']).optional(),
      bot_ids: z.array(stringIdSchema).optional(),
      bot_names: z.array(z.string().trim().min(1)).optional(),
      expires_at: timestampSchema.optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
    })
    .passthrough(),
  'License payload must not be empty'
);

const proxyMutationSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      ip: z.string().trim().min(1).optional(),
      port: z.coerce.number().int().min(1).max(65535).optional(),
      login: z.string().trim().optional(),
      password: z.string().optional(),
      provider: z.string().trim().optional(),
      country: z.string().trim().optional(),
      country_code: z.string().trim().optional().nullable(),
      type: z.enum(['http', 'socks5']).optional(),
      status: z.enum(['active', 'expired', 'banned']).optional(),
      bot_id: z.union([stringIdSchema, z.null()]).optional(),
      fraud_score: z.coerce.number().finite().optional(),
      vpn: z.boolean().optional(),
      proxy: z.boolean().optional(),
      tor: z.boolean().optional(),
      bot_status: z.boolean().optional(),
      isp: z.string().trim().optional(),
      organization: z.string().trim().optional(),
      city: z.string().trim().optional(),
      region: z.string().trim().optional(),
      zip_code: z.string().trim().optional(),
      timezone: z.string().trim().optional(),
      latitude: z.coerce.number().finite().optional(),
      longitude: z.coerce.number().finite().optional(),
      expires_at: timestampSchema.optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
      last_checked: timestampSchema.optional(),
    })
    .passthrough(),
  'Proxy payload must not be empty'
);

const subscriptionMutationSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      type: z.enum(['wow', 'bot', 'proxy', 'vpn', 'other']).optional(),
      status: z.enum(['active', 'cancelled', 'expired', 'expiring_soon']).optional(),
      expires_at: timestampSchema.optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
      bot_id: stringIdSchema.optional(),
      account_email: z.string().trim().optional(),
      auto_renew: z.boolean().optional(),
      project_id: z.enum(PROJECT_IDS).optional(),
      notes: z.string().max(1000).optional(),
    })
    .passthrough(),
  'Subscription payload must not be empty'
);

const resourceMutationSchemas = {
  licenses: licenseMutationSchema,
  proxies: proxyMutationSchema,
  subscriptions: subscriptionMutationSchema,
};

const resourceCreateSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      status: z.string().trim().min(1).optional(),
      bot_id: stringIdSchema.optional(),
      expires_at: z.coerce.number().int().optional(),
      type: z.string().trim().min(1).optional(),
    })
    .passthrough(),
  'Resource payload must not be empty'
);

const resourcePatchSchema = resourceCreateSchema;

const notesMutationSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      title: z.string().trim().optional(),
      content: z.string().optional(),
      blocks: z.union([z.record(z.unknown()), z.array(z.unknown())]).optional(),
      tags: z.array(z.string().trim()).optional(),
      bot_id: z.union([stringIdSchema, z.null()]).optional(),
      project_id: z.union([z.enum(PROJECT_IDS), z.null()]).optional(),
      is_pinned: z.boolean().optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
      created_by: z.string().trim().optional(),
    })
    .passthrough(),
  'Notes payload must not be empty'
);

const calendarMutationSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      title: z.string().trim().optional(),
      description: z.string().optional(),
      date: z.string().regex(ISO_DATE_REGEX, 'Expected YYYY-MM-DD format').optional(),
      linked_note_id: z.union([stringIdSchema, z.null()]).optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
    })
    .passthrough(),
  'Calendar payload must not be empty'
);

const kanbanMutationSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      title: z.string().trim().optional(),
      description: z.string().optional(),
      status: z.enum(['todo', 'in_progress', 'done']).optional(),
      due_date: z.union([z.string().regex(ISO_DATE_REGEX, 'Expected YYYY-MM-DD format'), z.null()]).optional(),
      order: z.coerce.number().int().optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
    })
    .passthrough(),
  'Kanban payload must not be empty'
);

const workspaceMutationSchemas = {
  notes: notesMutationSchema,
  calendar: calendarMutationSchema,
  kanban: kanbanMutationSchema,
};

const workspaceCreateSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      title: z.string().trim().optional(),
      content: z.string().optional(),
      status: z.string().trim().optional(),
      date: z.string().trim().optional(),
    })
    .passthrough(),
  'Workspace payload must not be empty'
);

const workspacePatchSchema = workspaceCreateSchema;

const settingsMutationSchema = z.union([
  nonEmptyObjectSchema,
  z.array(z.unknown()),
  z.string(),
  z.number().finite(),
  z.boolean(),
  z.null(),
]);

const settingsApiKeysMutationSchema = requireNonEmpty(
  z
    .object({
      ipqs: z
        .object({
          api_key: z.string().trim().optional(),
          enabled: z.boolean().optional(),
        })
        .partial()
        .optional(),
      telegram: z
        .object({
          bot_token: z.string().trim().optional(),
          chat_id: z.string().trim().optional(),
          enabled: z.boolean().optional(),
        })
        .partial()
        .optional(),
    })
    .passthrough(),
  'API keys payload must not be empty'
);

const settingsProxyMutationSchema = requireNonEmpty(
  z
    .object({
      auto_check_on_add: z.boolean().optional(),
      fraud_score_threshold: z.coerce.number().int().min(0).max(100).optional(),
      check_interval_hours: z.coerce.number().int().min(0).max(168).optional(),
    })
    .passthrough(),
  'Proxy settings payload must not be empty'
);

const settingsNotificationEventsMutationSchema = requireNonEmpty(
  z
    .object({
      bot_banned: z.boolean().optional(),
      bot_offline: z.boolean().optional(),
      bot_online: z.boolean().optional(),
      level_up: z.boolean().optional(),
      profession_maxed: z.boolean().optional(),
      low_fraud_score: z.boolean().optional(),
      daily_report: z.boolean().optional(),
    })
    .passthrough(),
  'Notification events payload must not be empty'
);

const storagePolicyMutationSchema = requireNonEmpty(
  z
    .object({
      secrets: z.enum(['local-only']).optional(),
      operational: z.enum(STORAGE_OPERATIONAL_MODES).optional(),
      sync: z
        .object({
          enabled: z.boolean().optional(),
        })
        .partial()
        .optional(),
      updated_at: timestampSchema.optional(),
      updated_by: z.string().trim().optional(),
    })
    .passthrough(),
  'Storage policy payload must not be empty'
);

const projectSettingsEntryMutationSchema = requireNonEmpty(
  z
    .object({
      id: stringIdSchema.optional(),
      name: z.string().trim().min(1).optional(),
      game: z.string().trim().optional(),
      expansion: z.string().trim().optional(),
      max_level: z.coerce.number().int().min(1).max(200).optional(),
      currency: z.string().trim().optional(),
      currency_symbol: z.string().trim().optional(),
      server_region: z.string().trim().optional(),
      professions: z.array(z.string().trim().min(1)).optional(),
      referenceData: z.unknown().optional(),
      gold_price_usd: z.coerce.number().finite().positive().optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
    })
    .passthrough(),
  'Project settings payload must not be empty'
);

const projectsCollectionMutationSchema = requireNonEmpty(
  z.record(z.union([projectSettingsEntryMutationSchema, z.null()])),
  'Projects payload must not be empty'
);

const settingsResourceTreeMutationSchema = requireNonEmpty(
  z
    .object({
      expandedKeys: z.array(stringIdSchema).optional(),
      visibleStatuses: z.array(z.enum(BOT_STATUSES)).optional(),
      showFilters: z.boolean().optional(),
      updated_at: timestampSchema.optional(),
    })
    .passthrough(),
  'Resource tree settings payload must not be empty'
);

const financeChartConfigEntryMutationSchema = z
  .object({
    key: z.string().trim().min(1),
    name: z.string().trim().min(1),
    color: z.string().trim().min(1),
    type: z.enum(['line', 'bar']),
    yAxisId: z.string().trim().min(1),
    visible: z.boolean(),
    unit: z.string().trim().min(1),
  })
  .passthrough();

const financeChartConfigMutationSchema = z.array(financeChartConfigEntryMutationSchema).max(200);

const projectGoldPriceMutationSchema = z.coerce.number().finite().positive();

const scheduleGenerationParamsMutationSchema = requireNonEmpty(
  z
    .object({
      startTime: z.string().regex(TIME_24H_REGEX, 'Expected HH:MM format').optional(),
      endTime: z.string().regex(TIME_24H_REGEX, 'Expected HH:MM format').optional(),
      useSecondWindow: z.boolean().optional(),
      startTime2: z.string().regex(TIME_24H_REGEX, 'Expected HH:MM format').optional(),
      endTime2: z.string().regex(TIME_24H_REGEX, 'Expected HH:MM format').optional(),
      targetActiveMinutes: z.coerce.number().int().min(30).max(1380).optional(),
      minSessionMinutes: z.coerce.number().int().min(15).max(240).optional(),
      minBreakMinutes: z.coerce.number().int().min(5).max(120).optional(),
      randomOffsetMinutes: z.coerce.number().int().min(0).max(60).optional(),
      profile: z.string().trim().optional(),
      updated_at: timestampSchema.optional(),
    })
    .passthrough(),
  'Schedule params payload must not be empty'
);

const scheduleTemplateEntryMutationSchema = requireNonEmpty(
  z
    .object({
      name: z.string().trim().min(1).optional(),
      params: scheduleGenerationParamsMutationSchema.optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
    })
    .passthrough(),
  'Schedule template payload must not be empty'
);

const scheduleTemplatesCollectionMutationSchema = requireNonEmpty(
  z.record(z.union([scheduleTemplateEntryMutationSchema, z.null()])),
  'Schedule templates payload must not be empty'
);

const settingsAlertsMutationSchema = requireNonEmpty(
  z
    .object({
      warning_days: z.coerce.number().int().min(1).max(365).optional(),
      updated_at: timestampSchema.optional(),
      updated_by: z.string().trim().optional(),
    })
    .passthrough(),
  'Alerts payload must not be empty'
);

const themePresetMutationSchema = z
  .object({
    id: stringIdSchema.optional(),
    name: z.string().trim().min(1).optional(),
    palettes: z.record(z.unknown()).optional(),
    created_at: timestampSchema.optional(),
    updated_at: timestampSchema.optional(),
  })
  .passthrough();

const themeSettingsMutationSchema = requireNonEmpty(
  z
    .object({
      palettes: z.record(z.unknown()).optional(),
      presets: z.record(themePresetMutationSchema).optional(),
      active_preset_id: z.union([stringIdSchema, z.null()]).optional(),
      updated_at: timestampSchema.optional(),
      updated_by: z.string().trim().optional(),
    })
    .passthrough(),
  'Theme payload must not be empty'
);

const vmHardwarePartialSchema = z
  .object({
    cores: z.coerce.number().int().min(1).max(64).optional(),
    sockets: z.coerce.number().int().min(1).max(8).optional(),
    memory: z.coerce.number().int().min(256).max(262144).optional(),
    balloon: z.coerce.number().int().min(0).max(262144).optional(),
    cpu: z.string().trim().min(1).optional(),
    onboot: z.boolean().optional(),
    agent: z.boolean().optional(),
  })
  .partial();

const vmGeneratorMutationSchema = requireNonEmpty(
  z
    .object({
      proxmox: z
        .object({
          url: z.string().trim().min(1).optional(),
          username: z.string().trim().optional(),
          password: z.string().optional(),
          node: z.string().trim().min(1).optional(),
        })
        .partial()
        .optional(),
      ssh: z
        .object({
          host: z.string().trim().optional(),
          port: z.coerce.number().int().min(1).max(65535).optional(),
          username: z.string().trim().optional(),
          password: z.string().optional(),
          privateKeyPath: z.string().trim().optional(),
          useKeyAuth: z.boolean().optional(),
        })
        .partial()
        .optional(),
      storage: z
        .object({
          options: z.array(z.string().trim().min(1)).optional(),
          default: z.string().trim().min(1).optional(),
        })
        .partial()
        .optional(),
      format: z
        .object({
          options: z.array(z.string().trim().min(1)).optional(),
          default: z.string().trim().min(1).optional(),
        })
        .partial()
        .optional(),
      template: z
        .object({
          vmId: z.coerce.number().int().positive().optional(),
          name: z.string().trim().optional(),
        })
        .partial()
        .optional(),
      hardware: vmHardwarePartialSchema.optional(),
      projectHardware: z
        .object({
          wow_tbc: z
            .object({
              cores: z.coerce.number().int().min(1).max(64).optional(),
              memory: z.coerce.number().int().min(256).max(262144).optional(),
            })
            .partial()
            .optional(),
          wow_midnight: z
            .object({
              cores: z.coerce.number().int().min(1).max(64).optional(),
              memory: z.coerce.number().int().min(256).max(262144).optional(),
            })
            .partial()
            .optional(),
        })
        .partial()
        .optional(),
      hardwareApply: z
        .object({
          applyCpu: z.boolean().optional(),
          applyOnboot: z.boolean().optional(),
          applyAgent: z.boolean().optional(),
        })
        .partial()
        .optional(),
      services: z
        .object({
          proxmoxUrl: z.string().trim().optional(),
          tinyFmUrl: z.string().trim().optional(),
          syncThingUrl: z.string().trim().optional(),
          proxmoxAutoLogin: z.boolean().optional(),
          tinyFmAutoLogin: z.boolean().optional(),
          tinyFmUsername: z.string().trim().optional(),
          tinyFmPassword: z.string().optional(),
          syncThingAutoLogin: z.boolean().optional(),
          syncThingUsername: z.string().trim().optional(),
          syncThingPassword: z.string().optional(),
        })
        .partial()
        .optional(),
      deleteVmFilters: z
        .object({
          policy: z
            .object({
              allowBanned: z.boolean().optional(),
              allowPrepareNoResources: z.boolean().optional(),
              allowOrphan: z.boolean().optional(),
            })
            .partial()
            .optional(),
          view: z
            .object({
              showAllowed: z.boolean().optional(),
              showLocked: z.boolean().optional(),
              showRunning: z.boolean().optional(),
              showStopped: z.boolean().optional(),
            })
            .partial()
            .optional(),
        })
        .partial()
        .optional(),
      tinyFM: z.record(z.unknown()).optional(),
      syncThing: z.record(z.unknown()).optional(),
    })
    .passthrough(),
  'VM generator payload must not be empty'
);

const vmProfileMutationSchema = requireNonEmpty(
  z
    .object({
      name: z.string().trim().min(1).optional(),
      hardware: vmHardwarePartialSchema.optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
    })
    .passthrough(),
  'VM profile payload must not be empty'
);

const vmProfilesCollectionMutationSchema = requireNonEmpty(
  z.record(z.union([vmProfileMutationSchema, z.null()])),
  'VM profiles payload must not be empty'
);

const accountGeneratorPasswordOptionsMutationSchema = z
  .object({
    length: z.coerce.number().int().min(6).max(128).optional(),
    uppercase: z.boolean().optional(),
    lowercase: z.boolean().optional(),
    numbers: z.boolean().optional(),
    symbols: z.boolean().optional(),
  })
  .partial();

const accountGeneratorSettingsMutationSchema = requireNonEmpty(
  z
    .object({
      passwordOptions: accountGeneratorPasswordOptionsMutationSchema.optional(),
      selectedDomain: z.string().trim().optional(),
      customDomain: z.string().trim().optional(),
      useCustomDomain: z.boolean().optional(),
    })
    .passthrough(),
  'Account generator settings payload must not be empty'
);

const accountGeneratorTemplateEntryMutationSchema = requireNonEmpty(
  z
    .object({
      name: z.string().trim().min(1).optional(),
      created_at: timestampSchema.optional(),
      updated_at: timestampSchema.optional(),
      settings: accountGeneratorSettingsMutationSchema.optional(),
    })
    .passthrough(),
  'Account generator template payload must not be empty'
);

const accountGeneratorTemplatesCollectionMutationSchema = requireNonEmpty(
  z.record(z.union([accountGeneratorTemplateEntryMutationSchema, z.null()])),
  'Account generator templates payload must not be empty'
);

const accountGeneratorDefaultTemplateIdMutationSchema = z.union([stringIdSchema, z.null()]);

const financeOperationBaseSchema = z
  .object({
    type: z.enum(['income', 'expense']),
    category: z.string().trim().min(1),
    amount: z.coerce.number().finite(),
    currency: z.string().trim().min(1),
    date: timestampSchema,
    description: z.string().trim().max(1000).optional(),
    bot_id: z.string().trim().optional(),
    project_id: z.string().trim().optional(),
    gold_amount: z.coerce.number().finite().optional(),
    gold_price_at_time: z.coerce.number().finite().optional(),
    updated_at: timestampSchema.optional(),
    created_at: timestampSchema.optional(),
  })
  .passthrough();

const financeOperationCreateSchema = financeOperationBaseSchema;
const financeOperationPatchSchema = financeOperationBaseSchema.partial().refine(
  (value) => Object.keys(value || {}).length > 0,
  'Finance operation patch must not be empty'
);

const infraCloneRequestSchema = z
  .object({
    newid: z.coerce.number().int().positive().optional(),
    name: z.string().trim().min(1).optional(),
    storage: z.string().trim().min(1).optional(),
    format: z.string().trim().min(1).optional(),
    full: z.union([z.boolean(), z.number().int().min(0).max(1)]).optional(),
  })
  .passthrough();

const infraVmConfigUpdateSchema = nonEmptyObjectSchema;

const sshExecRequestSchema = z.object({
  command: z.string().trim().min(1),
  timeout: z.coerce.number().int().min(1_000).max(120_000).optional(),
});

const sshVmConfigWriteSchema = z.object({
  content: z.string().min(1),
});

const vmRegisterSchema = z.object({
  vm_uuid: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9:_-]+$/),
  user_id: stringIdSchema.optional(),
  vm_name: z.string().trim().max(200).optional(),
  project_id: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'paused', 'revoked']).optional(),
  metadata: z.record(z.unknown()).optional(),
});

const licenseLeaseRequestSchema = z.object({
  vm_uuid: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9:_-]+$/),
  user_id: stringIdSchema.optional(),
  agent_id: z.string().trim().min(1).max(200),
  runner_id: z.string().trim().min(1).max(200),
  module: z.string().trim().min(1).max(200),
  version: z.string().trim().max(100).optional(),
});

const licenseHeartbeatSchema = z.object({
  lease_id: z.string().trim().min(1).max(200),
});

const licenseRevokeSchema = z.object({
  lease_id: z.string().trim().min(1).max(200),
  reason: z.string().trim().max(500).optional(),
});

const artifactReleaseCreateSchema = z.object({
  module: z.string().trim().min(1).max(200),
  platform: z.string().trim().min(1).max(100),
  channel: z.string().trim().min(1).max(100).optional().default('stable'),
  version: z.string().trim().min(1).max(100),
  object_key: z.string().trim().min(1).max(1024),
  sha256: z.string().trim().regex(/^[a-fA-F0-9]{64}$/),
  size_bytes: z.coerce.number().int().positive(),
  status: z.enum(ARTIFACT_RELEASE_STATUSES).optional().default('active'),
});

const artifactAssignSchema = z.object({
  user_id: z.string().trim().min(1).max(200).optional(),
  module: z.string().trim().min(1).max(200),
  platform: z.string().trim().min(1).max(100),
  channel: z.string().trim().min(1).max(100).optional().default('stable'),
  release_id: z.coerce.number().int().positive(),
});

const artifactResolveDownloadSchema = z.object({
  lease_token: z.string().trim().min(1),
  vm_uuid: z.string().trim().min(8).max(128).regex(/^[A-Za-z0-9:_-]+$/),
  module: z.string().trim().min(1).max(200),
  platform: z.string().trim().min(1).max(100),
  channel: z.string().trim().min(1).max(100).optional().default('stable'),
});

const upsertPayloadSchema = z.record(z.unknown());

// --- Agents ---

const agentPairingSchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  expires_in_minutes: z.coerce.number().int().min(5).max(1440).optional().default(15),
});

const agentRegisterSchema = z.object({
  pairing_code: z.string().trim().min(1).max(200),
  version: z.string().trim().max(100).optional(),
  platform: z.string().trim().max(100).optional(),
  capabilities: z.array(z.string().trim().min(1).max(200)).max(50).optional(),
});

const agentHeartbeatSchema = z.object({
  agent_id: z.string().trim().min(1).max(200),
});

const agentRevokeSchema = z.object({
  reason: z.string().trim().max(500).optional(),
});

const agentListQuerySchema = z.object({
  status: z.enum(['pending', 'active', 'offline', 'revoked']).optional(),
});

// --- Agent Commands ---

const agentCommandCreateSchema = z.object({
  agent_id: z.string().trim().min(1).max(200),
  command_type: z.string().trim().min(1).max(200),
  payload: z.record(z.unknown()).optional().default({}),
  expires_in_seconds: z.coerce.number().int().min(10).max(3600).optional().default(300),
});

const agentCommandUpdateSchema = z.object({
  status: z.enum(['running', 'succeeded', 'failed']),
  result: z.unknown().optional(),
  error_message: z.string().trim().max(2000).optional(),
});

// --- Secrets ---

const secretCreateSchema = z.object({
  label: z.string().trim().min(1).max(200),
  ciphertext: z.string().trim().min(1),
  alg: z.string().trim().min(1).max(50).optional().default('AES-256-GCM'),
  key_id: z.string().trim().min(1).max(200),
  nonce: z.string().trim().min(1).max(200),
  aad_meta: z.record(z.unknown()).optional().default({}),
});

const secretRotateSchema = z.object({
  ciphertext: z.string().trim().min(1),
  alg: z.string().trim().min(1).max(50).optional(),
  key_id: z.string().trim().min(1).max(200),
  nonce: z.string().trim().min(1).max(200),
  aad_meta: z.record(z.unknown()).optional(),
});

const secretBindingCreateSchema = z.object({
  scope_type: z.enum(['bot', 'vm', 'agent', 'tenant']),
  scope_id: z.string().trim().min(1).max(200),
  secret_ref: z.string().trim().min(1).max(200),
  field_name: z.string().trim().min(1).max(200),
});

// --- VM Ops ---

const vmOpsCommandSchema = z.object({
  agent_id: z.string().trim().min(1).max(200),
  action: z.string().trim().min(1).max(200),
  params: z.record(z.unknown()).optional().default({}),
});

function getResourceCreateSchema(kind) {
  return resourceMutationSchemas[kind] || resourceCreateSchema;
}

function getResourcePatchSchema(kind) {
  return resourceMutationSchemas[kind] || resourcePatchSchema;
}

function getWorkspaceCreateSchema(kind) {
  return workspaceMutationSchemas[kind] || workspaceCreateSchema;
}

function getWorkspacePatchSchema(kind) {
  return workspaceMutationSchemas[kind] || workspacePatchSchema;
}

function normalizeSettingsSubPath(pathValue) {
  const normalized = String(pathValue || '').trim().replace(/^\/+/, '').replace(/\/+$/, '');
  if (!normalized) return '';
  if (normalized.startsWith('settings/')) {
    return normalized.slice('settings/'.length);
  }
  if (normalized === 'settings') {
    return '';
  }
  return normalized;
}

function resolveSettingsMutationSchema(pathValue) {
  const subPath = normalizeSettingsSubPath(pathValue);

  if (!subPath) {
    return settingsMutationSchema;
  }

  if (subPath === 'alerts') {
    return settingsAlertsMutationSchema;
  }

  if (subPath === 'api_keys') {
    return settingsApiKeysMutationSchema;
  }

  if (subPath === 'proxy') {
    return settingsProxyMutationSchema;
  }

  if (subPath === 'notifications/events') {
    return settingsNotificationEventsMutationSchema;
  }

  if (subPath === 'storage_policy') {
    return storagePolicyMutationSchema;
  }

  if (subPath === 'projects') {
    return projectsCollectionMutationSchema;
  }

  if (/^projects\/[^/]+\/gold_price_usd$/.test(subPath)) {
    return projectGoldPriceMutationSchema;
  }

  if (subPath.startsWith('projects/')) {
    return projectSettingsEntryMutationSchema;
  }

  if (subPath === 'theme') {
    return themeSettingsMutationSchema;
  }

  if (subPath === 'finance/chart_config') {
    return financeChartConfigMutationSchema;
  }

  if (subPath === 'ui/resource_tree') {
    return settingsResourceTreeMutationSchema;
  }

  if (subPath === 'schedule/last_params') {
    return scheduleGenerationParamsMutationSchema;
  }

  if (subPath === 'schedule/templates') {
    return scheduleTemplatesCollectionMutationSchema;
  }

  if (subPath.startsWith('schedule/templates/')) {
    return scheduleTemplateEntryMutationSchema;
  }

  if (subPath === 'vmgenerator') {
    return vmGeneratorMutationSchema;
  }

  if (subPath === 'vmgenerator/profiles') {
    return vmProfilesCollectionMutationSchema;
  }

  if (subPath.startsWith('vmgenerator/profiles/')) {
    return vmProfileMutationSchema;
  }

  if (subPath === 'generators/account/lastSettings') {
    return accountGeneratorSettingsMutationSchema;
  }

  if (subPath === 'generators/account/defaultTemplateId') {
    return accountGeneratorDefaultTemplateIdMutationSchema;
  }

  if (subPath === 'generators/account/templates') {
    return accountGeneratorTemplatesCollectionMutationSchema;
  }

  if (subPath.startsWith('generators/account/templates/')) {
    return accountGeneratorTemplateEntryMutationSchema;
  }

  return settingsMutationSchema;
}

module.exports = {
  BOT_STATUSES,
  RESOURCE_KINDS,
  WORKSPACE_KINDS,
  listQuerySchema,
  idParamSchema,
  vmResolveParamSchema,
  resourceKindParamSchema,
  workspaceKindParamSchema,
  botCreateSchema,
  botPatchSchema,
  botLifecycleTransitionSchema,
  banDetailsSchema,
  resourceCreateSchema,
  resourcePatchSchema,
  workspaceCreateSchema,
  workspacePatchSchema,
  settingsMutationSchema,
  storagePolicyMutationSchema,
  getResourceCreateSchema,
  getResourcePatchSchema,
  getWorkspaceCreateSchema,
  getWorkspacePatchSchema,
  resolveSettingsMutationSchema,
  financeOperationCreateSchema,
  financeOperationPatchSchema,
  infraCloneRequestSchema,
  infraVmConfigUpdateSchema,
  sshExecRequestSchema,
  sshVmConfigWriteSchema,
  vmRegisterSchema,
  licenseLeaseRequestSchema,
  licenseHeartbeatSchema,
  licenseRevokeSchema,
  artifactReleaseCreateSchema,
  artifactAssignSchema,
  artifactResolveDownloadSchema,
  upsertPayloadSchema,
  agentPairingSchema,
  agentRegisterSchema,
  agentHeartbeatSchema,
  agentRevokeSchema,
  agentListQuerySchema,
  agentCommandCreateSchema,
  agentCommandUpdateSchema,
  secretCreateSchema,
  secretRotateSchema,
  secretBindingCreateSchema,
  vmOpsCommandSchema,
};
