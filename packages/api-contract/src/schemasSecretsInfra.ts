import { z } from 'zod';
import { jsonValueSchema } from './schemasCommon.js';

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
