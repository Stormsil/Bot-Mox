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
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { PlaybooksService } from './playbooks.service';

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
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseId(id: string): string {
    const parsed = playbookIdSchema.safeParse(String(id || ''));
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PLAYBOOK_INVALID_ID',
        message: 'Invalid playbook id',
        details: parsed.error.flatten(),
      });
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
      throw new BadRequestException({
        code: 'PLAYBOOK_INVALID_CREATE_BODY',
        message: 'Invalid playbook create payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseUpdateBody(body: unknown): z.infer<typeof playbookUpdateSchema> {
    const parsed = playbookUpdateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PLAYBOOK_INVALID_UPDATE_BODY',
        message: 'Invalid playbook update payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseValidateBody(body: unknown): {
    content: string;
  } {
    const parsed = playbookValidateBodySchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'PLAYBOOK_INVALID_VALIDATE_BODY',
        message: 'Invalid playbook validate payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  @Get()
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
  }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.playbooksService.list(identity.tenantId),
    };
  }

  @Get(':id')
  async getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const playbook = await this.playbooksService.getById(parsedId, identity.tenantId);
    if (!playbook) {
      throw new NotFoundException({
        code: 'PLAYBOOK_NOT_FOUND',
        message: 'Playbook not found',
      });
    }
    return {
      success: true,
      data: playbook,
    };
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCreateBody(body);
    const identity = getRequestIdentity(req);
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
      data: await this.playbooksService.create(parsedBody, identity.tenantId),
    };
  }

  @Put(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseUpdateBody(body);
    const identity = getRequestIdentity(req);

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

    const updated = await this.playbooksService.update(parsedId, parsedBody, identity.tenantId);
    if (!updated) {
      throw new NotFoundException({
        code: 'PLAYBOOK_NOT_FOUND',
        message: 'Playbook not found',
      });
    }
    return {
      success: true,
      data: updated,
    };
  }

  @Delete(':id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const identity = getRequestIdentity(req);
    const removed = await this.playbooksService.remove(parsedId, identity.tenantId);
    if (!removed) {
      throw new NotFoundException({
        code: 'PLAYBOOK_NOT_FOUND',
        message: 'Playbook not found',
      });
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
