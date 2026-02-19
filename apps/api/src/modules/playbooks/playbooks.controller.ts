import {
  playbookCreateSchema,
  playbookUpdateSchema,
  playbookValidateBodySchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Put,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { z } from 'zod';
import type { PlaybooksService } from './playbooks.service';

const playbookIdSchema = z
  .string()
  .min(1)
  .transform((value) => value.trim())
  .refine((value) => value.length > 0, 'Playbook id is required');

@Controller('playbooks')
export class PlaybooksController {
  constructor(private readonly playbooksService: PlaybooksService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseId(id: string): string {
    const parsed = playbookIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseCreateBody(body: unknown): {
    name: string;
    is_default?: boolean;
    content: string;
  } {
    const parsed = playbookCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseUpdateBody(body: unknown): z.infer<typeof playbookUpdateSchema> {
    const parsed = playbookUpdateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseValidateBody(body: unknown): {
    content: string;
  } {
    const parsed = playbookValidateBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  @Get()
  list(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown[];
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.playbooksService.list(),
    };
  }

  @Get(':id')
  getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const playbook = this.playbooksService.getById(parsedId);
    if (!playbook) {
      throw new NotFoundException('Playbook not found');
    }
    return {
      success: true,
      data: playbook,
    };
  }

  @Post()
  create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCreateBody(body);
    const validation = this.playbooksService.validate(parsedBody.content);
    if (!validation.valid) {
      throw new UnprocessableEntityException({
        success: false,
        error: {
          code: 'INVALID_PLAYBOOK',
          message: 'Playbook YAML validation failed',
          details: {
            errors: validation.errors,
            warnings: validation.warnings,
          },
        },
      });
    }
    return {
      success: true,
      data: this.playbooksService.create(parsedBody),
    };
  }

  @Put(':id')
  update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseUpdateBody(body);

    if (typeof parsedBody.content === 'string') {
      const validation = this.playbooksService.validate(parsedBody.content);
      if (!validation.valid) {
        throw new UnprocessableEntityException({
          success: false,
          error: {
            code: 'INVALID_PLAYBOOK',
            message: 'Playbook YAML validation failed',
            details: {
              errors: validation.errors,
              warnings: validation.warnings,
            },
          },
        });
      }
    }

    const updated = this.playbooksService.update(parsedId, parsedBody);
    if (!updated) {
      throw new NotFoundException('Playbook not found');
    }
    return {
      success: true,
      data: updated,
    };
  }

  @Delete(':id')
  remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: { deleted: boolean } } {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const removed = this.playbooksService.remove(parsedId);
    if (!removed) {
      throw new NotFoundException('Playbook not found');
    }
    return {
      success: true,
      data: { deleted: true },
    };
  }

  @Post('validate')
  validate(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): {
    success: true;
    data: {
      valid: boolean;
      errors: Array<{ path?: string; message: string }>;
      warnings: Array<{ message: string }>;
    };
  } {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseValidateBody(body);
    return {
      success: true,
      data: this.playbooksService.validate(parsedBody.content),
    };
  }
}
