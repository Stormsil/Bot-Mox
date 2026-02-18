import { context, trace } from '@opentelemetry/api';

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

const MAX_EXTRA_DEPTH = 3;
const MAX_EXTRA_ARRAY = 50;
const MAX_EXTRA_STRING = 1000;
const MAX_EXTRA_BYTES = 4096;
const MAX_STACK = 4000;
const MAX_MESSAGE = 1000;
const MAX_FIELD = 200;

export type UiLogLevel = 'debug' | 'info' | 'warn' | 'error';

export interface UiLogErrorPayload {
  name?: string;
  code?: string;
  message?: string;
  stack?: string;
}

export interface UiLogEvent {
  ts: string;
  level: UiLogLevel;
  event: string;
  message: string;
  module?: string;
  path?: string;
  trace_id?: string | null;
  span_id?: string | null;
  correlation_id?: string | null;
  error?: UiLogErrorPayload;
  extra?: Record<string, unknown>;
}

function trimTo(value: unknown, max: number): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';
  if (normalized.length <= max) return normalized;
  return normalized.slice(0, max);
}

function sanitizePrimitive(value: unknown): string | number | boolean | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string') return trimTo(value, MAX_EXTRA_STRING);
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'boolean') return value;
  return null;
}

function sanitizeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_EXTRA_DEPTH) return '[truncated_depth]';

  const primitive = sanitizePrimitive(value);
  if (primitive !== null || value === null || value === undefined) return primitive;

  if (Array.isArray(value)) {
    return value.slice(0, MAX_EXTRA_ARRAY).map((item) => sanitizeValue(item, depth + 1));
  }

  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
      const normalizedKey = trimTo(key, MAX_FIELD);
      if (!normalizedKey) continue;
      if (REDACT_KEYS.has(normalizedKey.toLowerCase())) {
        out[normalizedKey] = '[redacted]';
        continue;
      }
      out[normalizedKey] = sanitizeValue(raw, depth + 1);
    }
    return out;
  }

  return null;
}

export function sanitizeExtra(extra: unknown): Record<string, unknown> | undefined {
  if (!extra || typeof extra !== 'object' || Array.isArray(extra)) return undefined;
  const sanitized = sanitizeValue(extra, 0);
  if (!sanitized || typeof sanitized !== 'object' || Array.isArray(sanitized)) return undefined;
  try {
    const encoded = JSON.stringify(sanitized);
    if (new TextEncoder().encode(encoded).length <= MAX_EXTRA_BYTES) {
      return sanitized as Record<string, unknown>;
    }
  } catch {
    return undefined;
  }
  return { __truncated: true };
}

export function normalizeErrorPayload(error: unknown): UiLogErrorPayload | undefined {
  if (!error) return undefined;

  if (error instanceof Error) {
    const withCode = error as Error & { code?: string };
    return {
      name: trimTo(error.name, 128) || undefined,
      code: trimTo(withCode.code, 128) || undefined,
      message: trimTo(error.message, MAX_MESSAGE) || undefined,
      stack: trimTo(error.stack, MAX_STACK) || undefined,
    };
  }

  if (typeof error === 'object') {
    const source = error as Record<string, unknown>;
    return {
      name: trimTo(source.name, 128) || undefined,
      code: trimTo(source.code, 128) || undefined,
      message: trimTo(source.message, MAX_MESSAGE) || undefined,
      stack: trimTo(source.stack, MAX_STACK) || undefined,
    };
  }

  return {
    message: trimTo(error, MAX_MESSAGE) || undefined,
  };
}

export function getActiveTraceContext(): { trace_id: string | null; span_id: string | null } {
  try {
    const span = trace.getSpan(context.active());
    const spanContext = span?.spanContext?.();
    if (!spanContext) {
      return { trace_id: null, span_id: null };
    }
    return {
      trace_id: spanContext.traceId || null,
      span_id: spanContext.spanId || null,
    };
  } catch {
    return { trace_id: null, span_id: null };
  }
}

export function getCurrentPath(): string | undefined {
  if (typeof window === 'undefined' || !window.location) return undefined;
  return trimTo(window.location.pathname || '/', MAX_FIELD) || '/';
}

export function normalizeEventName(value: unknown, fallback: string): string {
  const normalized = trimTo(value, MAX_FIELD).toLowerCase().replace(/\s+/g, '_');
  if (!normalized) return fallback;
  return normalized;
}

export function normalizeMessage(value: unknown, fallback = 'frontend_log'): string {
  const message = trimTo(value, MAX_MESSAGE);
  return message || fallback;
}

export function normalizeField(value: unknown): string | undefined {
  const normalized = trimTo(value, MAX_FIELD);
  return normalized || undefined;
}

