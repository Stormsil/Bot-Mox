import { z } from 'zod';
import { jsonValueSchema, successEnvelopeSchema } from './schemasCommon.js';

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
