import { z } from 'zod';
import { jsonValueSchema } from './schemasCommon.js';

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
