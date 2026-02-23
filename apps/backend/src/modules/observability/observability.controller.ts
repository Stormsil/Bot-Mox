import { clientLogsIngestSchema, diagnosticsTraceResponseSchema } from '@botmox/api-contract';
import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { AuthService } from '../auth/auth.service';
import { getRequestIdentity } from '../auth/request-identity.util';
import { ObservabilityService } from './observability.service';
import { RuntimeMetricsService } from './runtime-metrics.service';

@Controller()
export class ObservabilityController {
  constructor(
    private readonly observabilityService: ObservabilityService,
    private readonly runtimeMetricsService: RuntimeMetricsService,
    private readonly authService: AuthService,
  ) {}

  @Get('diag/trace')
  getTrace(@Headers() headers: Record<string, unknown>): { success: true; data: unknown } {
    const snapshot = this.observabilityService.getTraceSnapshot(headers);
    const parsed = diagnosticsTraceResponseSchema.safeParse(snapshot);
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'OBSERVABILITY_INVALID_TRACE_RESPONSE',
        message: 'Invalid diagnostics trace response payload',
        details: parsed.error.flatten(),
      });
    }
    return {
      success: true,
      data: parsed.data,
    };
  }

  @Post('client-logs')
  ingestClientLogs(@Body() body: unknown): { success: true; data: unknown } {
    const parsed = clientLogsIngestSchema.safeParse(body ?? {});
    if (!parsed.success) {
      throw new BadRequestException({
        code: 'OBSERVABILITY_INVALID_CLIENT_LOGS_BODY',
        message: 'Invalid client logs ingest payload',
        details: parsed.error.flatten(),
      });
    }
    const result = this.observabilityService.ingestClientLogs(parsed.data);
    return {
      success: true,
      data: result,
    };
  }

  @Post('otel/v1/traces')
  async proxyOtelTraces(@Req() req: Request, @Res() res: Response): Promise<void> {
    if (!this.observabilityService.isOtelProxyEnabled()) {
      res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Not found',
        },
      });
      return;
    }

    const contentType = String(req.headers['content-type'] || 'application/x-protobuf');
    const rawBody = req.body;
    const body = Buffer.isBuffer(rawBody)
      ? rawBody
      : rawBody === undefined || rawBody === null
        ? Buffer.alloc(0)
        : Buffer.from(String(rawBody));

    try {
      const proxied = await this.observabilityService.proxyOtelTraces({
        contentType,
        body,
      });
      res.status(proxied.status);
      res.setHeader('content-type', proxied.contentType);
      res.send(proxied.body);
    } catch {
      res.status(502).json({
        success: false,
        error: {
          code: 'OTLP_PROXY_FAILED',
          message: 'Failed to proxy OTLP traces',
        },
      });
    }
  }

  @Get('diag/runtime-metrics')
  getRuntimeMetrics(
    @Headers('authorization') authorization: string | undefined,
    @Req() req: Request,
  ): { success: true; data: unknown } {
    if (!authorization) {
      throw new UnauthorizedException({
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
    }
    const identity = getRequestIdentity(req);
    if (!this.authService.isAdmin(identity.roles)) {
      throw new UnauthorizedException({
        code: 'AUTH_ADMIN_ROLE_REQUIRED',
        message: 'Admin role is required',
      });
    }

    const headers = (req.headers || {}) as Record<string, unknown>;
    const forwarded = headers['x-forwarded-for'];
    const fromForwarded = Array.isArray(forwarded)
      ? String(forwarded[0] || '')
          .split(',')[0]
          ?.trim()
      : String(forwarded || '')
          .split(',')[0]
          ?.trim();
    const clientIp = String(fromForwarded || req.ip || 'unknown')
      .trim()
      .toLowerCase();
    this.authService.enforceAdminRateLimit?.({
      action: 'diag.runtime-metrics.read',
      clientIp,
      actorUserId: identity.userId,
      principal: identity.tenantId,
    });

    return {
      success: true,
      data: this.runtimeMetricsService.snapshot(),
    };
  }
}
