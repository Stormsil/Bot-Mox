import { Injectable } from '@nestjs/common';

@Injectable()
export class ObservabilityService {
  private parseBoolean(value: unknown, fallback = false): boolean {
    if (value === undefined || value === null || value === '') {
      return fallback;
    }

    const normalized = String(value).trim().toLowerCase();
    return ['1', 'true', 'yes', 'on'].includes(normalized);
  }

  private resolveOtlpTracesEndpoint(): string {
    const explicitTracesEndpoint = String(
      process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '',
    ).trim();
    if (explicitTracesEndpoint) {
      return explicitTracesEndpoint;
    }

    const base = String(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '')
      .trim()
      .replace(/\/+$/, '');
    if (base) {
      return `${base}/v1/traces`;
    }

    return 'http://localhost:4318/v1/traces';
  }

  isOtelProxyEnabled(): boolean {
    return this.parseBoolean(process.env.BOTMOX_OTEL_PROXY_ENABLED, false);
  }

  async proxyOtelTraces(input: {
    contentType: string;
    body: Buffer;
  }): Promise<{ status: number; contentType: string; body: Buffer }> {
    const targetUrl = this.resolveOtlpTracesEndpoint();

    const upstream = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'content-type': input.contentType || 'application/x-protobuf',
      },
      body: new Uint8Array(input.body),
    });

    const responseBody = Buffer.from(await upstream.arrayBuffer());

    return {
      status: upstream.status,
      contentType: upstream.headers.get('content-type') || 'application/json',
      body: responseBody,
    };
  }

  getTraceSnapshot(headers: Record<string, unknown>): {
    timestamp: string;
    node_env: string;
    received: {
      traceparent: string | null;
      tracestate: string | null;
      baggage: string | null;
      correlation_id: string | null;
    };
    active: {
      trace_id: string | null;
      span_id: string | null;
    };
    response_headers: {
      x_trace_id: string | null;
      x_span_id: string | null;
      x_correlation_id: string | null;
    };
  } {
    return {
      timestamp: new Date().toISOString(),
      node_env: String(process.env.NODE_ENV || 'development'),
      received: {
        traceparent: String(headers.traceparent || '').trim() || null,
        tracestate: String(headers.tracestate || '').trim() || null,
        baggage: String(headers.baggage || '').trim() || null,
        correlation_id: String(headers['x-correlation-id'] || '').trim() || null,
      },
      active: {
        trace_id: null,
        span_id: null,
      },
      response_headers: {
        x_trace_id: null,
        x_span_id: null,
        x_correlation_id: null,
      },
    };
  }

  ingestClientLogs(body: { events: unknown[] }): { accepted: number; dropped: number } {
    const accepted = body.events.length;
    return {
      accepted,
      dropped: 0,
    };
  }
}
