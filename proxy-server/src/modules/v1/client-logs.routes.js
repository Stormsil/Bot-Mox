const crypto = require('node:crypto');
const express = require('express');
const { z } = require('zod');
const { success, failure } = require('../../contracts/envelope');
const { createSimpleRateLimiter } = require('../../middleware/rate-limit');
const { logger } = require('../../observability/logger');

const EVENT_LIMIT = 20;
const MAX_MESSAGE_LENGTH = 1000;
const MAX_FIELD_LENGTH = 200;
const MAX_STACK_LENGTH = 4000;
const MAX_EXTRA_DEPTH = 3;
const MAX_EXTRA_BYTES = 4096;
const REDACT_KEYS = new Set([
  'password',
  'token',
  'authorization',
  'cookie',
  'secret',
  'apikey',
  'api_key',
  'access_token',
  'refresh_token',
]);

const eventSchema = z.object({
  ts: z.string().trim().min(1).max(64).optional(),
  level: z.enum(['debug', 'info', 'warn', 'error']).optional().default('error'),
  event: z.string().trim().min(1).max(MAX_FIELD_LENGTH),
  message: z.string().trim().min(1).max(MAX_MESSAGE_LENGTH),
  module: z.string().trim().min(1).max(MAX_FIELD_LENGTH).optional(),
  path: z.string().trim().max(MAX_FIELD_LENGTH).optional(),
  trace_id: z.string().trim().optional().nullable(),
  span_id: z.string().trim().optional().nullable(),
  correlation_id: z.string().trim().optional().nullable(),
  error: z
    .object({
      name: z.string().trim().max(128).optional(),
      code: z.string().trim().max(128).optional(),
      message: z.string().trim().max(MAX_MESSAGE_LENGTH).optional(),
      stack: z.string().max(MAX_STACK_LENGTH).optional(),
    })
    .partial()
    .optional(),
  extra: z.record(z.unknown()).optional(),
});

const requestSchema = z.object({
  events: z.array(eventSchema).min(1).max(EVENT_LIMIT),
});

function trimTo(value, max) {
  const normalized = String(value || '').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, max);
}

function normalizeTraceId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{32}$/.test(normalized)) return null;
  return normalized;
}

function normalizeSpanId(value) {
  const normalized = String(value || '')
    .trim()
    .toLowerCase();
  if (!/^[a-f0-9]{16}$/.test(normalized)) return null;
  return normalized;
}

function normalizeCorrelationId(value) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(normalized)
  ) {
    return null;
  }
  return normalized.toLowerCase();
}

function sanitizePrimitive(value) {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return trimTo(value, 1000);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  return null;
}

function sanitizeValue(value, depth = 0) {
  if (depth > MAX_EXTRA_DEPTH) {
    return '[truncated_depth]';
  }

  const primitive = sanitizePrimitive(value);
  if (primitive !== null || value === null || value === undefined) {
    return primitive;
  }

  if (Array.isArray(value)) {
    return value.slice(0, 50).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out = {};
    for (const [key, raw] of Object.entries(value)) {
      const normalizedKey = String(key || '').trim();
      if (!normalizedKey) continue;
      if (REDACT_KEYS.has(normalizedKey.toLowerCase())) {
        out[normalizedKey] = '[redacted]';
        continue;
      }
      const sanitized = sanitizeValue(raw, depth + 1);
      if (sanitized === undefined) continue;
      out[normalizedKey] = sanitized;
    }
    return out;
  }

  return null;
}

function sanitizeExtra(extra) {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return undefined;
  const sanitized = sanitizeValue(extra, 0);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return undefined;
  try {
    const encoded = JSON.stringify(sanitized);
    if (Buffer.byteLength(encoded || '', 'utf8') <= MAX_EXTRA_BYTES) {
      return sanitized;
    }
  } catch {
    return undefined;
  }
  return { __truncated: true };
}

function normalizeClientEvent(input) {
  const normalized = {
    ts: trimTo(input.ts || new Date().toISOString(), 64),
    level: input.level || 'error',
    event: trimTo(input.event, MAX_FIELD_LENGTH),
    message: trimTo(input.message, MAX_MESSAGE_LENGTH),
    module: trimTo(input.module, MAX_FIELD_LENGTH) || null,
    path: trimTo(input.path, MAX_FIELD_LENGTH) || null,
    trace_id: normalizeTraceId(input.trace_id),
    span_id: normalizeSpanId(input.span_id),
    correlation_id: normalizeCorrelationId(input.correlation_id),
    error: undefined,
    extra: sanitizeExtra(input.extra),
  };

  if (input.error && typeof input.error === 'object') {
    normalized.error = {
      name: trimTo(input.error.name, 128) || undefined,
      code: trimTo(input.error.code, 128) || undefined,
      message: trimTo(input.error.message, MAX_MESSAGE_LENGTH) || undefined,
      stack: trimTo(input.error.stack, MAX_STACK_LENGTH) || undefined,
    };
  }

  return normalized;
}

function createClientLogsRoutes({ authMiddleware }) {
  const router = express.Router();

  router.use(express.json({ limit: '64kb' }));
  router.use(async (req, _res, next) => {
    if (!authMiddleware || typeof authMiddleware.authenticateRequest !== 'function') {
      return next();
    }
    try {
      const result = await authMiddleware.authenticateRequest(req, { allowQueryToken: false });
      if (result?.ok) {
        req.auth = result.auth;
      }
    } catch {
      // Ignore optional auth failures by design.
    }
    return next();
  });

  router.use(
    createSimpleRateLimiter({
      windowMs: 60 * 1000,
      max: 60,
      keyGenerator: (req) => {
        const uid = String(req?.auth?.uid || '').trim();
        if (uid) return `uid:${uid}`;
        const ip = String(req.ip || req.socket?.remoteAddress || 'unknown').trim();
        const hash = crypto.createHash('sha256').update(ip).digest('hex').slice(0, 16);
        return `ip:${hash}`;
      },
    }),
  );

  router.post('/', (req, res) => {
    const parsed = requestSchema.safeParse(req.body || {});
    if (!parsed.success) {
      return res.status(400).json(failure('VALIDATION_ERROR', 'Invalid client logs payload'));
    }

    const userId = String(req?.auth?.uid || 'anonymous').trim() || 'anonymous';
    let accepted = 0;
    let dropped = 0;

    for (const item of parsed.data.events) {
      const event = normalizeClientEvent(item);
      if (!event.event || !event.message) {
        dropped += 1;
        continue;
      }

      logger.info(
        {
          scope: 'client_log',
          source: 'frontend',
          user_id: userId,
          client_level: event.level,
          event: event.event,
          module: event.module,
          path: event.path,
          trace_id: event.trace_id,
          span_id: event.span_id,
          correlation_id: event.correlation_id,
          client_ts: event.ts,
          error: event.error,
          extra: event.extra,
        },
        event.message,
      );
      accepted += 1;
    }

    return res.json(success({ accepted, dropped }));
  });

  return router;
}

module.exports = {
  createClientLogsRoutes,
};
