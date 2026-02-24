import { Injectable } from '@nestjs/common';

@Injectable()
export class RuntimeMetricsService {
  private readonly startedAtMs = Date.now();
  private readonly counters = new Map<string, number>();
  private sseActive = 0;
  private wsActive = 0;

  increment(metric: string, value = 1): void {
    const name = String(metric || '').trim();
    if (!name) {
      return;
    }
    const safeValue = Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : 1;
    this.counters.set(name, (this.counters.get(name) || 0) + safeValue);
  }

  recordHttpStatus(input: { statusCode: number }): void {
    const code = Number.isFinite(input.statusCode) ? Math.trunc(input.statusCode) : 0;
    if (code <= 0) {
      return;
    }
    this.increment(`http.status.${code}`);
    this.increment(`http.class.${Math.trunc(code / 100)}xx`);
    if (code === 401) {
      this.increment('auth.failures.401');
    }
    if (code === 403) {
      this.increment('auth.failures.403');
    }
    if (code >= 500 && code < 600) {
      this.increment('http.failures.5xx');
    }
  }

  onSseOpened(): void {
    this.sseActive += 1;
    this.increment('sse.opened');
  }

  onSseClosed(): void {
    this.sseActive = Math.max(0, this.sseActive - 1);
    this.increment('sse.closed');
  }

  onWsOpened(): void {
    this.wsActive += 1;
    this.increment('ws.opened');
  }

  onWsClosed(): void {
    this.wsActive = Math.max(0, this.wsActive - 1);
    this.increment('ws.closed');
  }

  onWsRejected(reason: string): void {
    const normalizedReason = String(reason || 'unknown')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_');
    this.increment('ws.rejected');
    this.increment(`ws.rejected.${normalizedReason || 'unknown'}`);
  }

  snapshot(): {
    ts: string;
    uptime_ms: number;
    active: { sse: number; ws: number };
    counters: Record<string, number>;
  } {
    return {
      ts: new Date().toISOString(),
      uptime_ms: Date.now() - this.startedAtMs,
      active: {
        sse: this.sseActive,
        ws: this.wsActive,
      },
      counters: Object.fromEntries(
        [...this.counters.entries()].sort((a, b) => a[0].localeCompare(b[0])),
      ),
    };
  }
}
