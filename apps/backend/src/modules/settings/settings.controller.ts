import {
  settingsApiKeysMutationSchema,
  settingsNotificationEventsMutationSchema,
  settingsProxyMutationSchema,
  settingsScheduleGenerateSchema,
} from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Patch,
  Post,
  Put,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import type { ZodType } from 'zod';
import { getRequestIdentity } from '../auth/request-identity.util';
import { ScheduleValidationError, SettingsService } from './settings.service';

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

  private success<T>(data: T): { success: true; data: T } {
    return { success: true, data };
  }

  private getTenantIdFromRequest(authorization: string | undefined, req: Request): string {
    this.ensureAuthHeader(authorization);
    return getRequestIdentity(req).tenantId;
  }

  private async withTenant<T>(
    authorization: string | undefined,
    req: Request,
    action: (tenantId: string) => Promise<T> | T,
  ): Promise<T> {
    const tenantId = this.getTenantIdFromRequest(authorization, req);
    return await action(tenantId);
  }

  private async readWithTenant(
    authorization: string | undefined,
    req: Request,
    action: (tenantId: string) => Promise<unknown> | unknown,
  ): Promise<{ success: true; data: unknown }> {
    return this.success(await this.withTenant(authorization, req, action));
  }

  private async writeWithTenant<TParsed>(
    authorization: string | undefined,
    body: unknown,
    req: Request,
    parse: (input: unknown) => TParsed,
    action: (parsed: TParsed, tenantId: string) => Promise<unknown> | unknown,
  ): Promise<{ success: true; data: unknown }> {
    const parsed = parse(body);
    return this.success(
      await this.withTenant(authorization, req, (tenantId) => action(parsed, tenantId)),
    );
  }

  private parseWithSchema<T>(schema: ZodType<T>, body: unknown, code: string, message: string): T {
    const parsed = schema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code,
        message,
        details: parsed.error.flatten(),
      });
    }
    return parsed.data;
  }

  private parseProxyBody(body: unknown): import('zod').infer<typeof settingsProxyMutationSchema> {
    return this.parseWithSchema(
      settingsProxyMutationSchema,
      body,
      'SETTINGS_INVALID_PROXY_BODY',
      'Invalid settings proxy payload',
    );
  }

  private parseNotificationEventsBody(
    body: unknown,
  ): import('zod').infer<typeof settingsNotificationEventsMutationSchema> {
    return this.parseWithSchema(
      settingsNotificationEventsMutationSchema,
      body,
      'SETTINGS_INVALID_NOTIFICATION_EVENTS_BODY',
      'Invalid settings notification events payload',
    );
  }

  private parseApiKeysBody(
    body: unknown,
  ): import('zod').infer<typeof settingsApiKeysMutationSchema> {
    return this.parseWithSchema(
      settingsApiKeysMutationSchema,
      body,
      'SETTINGS_INVALID_API_KEYS_BODY',
      'Invalid settings api_keys payload',
    );
  }

  private parseScheduleGenerateBody(
    body: unknown,
  ): import('zod').infer<typeof settingsScheduleGenerateSchema> {
    return this.parseWithSchema(
      settingsScheduleGenerateSchema,
      body ?? {},
      'SETTINGS_INVALID_SCHEDULE_GENERATE_BODY',
      'Invalid settings schedule generate payload',
    );
  }

  @Get('api_keys')
  async getApiKeys(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getApiKeys(tenantId),
    );
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
    return this.writeWithTenant(
      authorization,
      body,
      req,
      this.parseApiKeysBody.bind(this),
      (parsed, tenantId) => this.settingsService.updateApiKeys(parsed, tenantId),
    );
  }

  @Get('proxy')
  async getProxy(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getProxy(tenantId),
    );
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
    return this.writeWithTenant(
      authorization,
      body,
      req,
      this.parseProxyBody.bind(this),
      (parsed, tenantId) => this.settingsService.updateProxy(parsed, tenantId),
    );
  }

  @Get('notifications/events')
  async getNotificationEvents(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{
    success: true;
    data: unknown;
  }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getNotificationEvents(tenantId),
    );
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
    return this.writeWithTenant(
      authorization,
      body,
      req,
      this.parseNotificationEventsBody.bind(this),
      (parsed, tenantId) => this.settingsService.updateNotificationEvents(parsed, tenantId),
    );
  }

  @Get('theme')
  async getTheme(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getTheme(tenantId),
    );
  }

  @Put('theme')
  async updateTheme(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.writeWithTenant(
      authorization,
      body,
      req,
      (input) => input,
      (parsed, tenantId) => this.settingsService.updateTheme(parsed, tenantId),
    );
  }

  @Get('projects')
  async getProjects(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getProjects(tenantId),
    );
  }

  @Put('projects/:id')
  async upsertProject(
    @Headers('authorization') authorization: string | undefined,
    @Param('id') id: string,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.upsertProject(id, body, tenantId),
    );
  }

  @Patch('projects')
  async patchProjects(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.patchProjects(body, tenantId),
    );
  }

  @Get('ui/resource_tree')
  async getResourceTree(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getResourceTree(tenantId),
    );
  }

  @Put('ui/resource_tree')
  async updateResourceTree(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.writeWithTenant(
      authorization,
      body,
      req,
      (input) => input,
      (parsed, tenantId) => this.settingsService.updateResourceTree(parsed, tenantId),
    );
  }

  @Get('alerts')
  async getAlerts(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getAlerts(tenantId),
    );
  }

  @Put('alerts')
  async updateAlerts(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.writeWithTenant(
      authorization,
      body,
      req,
      (input) => input,
      (parsed, tenantId) => this.settingsService.updateAlerts(parsed, tenantId),
    );
  }

  @Post('schedule/generate')
  async generateSchedule(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    const parsedBody = this.parseScheduleGenerateBody(body);

    return this.readWithTenant(authorization, req, (tenantId) => {
      try {
        return this.settingsService.generateScheduleFromRequest(parsedBody, tenantId);
      } catch (error) {
        if (error instanceof ScheduleValidationError) {
          throw new BadRequestException({
            code: 'SETTINGS_INVALID_SCHEDULE_GENERATION_PARAMS',
            message: 'Invalid settings schedule generation params',
            details: {
              errors: error.errors,
            },
          });
        }
        throw error;
      }
    });
  }

  @Get('storage_policy')
  async getStoragePolicy(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getStoragePolicy(tenantId),
    );
  }

  @Put('storage_policy')
  async updateStoragePolicy(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.writeWithTenant(
      authorization,
      body,
      req,
      (input) => input,
      (parsed, tenantId) => this.settingsService.updateStoragePolicy(parsed, tenantId),
    );
  }

  @Get('vmgenerator')
  async getVmGenerator(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getVmGenerator(tenantId),
    );
  }

  @Put('vmgenerator')
  async updateVmGenerator(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.writeWithTenant(
      authorization,
      body,
      req,
      (input) => input,
      (parsed, tenantId) => this.settingsService.updateVmGenerator(parsed, tenantId),
    );
  }

  @Get('vmgenerator/task_logs')
  async getVmGeneratorTaskLogs(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.readWithTenant(authorization, req, (tenantId) =>
      this.settingsService.getVmGeneratorTaskLogs(tenantId),
    );
  }

  @Put('vmgenerator/task_logs')
  async updateVmGeneratorTaskLogs(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
    @Req() req: Request,
  ): Promise<{ success: true; data: unknown }> {
    return this.writeWithTenant(
      authorization,
      body,
      req,
      (input) => input,
      (parsed, tenantId) => this.settingsService.updateVmGeneratorTaskLogs(parsed, tenantId),
    );
  }
}
