import { z } from 'zod';

export const jsonValueSchema: z.ZodType<unknown> = z.lazy(() =>
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

export const agentStatusSchema = z.enum(['online', 'offline', 'degraded', 'pairing']);

export const agentCommandStatusSchema = z.enum([
  'queued',
  'dispatched',
  'running',
  'succeeded',
  'failed',
  'expired',
  'cancelled',
]);

export const agentCommandPayloadSchema = jsonRecordSchema;

export const dbResourceRecordSchema = z.object({
  id: z.string().min(1),
  tenant_id: z.string().min(1),
  data: jsonRecordSchema,
  created_at: z.string().datetime().or(z.string().min(1)),
  updated_at: z.string().datetime().or(z.string().min(1)),
});
