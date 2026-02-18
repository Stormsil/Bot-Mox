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

function getTraceIdsFromHttpArgs(args) {
  // pino-http logs objects that usually include { req, res, ... }.
  // Prefer the request-captured ids to keep x-span-id and log span_id consistent.
  for (let i = 0; i < (args ? args.length : 0); i += 1) {
    const candidate = args[i];
    if (!candidate || typeof candidate !== 'object') continue;
    const req = candidate.req;
    const ids = req && req.traceIds;
    if (ids && typeof ids === 'object') {
      return {
        trace_id: ids.trace_id ?? null,
        span_id: ids.span_id ?? null,
      };
    }
  }
  return null;
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
  // Ensure every log line is trace-correlatable without emitting duplicate JSON keys.
  // (pino mixin can duplicate keys when the log object already contains trace_id/span_id).
  hooks: {
    logMethod(args, method) {
      const httpIds = getTraceIdsFromHttpArgs(args);
      const ids = httpIds || getTraceIds();

      // pino supports logging as (obj, msg) and (msg, obj). Find the first object arg.
      let objIndex = -1;
      for (let i = 0; i < (args ? args.length : 0); i += 1) {
        const candidate = args[i];
        if (candidate && typeof candidate === 'object' && !Array.isArray(candidate)) {
          objIndex = i;
          break;
        }
      }

      if (objIndex >= 0) {
        const obj = args[objIndex];
        if (!Object.prototype.hasOwnProperty.call(obj, 'trace_id')) {
          obj.trace_id = ids.trace_id;
        }
        if (!Object.prototype.hasOwnProperty.call(obj, 'span_id')) {
          obj.span_id = ids.span_id;
        }
      } else {
        // No object arg found, prepend a new object so every log line has trace_id/span_id keys.
        args.unshift({ trace_id: ids.trace_id, span_id: ids.span_id });
      }

      return method.apply(this, args);
    },
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
