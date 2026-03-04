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
import { Transform } from 'class-transformer';
import { IsString, MinLength } from 'class-validator';
import type { Request } from 'express';
import { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import {
  createBadRequestValidationPipe,
  ZodSchemaValidationPipe,
} from '../common/http-validation.util';
import { buildTrimmedIdSchema } from '../common/zod-http-parse';
import { PlaybooksService } from './playbooks.service';

const playbookIdSchema = buildTrimmedIdSchema('Playbook id');
const playbookIdParamPipe = createBadRequestValidationPipe(
  'PLAYBOOK_INVALID_ID',
  'Invalid playbook id',
);
const playbookCreateBodyPipe = new ZodSchemaValidationPipe(
  playbookCreateSchema,
  'PLAYBOOK_INVALID_CREATE_BODY',
  'Invalid playbook create payload',
);
const playbookUpdateBodyPipe = new ZodSchemaValidationPipe(
  playbookUpdateSchema,
  'PLAYBOOK_INVALID_UPDATE_BODY',
  'Invalid playbook update payload',
);
const playbookValidateBodyPipe = new ZodSchemaValidationPipe(
  playbookValidateBodySchema,
  'PLAYBOOK_INVALID_VALIDATE_BODY',
  'Invalid playbook validate payload',
);

class PlaybookIdParamDto {
  @Transform(({ value }) => String(value ?? '').trim())
  @IsString()
  @MinLength(1)
  id!: string;
}

@Controller('playbooks')
export class PlaybooksController {
  constructor(private readonly playbooksService: PlaybooksService) {
    // no-op
  }

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private getTenantId(req: Request): string {
    return getRequestIdentity(req).tenantId;
  }

  private getExplicitIdFromBody(body: Record<string, unknown>): string | undefined {
    return typeof body.id === 'string' ? body.id.trim() : undefined;
  }

  private buildDeleteResponseData(): { deleted: boolean } {
    return { deleted: true };
  }

  private getNotFoundPayload(): { code: string; message: string } {
    return {
      code: 'PLAYBOOK_NOT_FOUND',
      message: 'Playbook not found',
    };
  }

  private parseWithSchema<T>(
    schema: {
      safeParse: (
        value: unknown,
      ) => { success: true; data: T } | { success: false; error: { flatten: () => unknown } };
    },
    value: unknown,
    code: string,
    message: string,
  ): T {
    const parsed = schema.safeParse(value);
    if (!parsed.success) {
      throw new BadRequestException({
        code,
        message,
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private async beforeCreate(body: {
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

  private async beforeUpdate(
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

  private async getOneCore(
    authorization: string | undefined,
    id: string,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const entity = await this.getEntityById(parsedId, tenantId);
    if (!entity) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: entity };
  }

  private async listCore<TResponse>(
    authorization: string | undefined,
    req: Request,
    run: (tenantId: string) => Promise<TResponse>,
  ): Promise<TResponse> {
    this.ensureAuthHeader(authorization);
    return run(this.getTenantId(req));
  }

  private async createCore(
    authorization: string | undefined,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedBody = this.parseCreateBody(body);
    const tenantId = this.getTenantId(req);
    await this.beforeCreate(parsedBody);
    return {
      success: true,
      data: await this.createEntity(parsedBody, this.getExplicitIdFromBody(parsedBody), tenantId),
    };
  }

  private async updateCore(
    authorization: string | undefined,
    id: string,
    body: unknown,
    req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const parsedBody = this.parseUpdateBody(body);
    const tenantId = this.getTenantId(req);
    await this.beforeUpdate(parsedId, parsedBody);
    const updated = await this.updateEntity(parsedId, parsedBody, tenantId);
    if (!updated) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: updated };
  }

  private async removeCore(
    authorization: string | undefined,
    id: string,
    req: Request,
  ): Promise<{ success: true; data: { deleted: boolean } }> {
    this.ensureAuthHeader(authorization);
    const parsedId = this.parseId(id);
    const tenantId = this.getTenantId(req);
    const deleted = await this.removeEntity(parsedId, tenantId);
    if (!deleted) {
      throw new NotFoundException(this.getNotFoundPayload());
    }
    return { success: true, data: this.buildDeleteResponseData() };
  }

  private parseId(id: string): string {
    return this.parseWithSchema(
      playbookIdSchema,
      String(id || ''),
      'PLAYBOOK_INVALID_ID',
      'Invalid playbook id',
    );
  }

  private parseCreateBody(body: unknown): {
    name: string;
    is_default?: boolean;
    content: string;
  } {
    return this.parseWithSchema(
      playbookCreateSchema,
      body ?? {},
      'PLAYBOOK_INVALID_CREATE_BODY',
      'Invalid playbook create payload',
    );
  }

  private parseUpdateBody(body: unknown): z.infer<typeof playbookUpdateSchema> {
    return this.parseWithSchema(
      playbookUpdateSchema,
      body ?? {},
      'PLAYBOOK_INVALID_UPDATE_BODY',
      'Invalid playbook update payload',
    );
  }

  private getEntityById(id: string, tenantId: string) {
    return this.playbooksService.getById(id, tenantId);
  }

  private createEntity(
    body: { name: string; is_default?: boolean; content: string },
    _explicitId: string | undefined,
    tenantId: string,
  ) {
    return this.playbooksService.create(body, tenantId);
  }

  private updateEntity(id: string, body: z.infer<typeof playbookUpdateSchema>, tenantId: string) {
    return this.playbooksService.update(id, body, tenantId);
  }

  private removeEntity(id: string, tenantId: string) {
    return this.playbooksService.remove(id, tenantId);
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
    @Param(playbookIdParamPipe) params: PlaybookIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.getOneCore(authorization, typeof params === 'string' ? params : params.id, req);
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body(playbookCreateBodyPipe) body: { name: string; is_default?: boolean; content: string },
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.createCore(authorization, body, req);
  }

  @Put(':id')
  async update(
    @Headers('authorization') authorization: string | undefined,
    @Param(playbookIdParamPipe) params: PlaybookIdParamDto | string,
    @Body(playbookUpdateBodyPipe) body: z.infer<typeof playbookUpdateSchema>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.updateCore(
      authorization,
      typeof params === 'string' ? params : params.id,
      body,
      req,
    );
  }

  @Delete(':id')
  async remove(
    @Headers('authorization') authorization: string | undefined,
    @Param(playbookIdParamPipe) params: PlaybookIdParamDto | string,
    @Req() req: Request,
  ): Promise<{ success: true; data: { deleted: boolean } }> {
    return this.removeCore(
      authorization,
      typeof params === 'string' ? params : params.id,
      req,
    ) as Promise<{
      success: true;
      data: { deleted: boolean };
    }>;
  }

  @Post('validate')
  validate(
    @Headers('authorization') authorization: string | undefined,
    @Body(playbookValidateBodyPipe) body: { content: string },
  ): {
    success: true;
    data: {
      valid: boolean;
      errors: Array<{ path?: string; message: string }>;
      warnings: Array<{ message: string }>;
    };
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.playbooksService.validate(body.content),
    };
  }
}
