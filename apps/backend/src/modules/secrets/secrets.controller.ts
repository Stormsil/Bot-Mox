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
  UnauthorizedException,
} from '@nestjs/common';
import { z } from 'zod';
import { SecretsService } from './secrets.service';

const secretIdPathSchema = z.object({
  id: z.string().trim().min(1),
});

@Controller('secrets')
export class SecretsController {
  constructor(private readonly secretsService: SecretsService) {}

  private ensureAuthorization(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseSecretId(id: string): string {
    const parsed = secretIdPathSchema.safeParse({ id });
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data.id;
  }

  @Post()
  create(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);

    const parsed = secretCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const created = this.secretsService.createSecret({
      tenantId: 'default',
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
  getMeta(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsedId = this.parseSecretId(id);
    const record = this.secretsService.getSecretMeta('default', parsedId);
    if (!record) {
      throw new NotFoundException('Secret not found');
    }
    return {
      success: true,
      data: record,
    };
  }

  @Post(':id/rotate')
  rotate(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);
    const parsedId = this.parseSecretId(id);

    const parsedBody = secretRotateSchema.safeParse(body ?? {});
    if (!parsedBody.success) {
      throw new BadRequestException(parsedBody.error.flatten());
    }

    const record = this.secretsService.rotateSecret({
      tenantId: 'default',
      id: parsedId,
      ciphertext: parsedBody.data.ciphertext,
      alg: parsedBody.data.alg,
      keyId: parsedBody.data.key_id,
      nonce: parsedBody.data.nonce,
      aadMeta: parsedBody.data.aad_meta,
    });
    if (!record) {
      throw new NotFoundException('Secret not found');
    }
    return {
      success: true,
      data: record,
    };
  }

  @Post('bindings')
  createBinding(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);

    const parsed = secretBindingCreateSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const binding = this.secretsService.createBinding({
      tenantId: 'default',
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
  listBindings(
    @Headers('authorization') authorization: string | undefined,
    @Query() query: Record<string, unknown>,
  ): { success: true; data: unknown } {
    this.ensureAuthorization(authorization);

    const parsed = secretBindingsListQuerySchema.safeParse(query ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }

    const bindings = this.secretsService.listBindings({
      tenantId: 'default',
      scopeType: parsed.data.scope_type,
      scopeId: parsed.data.scope_id,
    });

    return {
      success: true,
      data: bindings,
    };
  }
}
