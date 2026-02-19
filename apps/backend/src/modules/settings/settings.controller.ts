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
  UnauthorizedException,
} from '@nestjs/common';
import { SettingsService } from './settings.service';

@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  private ensureAuthHeader(authorization: string | undefined): void {
    if (!authorization) {
      throw new UnauthorizedException('Missing bearer token');
    }
  }

  private parseApiKeysBody(
    body: unknown,
  ): import('zod').infer<typeof settingsApiKeysMutationSchema> {
    const parsed = settingsApiKeysMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseProxyBody(body: unknown): import('zod').infer<typeof settingsProxyMutationSchema> {
    const parsed = settingsProxyMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  private parseNotificationEventsBody(
    body: unknown,
  ): import('zod').infer<typeof settingsNotificationEventsMutationSchema> {
    const parsed = settingsNotificationEventsMutationSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
    }
    return parsed.data;
  }

  @Get('api_keys')
  getApiKeys(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.settingsService.getApiKeys(),
    };
  }

  @Put('api_keys')
  updateApiKeys(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    const parsed = this.parseApiKeysBody(body);
    return {
      success: true,
      data: this.settingsService.updateApiKeys(parsed),
    };
  }

  @Get('proxy')
  getProxy(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.settingsService.getProxy(),
    };
  }

  @Put('proxy')
  updateProxy(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    const parsed = this.parseProxyBody(body);
    return {
      success: true,
      data: this.settingsService.updateProxy(parsed),
    };
  }

  @Get('notifications/events')
  getNotificationEvents(@Headers('authorization') authorization: string | undefined): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    return {
      success: true,
      data: this.settingsService.getNotificationEvents(),
    };
  }

  @Put('notifications/events')
  updateNotificationEvents(
    @Headers('authorization') authorization: string | undefined,
    @Body() body: unknown,
  ): {
    success: true;
    data: unknown;
  } {
    this.ensureAuthHeader(authorization);
    const parsed = this.parseNotificationEventsBody(body);
    return {
      success: true,
      data: this.settingsService.updateNotificationEvents(parsed),
    };
  }
}
