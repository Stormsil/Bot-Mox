function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function resolveOtlpTracesEndpoint() {
  const explicitTracesEndpoint = String(process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT || '').trim();
  if (explicitTracesEndpoint) {
    return explicitTracesEndpoint;
  }

  const base = String(process.env.OTEL_EXPORTER_OTLP_ENDPOINT || '').trim().replace(/\/+$/, '');
  if (base) {
    return `${base}/v1/traces`;
  }

  // Default for local Jaeger (OTLP HTTP) in our dev stack.
  return 'http://localhost:4318/v1/traces';
}

function startTracingIfEnabled() {
  const enabled = parseBoolean(process.env.BOTMOX_OTEL_ENABLED, false);
  if (!enabled) {
    return { ok: true, started: false };
  }

  // Never override if the user already configured it.
  if (!process.env.OTEL_SERVICE_NAME) {
    process.env.OTEL_SERVICE_NAME = 'bot-mox-backend';
  }

  try {
    const { NodeSDK } = require('@opentelemetry/sdk-node');
    const { getNodeAutoInstrumentations } = require('@opentelemetry/auto-instrumentations-node');
    const { OTLPTraceExporter } = require('@opentelemetry/exporter-trace-otlp-http');

    const exporter = new OTLPTraceExporter({
      url: resolveOtlpTracesEndpoint(),
    });

    const sdk = new NodeSDK({
      traceExporter: exporter,
      instrumentations: [
        getNodeAutoInstrumentations({
          // Keep noisy/low-signal instrumentations off by default.
          '@opentelemetry/instrumentation-fs': { enabled: false },
          // We inject trace_id/span_id ourselves in pino logger to guarantee shape and avoid duplicate keys.
          '@opentelemetry/instrumentation-pino': { enabled: false },
        }),
      ],
    });

    sdk.start();

    const shutdown = () => {
      sdk
        .shutdown()
        .catch(() => {
          // Ignore shutdown errors.
        });
    };

    process.once('SIGTERM', shutdown);
    process.once('SIGINT', shutdown);
    process.once('beforeExit', shutdown);

    return { ok: true, started: true };
  } catch (error) {
    // If tracing fails to initialize, keep the service running.
    // Logging here is intentionally minimal because logger depends on tracing context.
    // eslint-disable-next-line no-console
    console.error('[otel] failed to start tracing:', error?.message || error);
    return { ok: false, started: false, error };
  }
}

module.exports = {
  startTracingIfEnabled,
};
