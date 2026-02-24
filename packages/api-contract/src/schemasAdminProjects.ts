import { z } from 'zod';
import { jsonValueSchema } from './schemasCommon.js';

export const adminProjectCreateReleaseSchema = z.object({
  project_key: z.string().trim().min(1).max(200),
  version: z.string().trim().min(1).max(100),
  status: z.string().trim().min(1).max(100).optional(),
  artifacts: z.array(z.unknown()).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const adminProjectRolloutScopeSchema = z.enum(['tenant', 'wave', 'all']);

export const adminProjectRolloutSchema = z.object({
  project_key: z.string().trim().min(1).max(200),
  release_id: z.string().trim().uuid(),
  scope: adminProjectRolloutScopeSchema,
  tenant_id: z.string().trim().min(1).max(200).optional(),
  wave: z.string().trim().min(1).max(100).optional(),
  batch_size: z.coerce.number().int().min(1).max(10_000).optional(),
  tenant_ids: z.array(z.string().trim().min(1).max(200)).max(10_000).optional(),
  notes: z.string().trim().max(4_000).optional(),
});

export const adminProjectStagedRolloutSchema = z.object({
  project_key: z.string().trim().min(1).max(200),
  release_id: z.string().trim().uuid(),
  test_tenant_id: z.string().trim().min(1).max(200),
  tenant_ids: z.array(z.string().trim().min(1).max(200)).max(10_000).optional(),
  batch_size: z.coerce.number().int().min(1).max(10_000).optional(),
  wave: z.string().trim().min(1).max(100).optional(),
  notes: z.string().trim().max(4_000).optional(),
});

export const adminProjectRollbackSchema = z.object({
  project_key: z.string().trim().min(1).max(200),
  scope: adminProjectRolloutScopeSchema,
  tenant_id: z.string().trim().min(1).max(200).optional(),
  wave: z.string().trim().min(1).max(100).optional(),
  batch_size: z.coerce.number().int().min(1).max(10_000).optional(),
  tenant_ids: z.array(z.string().trim().min(1).max(200)).max(10_000).optional(),
  notes: z.string().trim().max(4_000).optional(),
});

export const adminProjectReleaseListQuerySchema = z.object({
  project_key: z.string().trim().min(1).max(200).optional(),
  status: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).optional(),
  limit: z.coerce.number().int().min(1).max(1_000).optional(),
  sort: z.enum(['updated_at', 'created_at', 'version', 'project_key', 'status']).optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const adminProjectRolloutStatusQuerySchema = z.object({
  project_key: z.string().trim().min(1).max(200).optional(),
  tenant_id: z.string().trim().min(1).max(200).optional(),
  status: z.string().trim().min(1).max(100).optional(),
  page: z.coerce.number().int().min(1).max(1_000_000).optional(),
  limit: z.coerce.number().int().min(1).max(1_000).optional(),
  sort: z
    .enum(['updated_at', 'rolled_out_at', 'tenant_id', 'project_key', 'status', 'wave'])
    .optional(),
  order: z.enum(['asc', 'desc']).optional(),
});

export const adminProjectReleaseRecordSchema = z
  .object({
    id: z.string().trim().uuid(),
    project_key: z.string().trim().min(1),
    version: z.string().trim().min(1),
    status: z.string().trim().min(1),
    artifacts: jsonValueSchema.optional(),
    metadata: jsonValueSchema.optional(),
    created_by: z.union([z.string().trim(), z.null()]).optional(),
    created_at: z.string().trim().optional(),
    updated_at: z.string().trim().optional(),
  })
  .passthrough();

export const adminProjectRolloutStatusRowSchema = z
  .object({
    id: z.string().trim().uuid(),
    tenant_id: z.string().trim().min(1),
    project_key: z.string().trim().min(1),
    release_id: z.string().trim().uuid(),
    status: z.string().trim().min(1),
    wave: z.union([z.string().trim(), z.null()]).optional(),
    notes: z.union([z.string().trim(), z.null()]).optional(),
    rolled_out_at: z.string().trim().optional(),
    updated_at: z.string().trim().optional(),
    release: adminProjectReleaseRecordSchema.optional(),
  })
  .passthrough();

export const adminProjectReleasesListResponseSchema = z.object({
  items: z.array(adminProjectReleaseRecordSchema),
  total: z.coerce.number().int().min(0),
  page: z.coerce.number().int().min(1),
  limit: z.coerce.number().int().min(1),
  sort: z.string().trim().min(1),
  order: z.enum(['asc', 'desc']),
});

export const adminProjectRolloutStatusListResponseSchema = z.object({
  items: z.array(adminProjectRolloutStatusRowSchema),
  total: z.coerce.number().int().min(0),
  page: z.coerce.number().int().min(1),
  limit: z.coerce.number().int().min(1),
  sort: z.string().trim().min(1),
  order: z.enum(['asc', 'desc']),
});

export const adminProjectRolloutResponseSchema = z.object({
  release_id: z.string().trim().uuid(),
  scope: adminProjectRolloutScopeSchema,
  wave: z.string().trim().min(1),
  count: z.coerce.number().int().min(0),
  tenants: z.array(
    z.object({
      tenant_id: z.string().trim().min(1),
      rollout_id: z.string().trim().uuid(),
      status: z.string().trim().min(1),
    }),
  ),
});

export const adminProjectStagedRolloutResponseSchema = z.object({
  release_id: z.string().trim().uuid(),
  canary_tenant_id: z.string().trim().min(1),
  wave: z.string().trim().min(1),
  total_updated: z.coerce.number().int().min(0),
  phases: z.object({
    canary: adminProjectRolloutResponseSchema,
    wave: adminProjectRolloutResponseSchema,
  }),
});

export const adminProjectRollbackResponseSchema = z.object({
  project_key: z.string().trim().min(1),
  scope: adminProjectRolloutScopeSchema,
  wave: z.string().trim().min(1),
  count: z.coerce.number().int().min(0),
  rolled_back: z.coerce.number().int().min(0),
  skipped: z.coerce.number().int().min(0),
  tenants: z.array(
    z.object({
      tenant_id: z.string().trim().min(1),
      status: z.enum(['rolled_back', 'skipped']),
      rollback_to_release_id: z.string().trim().uuid().optional(),
      rollout_id: z.string().trim().uuid().optional(),
      reason: z.string().trim().min(1).optional(),
    }),
  ),
});
