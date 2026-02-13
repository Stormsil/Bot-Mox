import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Logger — writes to file + console
// ---------------------------------------------------------------------------

export class Logger {
  private logPath: string;
  private stream: fs.WriteStream | null = null;

  constructor(configDir: string) {
    this.logPath = path.join(configDir, 'agent.log');
  }

  private getStream(): fs.WriteStream {
    if (!this.stream) {
      this.stream = fs.createWriteStream(this.logPath, { flags: 'a' });
    }
    return this.stream;
  }

  private write(level: string, message: string, ...args: unknown[]): void {
    const ts = new Date().toISOString();
    const extra = args.length > 0 ? ' ' + args.map(a => {
      if (a instanceof Error) return a.message;
      if (typeof a === 'object') return JSON.stringify(a);
      return String(a);
    }).join(' ') : '';
    const line = `[${ts}] ${level} ${message}${extra}\n`;

    // Console
    if (level === 'ERROR') {
      process.stderr.write(line);
    } else {
      process.stdout.write(line);
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
    if (this.stream) {
      this.stream.end();
      this.stream = null;
    }
  }
}
