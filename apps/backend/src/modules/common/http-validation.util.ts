import {
  BadRequestException,
  Injectable,
  type PipeTransform,
  type ValidationError,
  ValidationPipe,
} from '@nestjs/common';
import type { ZodType } from 'zod';

function mapValidationErrors(errors: ValidationError[]): unknown {
  return errors.map((error) => ({
    property: error.property,
    constraints: error.constraints ?? {},
    children: error.children?.length ? mapValidationErrors(error.children) : [],
  }));
}

export function createBadRequestValidationPipe(code: string, message: string): ValidationPipe {
  return new ValidationPipe({
    transform: true,
    whitelist: true,
    forbidUnknownValues: false,
    exceptionFactory: (errors) =>
      new BadRequestException({
        code,
        message,
        details: {
          validation: mapValidationErrors(errors),
        },
      }),
  });
}

@Injectable()
export class ZodSchemaValidationPipe<TSchema extends ZodType> implements PipeTransform {
  constructor(
    private readonly schema: TSchema,
    private readonly code: string,
    private readonly message: string,
  ) {}

  transform(value: unknown): import('zod').output<TSchema> {
    const parsed = this.schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: this.code,
        message: this.message,
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }
}
