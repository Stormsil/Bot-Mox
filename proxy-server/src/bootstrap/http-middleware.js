const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const crypto = require('crypto');
const { correlationIdMiddleware } = require('../middleware/correlation-id');
const pinoHttp = require('pino-http');
const { logger, getTraceIds } = require('../observability/logger');
const { createSimpleRateLimiter } = require('../middleware/rate-limit');
const { verifyAgentToken } = require('../utils/agent-token');

function getBearerToken(headers) {
  const auth = headers?.authorization;
  if (typeof auth !== 'string' || !auth.startsWith('Bearer ')) {
    return '';
  }
  return auth.slice(7).trim();
}

function isAgentCommandBusRoute(req) {
  const method = String(req?.method || '').toUpperCase();
  const path = String(req?.path || req?.originalUrl || '').trim();

  if (method === 'POST' && path === '/v1/agents/heartbeat') {
    return true;
  }
  if (method === 'GET' && path === '/v1/vm-ops/commands') {
    return true;
  }
  if (method === 'GET' && path === '/v1/vm-ops/commands/next') {
    return true;
  }
  if (method === 'GET' && path === '/v1/vm-ops/events') {
    return true;
  }
  if (method === 'PATCH' && /^\/v1\/vm-ops\/commands\/[^/]+$/.test(path)) {
    return true;
  }

  return false;
}

function isRateLimitExemptRoute(req) {
  const method = String(req?.method || '').toUpperCase();
  const path = String(req?.path || req?.originalUrl || '').trim();

  if (method === 'OPTIONS') {
    // CORS preflight should never consume API budget.
    return true;
  }

  // Refine auth provider and app boot may call these endpoints frequently.
  // Keep them outside generic API throttle to prevent auth/theme lockouts.
  if (method === 'GET' && path === '/v1/auth/verify') {
    return true;
  }
  if (method === 'GET' && path === '/v1/settings/theme') {
    return true;
  }

  return false;
}

function createCorsOptions(env) {
  const isDev = String(env?.nodeEnv || '').toLowerCase() === 'development';

  const devLocalOrigins = [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5174',
    'http://127.0.0.1:5174',
    'http://localhost:3000',
  ];

  const originsFromEnv = Array.isArray(env?.corsOrigins) ? env.corsOrigins : [];
  const uniqueOrigins = (values) => [...new Set(values.filter(Boolean).map((v) => String(v).trim()).filter(Boolean))];

  const allowedOrigins = originsFromEnv.length > 0 ? originsFromEnv : devLocalOrigins;
  const mergedOrigins = isDev ? uniqueOrigins([...allowedOrigins, ...devLocalOrigins]) : uniqueOrigins(allowedOrigins);
  const internalNetworkPortPattern = isDev ? '(5173|5174|3000)' : '(5173|3000)';

  return {
    origin:
      mergedOrigins.length > 0
        ? [
            ...mergedOrigins,
            new RegExp(`^https?:\\/\\/192\\.168\\.\\d{1,3}\\.\\d{1,3}:${internalNetworkPortPattern}$`),
            new RegExp(`^https?:\\/\\/10\\.\\d{1,3}\\.\\d{1,3}\\.\\d{1,3}:${internalNetworkPortPattern}$`),
          ]
        : devLocalOrigins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'Accept',
      'X-Requested-With',
      'X-Correlation-Id',
      'traceparent',
      'tracestate',
      'baggage',
    ],
    exposedHeaders: ['x-trace-id', 'x-span-id', 'x-correlation-id'],
    credentials: true,
  };
}

function mountCoreHttpMiddleware({ app, env, corsOptions }) {
  app.use(correlationIdMiddleware);

  // JSON request/response logs correlated by trace_id/span_id.
  app.use(
    pinoHttp({
      logger,
      quietReqLogger: true,
      customProps: (req) => {
        const ids = getTraceIds();
        return {
          correlation_id: req?.correlationId || null,
          trace_id: ids.trace_id,
          span_id: ids.span_id,
        };
      },
      redact: {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["x-internal-api-token"]',
          'req.headers["x-internal-infra-token"]',
        ],
        remove: true,
      },
    })
  );

  // Make trace identifiers easily discoverable by clients/Playwright.
  app.use((req, res, next) => {
    const ids = getTraceIds();
    if (ids.trace_id) {
      res.setHeader('x-trace-id', ids.trace_id);
    }
    if (ids.span_id) {
      res.setHeader('x-span-id', ids.span_id);
    }
    // correlation id header is set by correlationIdMiddleware
    return next();
  });

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
    })
  );
  app.use(cors(corsOptions));
  app.use(express.json());
  app.use(
    '/api',
    createSimpleRateLimiter({
      windowMs: env.apiRateLimitWindowMs,
      max: env.apiRateLimitMax,
      skip: (req) => {
        if (isRateLimitExemptRoute(req)) {
          return true;
        }

        // Keep agent command-bus + heartbeat traffic outside user-facing API limits.
        // This prevents false "agent offline" during heavy command queues.
        if (isAgentCommandBusRoute(req)) {
          return true;
        }

        // Agent token is already cryptographically scoped and short-lived.
        // Do not throttle agent command bus/heartbeat traffic with user API limits.
        const token = getBearerToken(req.headers);
        if (!token) return false;
        return Boolean(verifyAgentToken(token, env.agentAuthSecret));
      },
      keyGenerator: (req) => {
        const token = getBearerToken(req.headers);
        if (token) {
          const hash = crypto.createHash('sha256').update(token).digest('base64url');
          return `auth:${hash}`;
        }
        return req.ip || req.socket?.remoteAddress || 'unknown';
      },
    })
  );
  app.options('/api/*', cors(corsOptions));
}

function mountLegacyErrorHandlers(app) {
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
    });
  });

  app.use((err, req, res, next) => {
    logger.error({ err, path: req?.originalUrl || req?.url }, 'Unhandled error');
    res.status(500).json({
      success: false,
      error: 'Internal server error',
    });
  });
}

module.exports = {
  createCorsOptions,
  mountCoreHttpMiddleware,
  mountLegacyErrorHandlers,
};
