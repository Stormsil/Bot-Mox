import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

interface ZodBadRequestOptions {
  code: string;
  message: string;
}

export function parseWithZodOrBadRequest<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
  options: ZodBadRequestOptions,
): z.infer<TSchema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new BadRequestException({
      code: options.code,
      message: options.message,
      details: parsed.error.flatten(),
    });
  }
  return parsed.data;
}

export function buildTrimmedIdSchema(label: string) {
  return z
    .string()
    .min(1)
    .transform((value) => value.trim())
    .refine((value) => value.length > 0, `${label} is required`);
}
