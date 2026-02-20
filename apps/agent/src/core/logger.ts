import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';

// ---------------------------------------------------------------------------
// Logger — writes to file + console
// ---------------------------------------------------------------------------

interface LoggerContext {
  trace_id?: string;
  correlation_id?: string;
  command_id?: string;
  agent_id?: string;
}

type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogEvent {
  ts: string;
  level: LogLevel;
  event_name: string;
  message: string;
  session_id: string;
  pid: number;
  details?: unknown;
  trace_id?: string;
  correlation_id?: string;
  command_id?: string;
  agent_id?: string;
}

export class Logger {
  private logPath: string;
  private configDir: string;
  private stream: fs.WriteStream | null = null;
  private readonly maxLogBytes: number;
  private readonly maxLogFiles: number;
  private readonly sessionId: string;
  private context: LoggerContext = {};

  constructor(configDir: string) {
    this.configDir = configDir;
    this.logPath = path.join(configDir, 'agent.log');
    this.maxLogBytes = this.readIntEnv('BOTMOX_AGENT_LOG_MAX_BYTES', 5 * 1024 * 1024);
    this.maxLogFiles = this.readIntEnv('BOTMOX_AGENT_LOG_MAX_FILES', 5);
    this.sessionId = randomUUID();
    this.rotateIfNeeded(0);
    this.write('INFO', 'session_started', { event_name: 'agent.session.started' });
  }

  setContext(nextContext: LoggerContext): void {
    this.context = { ...this.context, ...nextContext };
  }

  clearContext(): void {
    this.context = {};
  }

  private readIntEnv(name: string, fallback: number): number {
    const parsed = Number.parseInt(String(process.env[name] ?? ''), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }

  private safeJson(value: unknown): string {
    const sensitiveKeyPattern = /password|token|secret|authorization|cookie|key/i;
    const seen = new WeakSet<object>();
    return JSON.stringify(value, (key, nestedValue) => {
      if (sensitiveKeyPattern.test(String(key || ''))) {
        return '[REDACTED]';
      }
      if (typeof nestedValue === 'bigint') {
        return nestedValue.toString();
      }
      if (nestedValue instanceof Error) {
        return {
          name: nestedValue.name,
          message: nestedValue.message,
          stack: nestedValue.stack,
        };
      }
      if (nestedValue && typeof nestedValue === 'object') {
        if (seen.has(nestedValue)) {
          return '[Circular]';
        }
        seen.add(nestedValue);
      }
      return nestedValue;
    });
  }

  private toEventName(level: LogLevel, message: string, details: unknown): string {
    if (details && typeof details === 'object' && !Array.isArray(details)) {
      const maybeEventName = (details as Record<string, unknown>).event_name;
      if (typeof maybeEventName === 'string' && maybeEventName.trim()) {
        return maybeEventName.trim();
      }
    }

    const normalizedMessage = String(message || 'agent.log')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '.')
      .replace(/^\.+|\.+$/g, '')
      .replace(/\.{2,}/g, '.')
      .slice(0, 80);

    return `${level.toLowerCase()}.${normalizedMessage || 'message'}`;
  }

  private extractContext(message: string, details: unknown): LoggerContext {
    const merged: LoggerContext = { ...this.context };

    if (details && typeof details === 'object' && !Array.isArray(details)) {
      const detailsRecord = details as Record<string, unknown>;
      if (typeof detailsRecord.trace_id === 'string') merged.trace_id = detailsRecord.trace_id;
      if (typeof detailsRecord.correlation_id === 'string')
        merged.correlation_id = detailsRecord.correlation_id;
      if (typeof detailsRecord.command_id === 'string')
        merged.command_id = detailsRecord.command_id;
      if (typeof detailsRecord.agent_id === 'string') merged.agent_id = detailsRecord.agent_id;
    }

    if (!merged.command_id) {
      const commandMatch = String(message || '').match(/\bcommand\s+([a-z0-9-_.]+)/i);
      if (commandMatch?.[1]) {
        merged.command_id = commandMatch[1];
      }
    }

    return merged;
  }

  private rotateFiles(): void {
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }

    for (let index = this.maxLogFiles - 1; index >= 1; index -= 1) {
      const source = `${this.logPath}.${index}`;
      const target = `${this.logPath}.${index + 1}`;
      if (fs.existsSync(source)) {
        try {
          fs.renameSync(source, target);
        } catch {
          // Ignore rotation errors to keep logging non-fatal.
        }
      }
    }

    if (fs.existsSync(this.logPath)) {
      try {
        fs.renameSync(this.logPath, `${this.logPath}.1`);
      } catch {
        // Ignore rotation errors to keep logging non-fatal.
      }
    }

    const staleFile = `${this.logPath}.${this.maxLogFiles + 1}`;
    if (fs.existsSync(staleFile)) {
      try {
        fs.unlinkSync(staleFile);
      } catch {
        // Ignore cleanup errors.
      }
    }
  }

  private rotateIfNeeded(incomingLineLength: number): void {
    try {
      if (!fs.existsSync(this.logPath)) {
        return;
      }
      const currentSize = fs.statSync(this.logPath).size;
      if (currentSize + incomingLineLength < this.maxLogBytes) {
        return;
      }
      this.rotateFiles();
    } catch {
      // Logging should never throw.
    }
  }

  private getStream(): fs.WriteStream {
    if (!this.stream) {
      fs.mkdirSync(this.configDir, { recursive: true });
      this.stream = fs.createWriteStream(this.logPath, { flags: 'a' });
    }
    return this.stream;
  }

  private write(level: string, message: string, ...args: unknown[]): void {
    const ts = new Date().toISOString();
    const details = args.length === 0 ? undefined : args.length === 1 ? args[0] : args;
    const context = this.extractContext(message, details);
    const event: LogEvent = {
      ts,
      level: level as LogLevel,
      event_name: this.toEventName(level as LogLevel, message, details),
      message,
      session_id: this.sessionId,
      pid: process.pid,
      ...(details === undefined ? {} : { details }),
      ...(context.trace_id ? { trace_id: context.trace_id } : {}),
      ...(context.correlation_id ? { correlation_id: context.correlation_id } : {}),
      ...(context.command_id ? { command_id: context.command_id } : {}),
      ...(context.agent_id ? { agent_id: context.agent_id } : {}),
    };

    const line = `${this.safeJson(event)}\n`;

    this.rotateIfNeeded(Buffer.byteLength(line, 'utf8'));

    // Console (may throw EPIPE in Electron when no TTY is attached)
    try {
      if (level === 'ERROR') {
        process.stderr.write(line);
      } else {
        process.stdout.write(line);
      }
    } catch {
      // Ignore — logging should never crash the agent
    }

    // File
    try {
      this.getStream().write(line);
    } catch {
      // Logging should never crash the agent
    }
  }

  info(message: string, ...args: unknown[]): void {
    this.write('INFO', message, ...args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.write('WARN', message, ...args);
  }

  error(message: string, ...args: unknown[]): void {
    this.write('ERROR', message, ...args);
  }

  getLogPath(): string {
    return this.logPath;
  }

  close(): void {
    this.write('INFO', 'session_stopped', { event_name: 'agent.session.stopped' });
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}
