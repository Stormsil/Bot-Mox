// Frontend OpenTelemetry bootstrap.
// Goal: propagate W3C trace context (traceparent/tracestate/baggage) from UI -> API,
// and optionally export browser spans via OTLP/HTTP (typically through backend proxy).

import type { SpanProcessor } from '@opentelemetry/sdk-trace-base';
import { API_BASE_URL } from '../config/env';
import { getRuntimeConfig, readRuntimeString } from '../config/runtime-config';
import { uiLogger } from './uiLogger';

function parseBoolean(value: unknown): boolean {
  const normalized = String(value ?? '')
    .trim()
    .toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function isEnabled(): boolean {
  // Prefer runtime-config for docker/prod-like mode, fallback to Vite env in dev.
  const runtime = getRuntimeConfig();
  return parseBoolean(readRuntimeString(runtime.otelEnabled) || import.meta.env.VITE_OTEL_ENABLED);
}

async function initOtel(): Promise<void> {
  if (!isEnabled()) {
    return;
  }

  try {
    // Ensure Zone is available before creating ZoneContextManager.
    await import('zone.js');

    const [
      { WebTracerProvider, BatchSpanProcessor },
      { ZoneContextManager },
      { registerInstrumentations },
    ] = await Promise.all([
      import('@opentelemetry/sdk-trace-web'),
      import('@opentelemetry/context-zone'),
      import('@opentelemetry/instrumentation'),
    ]);

    const runtime = getRuntimeConfig();
    const serviceName =
      String(
        readRuntimeString(runtime.otelServiceName) ||
          import.meta.env.VITE_OTEL_SERVICE_NAME ||
          'bot-mox-frontend',
      ).trim() || 'bot-mox-frontend';
    const exporterEndpoint = String(
      readRuntimeString(runtime.otelExporterOtlpEndpoint) ||
        import.meta.env.VITE_OTEL_EXPORTER_OTLP_ENDPOINT ||
        '',
    ).trim();

    const [{ resourceFromAttributes }, { SemanticResourceAttributes }] = await Promise.all([
      import('@opentelemetry/resources'),
      import('@opentelemetry/semantic-conventions'),
    ]);

    const spanProcessors: SpanProcessor[] = [];

    if (exporterEndpoint) {
      const { OTLPTraceExporter } = await import('@opentelemetry/exporter-trace-otlp-http');
      spanProcessors.push(
        new BatchSpanProcessor(
          new OTLPTraceExporter({
            url: exporterEndpoint,
          }),
        ) as unknown as SpanProcessor,
      );
    }

    const provider = new WebTracerProvider({
      resource: resourceFromAttributes({
        [SemanticResourceAttributes.SERVICE_NAME]: serviceName,
      }),
      // OTel JS v2+ expects span processors to be passed via config.
      spanProcessors,
    });

    provider.register({
      contextManager: new ZoneContextManager(),
    });

    const corsAllowList: Array<string | RegExp> = [];
    const apiBase = String(API_BASE_URL || '')
      .trim()
      .replace(/\/+$/, '');

    if (apiBase) {
      corsAllowList.push(new RegExp(`^${escapeRegExp(apiBase)}`));
    } else if (typeof window !== 'undefined' && window.location?.origin) {
      corsAllowList.push(new RegExp(`^${escapeRegExp(window.location.origin)}`));
    }

    const [
      { FetchInstrumentation },
      { DocumentLoadInstrumentation },
      { UserInteractionInstrumentation },
    ] = await Promise.all([
      import('@opentelemetry/instrumentation-fetch'),
      import('@opentelemetry/instrumentation-document-load'),
      import('@opentelemetry/instrumentation-user-interaction'),
    ]);

    registerInstrumentations({
      instrumentations: [
        new DocumentLoadInstrumentation(),
        new UserInteractionInstrumentation(),
        new FetchInstrumentation({
          propagateTraceHeaderCorsUrls: corsAllowList.length > 0 ? corsAllowList : undefined,
          clearTimingResources: true,
        }),
      ],
    });

    // Keep a minimal console note to confirm activation in dev tools.
    uiLogger.info(
      `[otel] frontend enabled (service=${serviceName}, exporter=${exporterEndpoint || 'disabled'})`,
    );
  } catch (error) {
    uiLogger.warn('[otel] frontend init failed:', (error as Error)?.message || error);
  }
}

// Fire and forget.
void initOtel();
