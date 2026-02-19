import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  summary(): { success: true; data: { service: string; timestamp: string; data_backend: string } } {
    return {
      success: true,
      data: {
        service: 'botmox-api',
        timestamp: new Date().toISOString(),
        data_backend: 'supabase',
      },
    };
  }

  @Get('live')
  live(): { success: true; data: { status: 'live'; ts: string } } {
    return {
      success: true,
      data: {
        status: 'live',
        ts: new Date().toISOString(),
      },
    };
  }

  @Get('ready')
  ready(): { success: true; data: { ready: true; ts: string } } {
    return {
      success: true,
      data: {
        ready: true,
        ts: new Date().toISOString(),
      },
    };
  }
}
