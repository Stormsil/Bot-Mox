const express = require('express');
const { logger } = require('../../observability/logger');

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

  return 'http://localhost:4318/v1/traces';
}

function createOtelProxyRoutes() {
  const router = express.Router();
  const enabled = parseBoolean(process.env.BOTMOX_OTEL_PROXY_ENABLED, false);

  // Only mount a handler if explicitly enabled. Keeps this surface closed in prod by default.
  if (!enabled) {
    router.use((_req, res) => res.status(404).json({ success: false, error: { code: 'NOT_FOUND', message: 'Not found' } }));
    return router;
  }

  // OTLP/HTTP is protobuf by default; accept any content-type and forward verbatim.
  router.post(
    '/v1/traces',
    express.raw({ type: '*/*', limit: '20mb' }),
    async (req, res) => {
      const targetUrl = resolveOtlpTracesEndpoint();
      try {
        const upstream = await fetch(targetUrl, {
          method: 'POST',
          headers: {
            'content-type': String(req.headers['content-type'] || 'application/x-protobuf'),
          },
          body: req.body,
        });

        const payload = Buffer.from(await upstream.arrayBuffer());
        res.status(upstream.status);
        res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json');
        res.send(payload);
      } catch (error) {
        logger.warn({ err: error, targetUrl }, 'OTLP proxy failed');
        res.status(502).json({
          success: false,
          error: {
            code: 'OTLP_PROXY_FAILED',
            message: 'Failed to proxy OTLP traces',
          },
        });
      }
    }
  );

  return router;
}

module.exports = {
  createOtelProxyRoutes,
};

