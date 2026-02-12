const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { correlationIdMiddleware } = require('../middleware/correlation-id');
const { requestLogger } = require('../middleware/request-logger');
const { createSimpleRateLimiter } = require('../middleware/rate-limit');

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
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  };
}

function mountCoreHttpMiddleware({ app, env, corsOptions }) {
  app.use(correlationIdMiddleware);
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
    })
  );
  app.use(requestLogger);
}

function mountLegacyErrorHandlers(app) {
  app.use((req, res) => {
    res.status(404).json({
      success: false,
      error: 'Endpoint not found',
    });
  });

  app.use((err, req, res, next) => {
    console.error('❌ Unhandled error:', err);
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
