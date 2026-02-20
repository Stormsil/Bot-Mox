import {
  settingsApiKeysMutationSchema,
  settingsNotificationEventsMutationSchema,
  settingsProxyMutationSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { getRequestIdentity } from '../auth/request-identity.util';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
  }

  private parseApiKeysBody(
    body: unknown,
  ): import('zod').infer<typeof settingsApiKeysMutationSchema> {
    const parsed = settingsApiKeysMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'SETTINGS_INVALID_API_KEYS_BODY',
        message: 'Invalid settings api_keys payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseProxyBody(body: unknown): import('zod').infer<typeof settingsProxyMutationSchema> {
    const parsed = settingsProxyMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'SETTINGS_INVALID_PROXY_BODY',
        message: 'Invalid settings proxy payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseNotificationEventsBody(
    body: unknown,
  ): import('zod').infer<typeof settingsNotificationEventsMutationSchema> {
    const parsed = settingsNotificationEventsMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'SETTINGS_INVALID_NOTIFICATION_EVENTS_BODY',
        message: 'Invalid settings notification events payload',
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  @Get('api_keys')
  async getApiKeys(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.getApiKeys(identity.tenantId),
    };
  }

  @Put('api_keys')
  async updateApiKeys(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    this.ensureAuthHeader(authorization);
    const parsed = this.parseApiKeysBody(body);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.updateApiKeys(parsed, identity.tenantId),
    };
  }

  @Get('proxy')
  async getProxy(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.getProxy(identity.tenantId),
    };
  }

  @Put('proxy')
  async updateProxy(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    this.ensureAuthHeader(authorization);
    const parsed = this.parseProxyBody(body);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.updateProxy(parsed, identity.tenantId),
    };
  }

  @Get('notifications/events')
  async getNotificationEvents(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.getNotificationEvents(identity.tenantId),
    };
  }

  @Put('notifications/events')
  async updateNotificationEvents(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    this.ensureAuthHeader(authorization);
    const parsed = this.parseNotificationEventsBody(body);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.updateNotificationEvents(parsed, identity.tenantId),
    };
  }
}
