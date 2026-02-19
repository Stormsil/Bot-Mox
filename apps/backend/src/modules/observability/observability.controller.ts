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
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { ObservabilityService } from './observability.service';

@Controller()
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('diag/trace')
  getTrace(@Headers() headers: Record<string, unknown>): { success: true; data: unknown } {
    const snapshot = this.observabilityService.getTraceSnapshot(headers);
    const parsed = diagnosticsTraceResponseSchema.safeParse(snapshot);
    if (!parsed.success) {
      throw new BadRequestException(parsed.error.flatten());
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
      throw new BadRequestException(parsed.error.flatten());
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
}
