import { enqueueClientLog } from './clientLogTransport';
import {
  getActiveTraceContext,
  getCurrentPath,
  normalizeErrorPayload,
  normalizeEventName,
  normalizeField,
  normalizeMessage,
  sanitizeExtra,
  type UiLogEvent,
  type UiLogLevel,
} from './logContext';

interface UiLoggerPayload {
  message?: unknown;
  module?: unknown;
  path?: unknown;
  trace_id?: unknown;
  span_id?: unknown;
  correlation_id?: unknown;
  error?: unknown;
  extra?: unknown;
}

interface UiLogger {
  debug(event: string, payload?: UiLoggerPayload): void;
  debug(...args: unknown[]): void;
  info(event: string, payload?: UiLoggerPayload): void;
  info(...args: unknown[]): void;
  warn(event: string, payload?: UiLoggerPayload): void;
  warn(...args: unknown[]): void;
  error(event: string, payload?: UiLoggerPayload): void;
  error(...args: unknown[]): void;
  // Compatibility mode for refactoring existing console.* calls.
  child(context: { module?: string }): UiLogger;
}

const LOG_LEVELS: UiLogLevel[] = ['debug', 'info', 'warn', 'error'];
const PROD_CONSOLE_MIN_LEVEL: UiLogLevel = 'warn';
const PROD_TRANSPORT_MIN_LEVEL: UiLogLevel = 'warn';
const DEV_TRANSPORT_MIN_LEVEL: UiLogLevel = 'warn';

function levelPriority(level: UiLogLevel): number {
  return LOG_LEVELS.indexOf(level);
}

function canLogToConsole(level: UiLogLevel): boolean {
  if (!import.meta.env.PROD) return true;
  return levelPriority(level) >= levelPriority(PROD_CONSOLE_MIN_LEVEL);
}

function canSendToTransport(level: UiLogLevel): boolean {
  if (!import.meta.env.PROD) {
    return levelPriority(level) >= levelPriority(DEV_TRANSPORT_MIN_LEVEL);
  }
  return levelPriority(level) >= levelPriority(PROD_TRANSPORT_MIN_LEVEL);
}

function toConsoleMethod(level: UiLogLevel): (...args: unknown[]) => void {
  if (level === 'debug') return console.debug.bind(console);
  if (level === 'info') return console.info.bind(console);
  if (level === 'warn') return console.warn.bind(console);
  return console.error.bind(console);
}

function isPayloadLike(value: unknown): value is UiLoggerPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const obj = value as Record<string, unknown>;
  return (
    Object.hasOwn(obj, 'message') ||
    Object.hasOwn(obj, 'module') ||
    Object.hasOwn(obj, 'error') ||
    Object.hasOwn(obj, 'extra') ||
    Object.hasOwn(obj, 'path') ||
    Object.hasOwn(obj, 'trace_id')
  );
}

function parseLegacyArgs(
  args: unknown[],
  fallbackEvent: string,
): { event: string; payload: UiLoggerPayload } {
  if (args.length === 0) {
    return {
      event: fallbackEvent,
      payload: { message: fallbackEvent },
    };
  }

  if (typeof args[0] === 'string' && args.length >= 2 && isPayloadLike(args[1])) {
    return {
      event: normalizeEventName(args[0], fallbackEvent),
      payload: args[1],
    };
  }

  const first = args[0];
  const second = args[1];
  const message = typeof first === 'string' ? first : fallbackEvent;
  const error = first instanceof Error ? first : second instanceof Error ? second : undefined;
  const extra = args.length > 1 ? { args: args.slice(error ? 2 : 1) } : undefined;

  return {
    event: fallbackEvent,
    payload: {
      message,
      error,
      extra,
    },
  };
}

function buildEvent(
  level: UiLogLevel,
  event: string,
  payload: UiLoggerPayload,
  defaultModule?: string,
): UiLogEvent {
  const trace = getActiveTraceContext();
  const normalizedEvent = normalizeEventName(event, `frontend.${level}`);
  const message = normalizeMessage(payload.message, normalizedEvent);
  const moduleName = normalizeField(payload.module) || normalizeField(defaultModule);
  const path = normalizeField(payload.path) || getCurrentPath();

  const traceId = normalizeField(payload.trace_id);
  const spanId = normalizeField(payload.span_id);
  const correlationId = normalizeField(payload.correlation_id);

  return {
    ts: new Date().toISOString(),
    level,
    event: normalizedEvent,
    message,
    module: moduleName,
    path: path || undefined,
    trace_id: traceId || trace.trace_id,
    span_id: spanId || trace.span_id,
    correlation_id: correlationId || undefined,
    error: normalizeErrorPayload(payload.error),
    extra: sanitizeExtra(payload.extra),
  };
}

function emit(level: UiLogLevel, args: unknown[], context: { module?: string }): void {
  const parsed = parseLegacyArgs(args, `frontend.${level}`);
  const entry = buildEvent(level, parsed.event, parsed.payload, context.module);

  if (canLogToConsole(level)) {
    const method = toConsoleMethod(level);
    method(`[${entry.event}]`, {
      message: entry.message,
      module: entry.module,
      path: entry.path,
      trace_id: entry.trace_id,
      span_id: entry.span_id,
      correlation_id: entry.correlation_id,
      error: entry.error,
      extra: entry.extra,
    });
  }

  if (canSendToTransport(level)) {
    enqueueClientLog(entry);
  }
}

function createLogger(context: { module?: string } = {}): UiLogger {
  return {
    debug: (...args: unknown[]) => emit('debug', args, context),
    info: (...args: unknown[]) => emit('info', args, context),
    warn: (...args: unknown[]) => emit('warn', args, context),
    error: (...args: unknown[]) => emit('error', args, context),
    child: (childContext: { module?: string }) =>
      createLogger({
        module: childContext?.module || context.module,
      }),
  };
}

export const uiLogger = createLogger();
