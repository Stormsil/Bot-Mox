import {
  playbookCreateSchema,
  playbookUpdateSchema,
  playbookValidateBodySchema,
} from '@botmox/api-contract';
import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Param,
  Post,
  Put,
  Req,
  UnprocessableEntityException,
} from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { TenantCrudControllerCoreBase } from '../common/tenant-crud.controller-core-base';
import { buildTrimmedIdSchema, parseWithZodOrBadRequest } from '../common/zod-http-parse';
import { PlaybooksService } from './playbooks.service';

const playbookIdSchema = buildTrimmedIdSchema('Playbook id');

@Controller('playbooks')
export class PlaybooksController extends TenantCrudControllerCoreBase<
  {
    name: string;
    is_default?: boolean;
    content: string;
  },
  z.infer<typeof playbookUpdateSchema>
> {
  constructor(private readonly playbooksService: PlaybooksService) {
    super();
  }

  protected parseId(id: string): string {
    return parseWithZodOrBadRequest(playbookIdSchema, String(id || ''), {
      code: 'PLAYBOOK_INVALID_ID',
      message: 'Invalid playbook id',
    });
  }

  protected parseCreateBody(body: unknown): {
    name: string;
    is_default?: boolean;
    content: string;
  } {
    return parseWithZodOrBadRequest(playbookCreateSchema, body ?? {}, {
      code: 'PLAYBOOK_INVALID_CREATE_BODY',
      message: 'Invalid playbook create payload',
    });
  }

  protected parseUpdateBody(body: unknown): z.infer<typeof playbookUpdateSchema> {
    return parseWithZodOrBadRequest(playbookUpdateSchema, body ?? {}, {
      code: 'PLAYBOOK_INVALID_UPDATE_BODY',
      message: 'Invalid playbook update payload',
    });
  }

  private parseValidateBody(body: unknown): {
    content: string;
  } {
    return parseWithZodOrBadRequest(playbookValidateBodySchema, body ?? {}, {
      code: 'PLAYBOOK_INVALID_VALIDATE_BODY',
      message: 'Invalid playbook validate payload',
    });
  }

  protected getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'PLAYBOOK_NOT_FOUND',
      message: 'Playbook not found',
    };
  }

  protected getEntityById(id: string, tenantId: string) {
    return this.playbooksService.getById(id, tenantId);
  }

  protected createEntity(
    body: { name: string; is_default?: boolean; content: string },
    _explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.playbooksService.create(body, tenantId);
  }

  protected updateEntity(id: string, body: z.infer<typeof playbookUpdateSchema>, tenantId: string) {
    return this.playbooksService.update(id, body, tenantId);
  }

  protected removeEntity(id: string, tenantId: string) {
    return this.playbooksService.remove(id, tenantId);
  }

  protected override buildDeleteResponseData(): unknown {
    return { deleted: true };
  }

  protected override async beforeCreate(body: {
    name: string;
    is_default?: boolean;
    content: string;
  }): Promise<void> {
    const validation = this.playbooksService.validate(body.content);
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

  protected override async beforeUpdate(
    _id: string,
    body: z.infer<typeof playbookUpdateSchema>,
  ): Promise<void> {
    if (typeof body.content !== 'string') {
      return;
    }
    const validation = this.playbooksService.validate(body.content);
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

  @Get()
  async list(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown[];
  }> {
    return this.listCore(authorization, req, async (tenantId) => ({
      success: true,
      data: await this.playbooksService.list(tenantId),
    }));
  }

  @Get(':id')
  async getOne(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.getOneCore(authorization, id, req);
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.createCore(authorization, body, req);
  }

  @Put(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.updateCore(authorization, id, body, req);
  }

  @Delete(':id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { deleted: boolean } }> {
    return this.removeCore(authorization, id, req) as Promise<{
      success: true;
      data: { deleted: boolean };
    }>;
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
