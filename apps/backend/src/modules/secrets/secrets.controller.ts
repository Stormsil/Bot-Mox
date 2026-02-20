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
import { z } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { SecretsService } from './secrets.service';

const secretIdPathSchema = z.object({
  id: z.string().trim().min(1),
});

@Controller('secrets')
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseSecretId(id: string): string {
    const parsed = secretIdPathSchema.safeParse({ id });
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'SECRETS_INVALID_ID',
        message: 'Invalid secret id',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data.id;
  }

  @Post()
  async create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);

    const parsed = secretCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'SECRETS_INVALID_CREATE_BODY',
        message: 'Invalid secret create payload',
        details: parsed.error.flatten(),
      });
    }

    const identity = getRequestIdentity(req);
    const created = await this.secretsService.createSecret({
      tenantId: identity.tenantId,
      label: parsed.data.label,
      ciphertext: parsed.data.ciphertext,
      alg: parsed.data.alg,
      keyId: parsed.data.key_id,
      nonce: parsed.data.nonce,
      aadMeta: parsed.data.aad_meta,
    });

    return {
      success: true,
      data: created,
    };
  }

  @Get(':id/meta')
  async getMeta(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const parsedId = this.parseSecretId(id);
    const identity = getRequestIdentity(req);
    const record = await this.secretsService.getSecretMeta(identity.tenantId, parsedId);
    if (!record) {
      throw new NotFoundException({
        code: 'SECRET_NOT_FOUND',
        message: 'Secret not found',
      });
    }
    return {
      success: true,
      data: record,
    };
  }

  @Post(':id/rotate')
  async rotate(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);
    const parsedId = this.parseSecretId(id);

    const parsedBody = secretRotateSchema.safeParse(body ?? {});
    if (!parsedBody.success) {
      throw new BadRequestException({
        code: 'SECRETS_INVALID_ROTATE_BODY',
        message: 'Invalid secret rotate payload',
        details: parsedBody.error.flatten(),
      });
    }

    const identity = getRequestIdentity(req);
    const record = await this.secretsService.rotateSecret({
      tenantId: identity.tenantId,
      id: parsedId,
      ciphertext: parsedBody.data.ciphertext,
      alg: parsedBody.data.alg,
      keyId: parsedBody.data.key_id,
      nonce: parsedBody.data.nonce,
      aadMeta: parsedBody.data.aad_meta,
    });
    if (!record) {
      throw new NotFoundException({
        code: 'SECRET_NOT_FOUND',
        message: 'Secret not found',
      });
    }
    return {
      success: true,
      data: record,
    };
  }

  @Post('bindings')
  async createBinding(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);

    const parsed = secretBindingCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'SECRETS_INVALID_BINDING_CREATE_BODY',
        message: 'Invalid secret binding create payload',
        details: parsed.error.flatten(),
      });
    }

    const identity = getRequestIdentity(req);
    const binding = await this.secretsService.createBinding({
      tenantId: identity.tenantId,
      scopeType: parsed.data.scope_type,
      scopeId: parsed.data.scope_id,
      secretRef: parsed.data.secret_ref,
      fieldName: parsed.data.field_name,
    });

    return {
      success: true,
      data: binding,
    };
  }

  @Get('bindings')
  async listBindings(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthorization(authorization);

    const parsed = secretBindingsListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'SECRETS_INVALID_BINDINGS_LIST_QUERY',
        message: 'Invalid secret bindings list query',
        details: parsed.error.flatten(),
      });
    }

    const identity = getRequestIdentity(req);
    const bindings = await this.secretsService.listBindings({
      tenantId: identity.tenantId,
      scopeType: parsed.data.scope_type,
      scopeId: parsed.data.scope_id,
    });

    return {
      success: true,
      data: bindings,
    };
  }
}
