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
