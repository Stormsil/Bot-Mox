const pino = require('pino');

let otelApi = null;
try {
  // Optional at runtime (but expected to be installed in this repo).
  // Keeping this guarded makes local debugging resilient if deps are temporarily missing.
  otelApi = require('@opentelemetry/api');
} catch {
  otelApi = null;
}

function getActiveSpanContext() {
  if (!otelApi) return null;
  try {
    const span = otelApi.trace.getSpan(otelApi.context.active());
    if (!span) return null;
    const ctx = span.spanContext?.();
    if (!ctx || !ctx.traceId || !ctx.spanId) return null;
    return ctx;
  } catch {
    return null;
  }
}

function getTraceIds() {
  const ctx = getActiveSpanContext();
  return {
    trace_id: ctx ? ctx.traceId : null,
    span_id: ctx ? ctx.spanId : null,
  };
}

const serviceName = String(process.env.OTEL_SERVICE_NAME || 'bot-mox-backend').trim() || 'bot-mox-backend';
const envName = String(process.env.NODE_ENV || 'development').trim() || 'development';

const logger = pino({
  level: String(process.env.LOG_LEVEL || (envName === 'production' ? 'info' : 'debug')),
  base: {
    service: serviceName,
    env: envName,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  // Ensure every log line is trace-correlatable.
  mixin() {
    return getTraceIds();
  },
  redact: {
    paths: [
      'req.headers.authorization',
      'req.headers.cookie',
      'req.headers["x-internal-api-token"]',
      'req.headers["x-internal-infra-token"]',
      'req.body.password',
      'req.body.secret',
      'req.body.token',
      'res.headers["set-cookie"]',
    ],
    remove: true,
  },
  serializers: {
    err: pino.stdSerializers.err,
  },
});

module.exports = {
  logger,
  getTraceIds,
};

