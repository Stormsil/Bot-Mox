const express = require('express');
const { trace, context } = require('@opentelemetry/api');
const { success } = require('../../contracts/envelope');

function parseBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).trim().toLowerCase();
  return ['1', 'true', 'yes', 'on'].includes(normalized);
}

function getActiveSpanIds() {
  try {
    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext?.();
    if (!spanContext?.traceId || !spanContext?.spanId) {
      return { trace_id: null, span_id: null };
    }
    return { trace_id: spanContext.traceId, span_id: spanContext.spanId };
  } catch {
    return { trace_id: null, span_id: null };
  }
}

function createDiagnosticsRoutes({ env }) {
  const router = express.Router();
  const enabled = parseBoolean(process.env.BOTMOX_DIAGNOSTICS_ENABLED, false);

  if (!enabled) {
    // Hide the surface when disabled.
    router.use((_req, res) =>
      res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }),
    );
    return router;
  }

  router.get('/trace', (req, res) => {
    const ids = getActiveSpanIds();

    res.json(
      success({
        timestamp: new Date().toISOString(),
        node_env: String(env?.nodeEnv || process.env.NODE_ENV || 'development'),
        received: {
          traceparent: req.headers?.traceparent || null,
          tracestate: req.headers?.tracestate || null,
          baggage: req.headers?.baggage || null,
          correlation_id: req.headers?.['x-correlation-id'] || null,
        },
        active: ids,
        response_headers: {
          x_trace_id: res.getHeader('x-trace-id') || null,
          x_span_id: res.getHeader('x-span-id') || null,
          x_correlation_id: res.getHeader('x-correlation-id') || null,
        },
      }),
    );
  });

  return router;
}

module.exports = {
  createDiagnosticsRoutes,
};
