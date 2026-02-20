import { z } from 'zod';
import { jsonValueSchema } from './schemasCommon.js';

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

export const agentWsEventAssignedSchema = z.object({
  type: z.literal('agent.command.assigned'),
  ts: z.string().datetime(),
  command: vmOpsCommandSchema.nullable(),
});

export const agentWsEventAckSchema = z.object({
  type: z.literal('agent.command.ack'),
  ts: z.string().datetime(),
  command_id: z.string().trim().min(1),
  agent_id: z.string().trim().min(1),
});

export const agentWsEventProgressSchema = z.object({
  type: z.literal('agent.command.progress'),
  ts: z.string().datetime(),
  command_id: z.string().trim().min(1),
  agent_id: z.string().trim().min(1),
  progress: z.coerce.number().min(0).max(100).optional(),
  message: z.string().trim().min(1).max(1_000).optional(),
});

export const agentWsEventResultSchema = z.object({
  type: z.literal('agent.command.result'),
  ts: z.string().datetime(),
  command_id: z.string().trim().min(1),
  agent_id: z.string().trim().min(1),
  status: z.enum(['succeeded', 'failed', 'expired', 'cancelled']),
  result: jsonValueSchema.optional(),
  error_message: z.string().trim().max(2_000).optional(),
});

export const agentWsEventHeartbeatSchema = z.object({
  type: z.literal('agent.heartbeat'),
  ts: z.string().datetime(),
  agent_id: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  metadata: z.record(jsonValueSchema).optional(),
});

export const agentWsEventConnectedSchema = z.object({
  type: z.literal('connected'),
  ts: z.string().datetime(),
  transport: z.literal('ws'),
});

export const agentWsEventErrorSchema = z.object({
  type: z.literal('error'),
  code: z.string().trim().min(1).max(100),
  message: z.string().trim().min(1).max(1_000),
  ts: z.string().datetime().optional(),
  request_id: z.string().trim().min(1).nullable().optional(),
});

export const agentWsEventSchema = z.discriminatedUnion('type', [
  agentWsEventAssignedSchema,
  agentWsEventAckSchema,
  agentWsEventProgressSchema,
  agentWsEventResultSchema,
  agentWsEventHeartbeatSchema,
  agentWsEventConnectedSchema,
  agentWsEventErrorSchema,
]);

export const agentWsInboundNextCommandSchema = z.object({
  type: z.literal('next_command'),
  request_id: z.string().trim().min(1).optional(),
  agent_id: z.string().trim().min(1).optional(),
  timeout_ms: z.coerce.number().int().min(1_000).max(120_000).optional(),
});

export const agentWsInboundHeartbeatSchema = z.object({
  type: z.literal('heartbeat'),
  request_id: z.string().trim().min(1).optional(),
  agent_id: z.string().trim().min(1).optional(),
  status: z.string().trim().min(1).optional(),
  metadata: z.record(jsonValueSchema).optional(),
});

export const agentWsInboundAckSchema = z.object({
  type: z.literal('agent.command.ack'),
  request_id: z.string().trim().min(1).optional(),
  command_id: z.string().trim().min(1),
  agent_id: z.string().trim().min(1),
});

export const agentWsInboundProgressSchema = z.object({
  type: z.literal('agent.command.progress'),
  request_id: z.string().trim().min(1).optional(),
  command_id: z.string().trim().min(1),
  agent_id: z.string().trim().min(1),
  progress: z.coerce.number().min(0).max(100).optional(),
  message: z.string().trim().min(1).max(1_000).optional(),
});

export const agentWsInboundResultSchema = z.object({
  type: z.literal('agent.command.result'),
  request_id: z.string().trim().min(1).optional(),
  command_id: z.string().trim().min(1),
  agent_id: z.string().trim().min(1),
  status: z.enum(['succeeded', 'failed', 'expired', 'cancelled']),
  result: jsonValueSchema.optional(),
  error_message: z.string().trim().max(2_000).optional(),
});

export const agentWsInboundMessageSchema = z.discriminatedUnion('type', [
  agentWsInboundNextCommandSchema,
  agentWsInboundHeartbeatSchema,
  agentWsInboundAckSchema,
  agentWsInboundProgressSchema,
  agentWsInboundResultSchema,
]);

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
