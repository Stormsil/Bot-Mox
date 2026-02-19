import { z } from 'zod';

export const apiEnvelopeSchema = z
  .object({
    success: z.boolean(),
    data: z.unknown().optional(),
    error: z
      .object({
        code: z.string().min(1),
        message: z.string().min(1),
        details: z.unknown().optional(),
      })
      .optional(),
  })
  .superRefine((value, context) => {
    if (!value.success && !value.error) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Failed response envelope must include error payload',
        path: ['error'],
      });
    }
  });

export const queuedCommandSchema = z
  .object({
    id: z.string().trim().min(1),
    tenant_id: z.string().optional(),
    agent_id: z.string().optional(),
    command_type: z.string().trim().min(1),
    payload: z.record(z.unknown()).optional(),
    status: z.string().optional(),
    queued_at: z.string().optional(),
    expires_at: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((value) => ({
    id: value.id,
    tenant_id: value.tenant_id ?? '',
    agent_id: value.agent_id ?? '',
    command_type: value.command_type,
    payload: value.payload ?? {},
    status: value.status ?? 'queued',
    queued_at: value.queued_at ?? '',
    expires_at: value.expires_at ?? '',
  }));

export type QueuedCommand = z.infer<typeof queuedCommandSchema>;
