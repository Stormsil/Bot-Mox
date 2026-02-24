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
  Param,
  Patch,
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

  @Get('theme')
  async getTheme(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return { success: true, data: await this.settingsService.getTheme(identity.tenantId) };
  }

  @Put('theme')
  async updateTheme(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return { success: true, data: await this.settingsService.updateTheme(body, identity.tenantId) };
  }

  @Get('projects')
  async getProjects(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return { success: true, data: await this.settingsService.getProjects(identity.tenantId) };
  }

  @Put('projects/:id')
  async upsertProject(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.upsertProject(id, body, identity.tenantId),
    };
  }

  @Patch('projects')
  async patchProjects(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.patchProjects(body, identity.tenantId),
    };
  }

  @Get('ui/resource_tree')
  async getResourceTree(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.getResourceTree(identity.tenantId),
    };
  }

  @Put('ui/resource_tree')
  async updateResourceTree(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.updateResourceTree(body, identity.tenantId),
    };
  }

  @Get('alerts')
  async getAlerts(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return { success: true, data: await this.settingsService.getAlerts(identity.tenantId) };
  }

  @Put('alerts')
  async updateAlerts(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.updateAlerts(body, identity.tenantId),
    };
  }

  @Get('storage_policy')
  async getStoragePolicy(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.getStoragePolicy(identity.tenantId),
    };
  }

  @Put('storage_policy')
  async updateStoragePolicy(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.updateStoragePolicy(body, identity.tenantId),
    };
  }

  @Get('vmgenerator')
  async getVmGenerator(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return { success: true, data: await this.settingsService.getVmGenerator(identity.tenantId) };
  }

  @Put('vmgenerator')
  async updateVmGenerator(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.updateVmGenerator(body, identity.tenantId),
    };
  }

  @Get('vmgenerator/task_logs')
  async getVmGeneratorTaskLogs(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.getVmGeneratorTaskLogs(identity.tenantId),
    };
  }

  @Put('vmgenerator/task_logs')
  async updateVmGeneratorTaskLogs(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    this.ensureAuthHeader(authorization);
    const identity = getRequestIdentity(req);
    return {
      success: true,
      data: await this.settingsService.updateVmGeneratorTaskLogs(body, identity.tenantId),
    };
  }
}
