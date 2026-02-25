import {
  secretBindingCreateSchema,
  secretBindingsListQuerySchema,
  secretCreateSchema,
  secretRotateSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { type ZodType, z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { SecretsService } from './secrets.service';

const secretIdPathSchema = z.object({
  id: z.string().trim().min(1),
});

@Controller('secrets')
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  private success<T>(data: T): { success: true; data: T } {
    return { success: true, data };
  }

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private getTenantId(authorization: string | undefined, req: Request): string {
    this.ensureAuthorization(authorization);
    return getRequestIdentity(req).tenantId;
  }

  private parseWithSchema<TSchema extends ZodType>(
    schema: TSchema,
    input: unknown,
    code: string,
    message: string,
  ): z.output<TSchema> {
    const parsed = schema.safeParse(input ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code,
        message,
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private notFoundSecret(): never {
    throw new NotFoundException({
      code: 'SECRET_NOT_FOUND',
      message: 'Secret not found',
    });
  }

  private parseSecretId(id: string): string {
    return this.parseWithSchema(
      secretIdPathSchema,
      { id },
      'SECRETS_INVALID_ID',
      'Invalid secret id',
    ).id;
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const parsed = this.parseWithSchema(
      secretCreateSchema,
      body,
      'SECRETS_INVALID_CREATE_BODY',
      'Invalid secret create payload',
    );
    const tenantId = this.getTenantId(authorization, req);
    const created = await this.secretsService.createSecret({
      tenantId,
      label: parsed.label,
      ciphertext: parsed.ciphertext,
      alg: parsed.alg,
      keyId: parsed.key_id,
      nonce: parsed.nonce,
      aadMeta: parsed.aad_meta,
    });

    return this.success(created);
  }

  @Get(':id/meta')
  async getMeta(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const parsedId = this.parseSecretId(id);
    const tenantId = this.getTenantId(authorization, req);
    const record = await this.secretsService.getSecretMeta(tenantId, parsedId);
    if (!record) {
      this.notFoundSecret();
    }
    return this.success(record);
  }

  @Post(':id/rotate')
  async rotate(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const parsedId = this.parseSecretId(id);
    const parsedBody = this.parseWithSchema(
      secretRotateSchema,
      body,
      'SECRETS_INVALID_ROTATE_BODY',
      'Invalid secret rotate payload',
    );
    const tenantId = this.getTenantId(authorization, req);
    const record = await this.secretsService.rotateSecret({
      tenantId,
      id: parsedId,
      ciphertext: parsedBody.ciphertext,
      alg: parsedBody.alg,
      keyId: parsedBody.key_id,
      nonce: parsedBody.nonce,
      aadMeta: parsedBody.aad_meta,
    });
    if (!record) {
      this.notFoundSecret();
    }
    return this.success(record);
  }

  @Post('bindings')
  async createBinding(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const parsed = this.parseWithSchema(
      secretBindingCreateSchema,
      body,
      'SECRETS_INVALID_BINDING_CREATE_BODY',
      'Invalid secret binding create payload',
    );
    const tenantId = this.getTenantId(authorization, req);
    const binding = await this.secretsService.createBinding({
      tenantId,
      scopeType: parsed.scope_type,
      scopeId: parsed.scope_id,
      secretRef: parsed.secret_ref,
      fieldName: parsed.field_name,
    });
    return this.success(binding);
  }

  @Get('bindings')
  async listBindings(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const parsed = this.parseWithSchema(
      secretBindingsListQuerySchema,
      query,
      'SECRETS_INVALID_BINDINGS_LIST_QUERY',
      'Invalid secret bindings list query',
    );
    const tenantId = this.getTenantId(authorization, req);
    const bindings = await this.secretsService.listBindings({
      tenantId,
      scopeType: parsed.scope_type,
      scopeId: parsed.scope_id,
    });
    return this.success(bindings);
  }
}
