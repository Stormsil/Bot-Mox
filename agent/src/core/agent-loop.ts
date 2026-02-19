import { executeCommand } from '../executors';
import { type ApiClient, ApiError } from './api-client';
import type { AgentConfig } from './config-store';
import type { Logger } from './logger';
import { type QueuedCommand, queuedCommandSchema } from './schemas';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentStatus = 'idle' | 'connecting' | 'online' | 'error' | 'revoked';
const HEARTBEAT_INTERVAL_MS = 30_000;
const NEXT_COMMAND_TIMEOUT_MS = 25_000;
const COMMAND_ERROR_BACKOFF_MS = 1_500;
const RATE_LIMIT_COOLDOWN_MS = 45_000;

export type StatusCallback = (status: AgentStatus, message?: string) => void;

// ---------------------------------------------------------------------------
// AgentLoop — heartbeat + poll + execute
// ---------------------------------------------------------------------------

export class AgentLoop {
  private interval: ReturnType<typeof setInterval> | null = null;
  private status: AgentStatus = 'idle';
  private onStatusChange: StatusCallback | null = null;
  private nextTickAt = 0;
  private running = false;

  constructor(
    private config: AgentConfig,
    private apiClient: ApiClient,
    private logger: Logger,
  ) {}

  setStatusCallback(cb: StatusCallback): void {
    this.onStatusChange = cb;
  }

  getStatus(): AgentStatus {
    return this.status;
  }

  async start(): Promise<void> {
    if (this.running) return;

    this.running = true;
    this.nextTickAt = 0;
    this.setStatus('connecting');
    this.logger.info('Agent loop starting...');

    await this.sendHeartbeat();

    void this.runCommandLoop().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.error(`Command loop crashed: ${message}`);
    });

    this.interval = setInterval(() => {
      void this.sendHeartbeat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  stop(): void {
    this.running = false;
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.nextTickAt = 0;
    if (this.status !== 'revoked') {
      this.setStatus('idle');
    }
    this.logger.info('Agent loop stopped');
  }

  private setStatus(status: AgentStatus, message?: string): void {
    if (this.status === status) return;
    this.status = status;
    this.logger.info(`Status: ${status}${message ? ` — ${message}` : ''}`);
    this.onStatusChange?.(status, message);
  }

  private isRateLimitedError(err: unknown): boolean {
    if (err instanceof ApiError) {
      return err.status === 429 || err.code === 'RATE_LIMITED';
    }
    if (err instanceof Error) {
      return /rate[- ]?limit|too many requests/i.test(err.message);
    }
    return false;
  }

  private isRevokedError(err: unknown): err is ApiError {
    return err instanceof ApiError && (err.code === 'AGENT_REVOKED' || err.status === 403);
  }

  private async sendHeartbeat(): Promise<void> {
    if (!this.running) {
      return;
    }

    if (Date.now() < this.nextTickAt) {
      return;
    }

    try {
      await this.apiClient.post('/api/v1/agents/heartbeat', {
        agent_id: this.config.agentId,
      });
      this.setStatus('online');
    } catch (err) {
      if (this.isRateLimitedError(err)) {
        this.nextTickAt = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        this.setStatus(
          'error',
          `Rate limited, retrying in ${Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000)}s`,
        );
        return;
      }

      if (this.isRevokedError(err)) {
        this.setStatus('revoked', err.message);
        this.stop();
        return;
      }

      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus('error', msg);
    }
  }

  private async fetchNextCommand(): Promise<QueuedCommand | null> {
    const command = await this.apiClient.get<QueuedCommand | null>(
      `/api/v1/vm-ops/commands/next?agent_id=${encodeURIComponent(this.config.agentId)}&timeout_ms=${NEXT_COMMAND_TIMEOUT_MS}`,
      // Long-poll: backend should respond within timeout_ms, but proxies/TCP stalls can hang.
      // Give it a bit of headroom and then abort client-side.
      { timeoutMs: NEXT_COMMAND_TIMEOUT_MS + 15_000 },
    );

    if (command === null) {
      return null;
    }

    const parsed = queuedCommandSchema.safeParse(command);
    if (!parsed.success) {
      this.logger.warn('Skipping invalid queued command payload', {
        event_name: 'agent.command.invalid_payload',
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      });
      return null;
    }

    return parsed.data;
  }

  private async runCommandLoop(): Promise<void> {
    while (this.running) {
      if (Date.now() < this.nextTickAt) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        continue;
      }

      try {
        const command = await this.fetchNextCommand();
        if (!this.running) {
          return;
        }
        if (!command) {
          continue;
        }

        const result = await this.processCommand(command);
        if (result === 'rate_limited') {
          this.nextTickAt = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        }
      } catch (err) {
        if (this.isRateLimitedError(err)) {
          this.nextTickAt = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          this.setStatus(
            'error',
            `Rate limited, retrying in ${Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000)}s`,
          );
          await new Promise((resolve) => setTimeout(resolve, 500));
          continue;
        }

        if (this.isRevokedError(err)) {
          this.setStatus('revoked', err.message);
          this.stop();
          return;
        }

        const msg = err instanceof Error ? err.message : String(err);
        this.setStatus('error', msg);
        await new Promise((resolve) => setTimeout(resolve, COMMAND_ERROR_BACKOFF_MS));
      }
    }
  }

  private async processCommand(cmd: QueuedCommand): Promise<'done' | 'skipped' | 'rate_limited'> {
    this.logger.info(`Executing command ${cmd.id} (${cmd.command_type})`);

    // Check if expired
    if (cmd.expires_at && new Date(cmd.expires_at) < new Date()) {
      this.logger.warn(`Command ${cmd.id} already expired, skipping`);
      try {
        await this.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
          status: 'failed',
          error_message: 'Command expired before execution',
        });
      } catch (reportErr) {
        this.logger.error(`Failed to mark expired command ${cmd.id}:`, reportErr);
      }
      return 'skipped';
    }

    // Mark as running
    try {
      await this.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
        status: 'running',
      });
    } catch (err) {
      if (this.isRateLimitedError(err)) {
        this.logger.warn(
          `Rate limited while claiming command ${cmd.id}, delaying further processing`,
        );
        return 'rate_limited';
      }
      this.logger.error(`Failed to mark command ${cmd.id} as running:`, err);
      return 'skipped';
    }

    // Execute
    try {
      const result = await executeCommand(
        cmd.command_type,
        cmd.payload || {},
        this.config,
        this.logger,
      );

      await this.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
        status: 'succeeded',
        result: result ?? {},
      });

      this.logger.info(`Command ${cmd.id} succeeded`);
      return 'done';
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : String(err);
      this.logger.error(`Command ${cmd.id} failed: ${errorMessage}`);

      try {
        await this.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
          status: 'failed',
          error_message: errorMessage,
        });
      } catch (reportErr) {
        this.logger.error(`Failed to report error for command ${cmd.id}:`, reportErr);
      }

      if (this.isRateLimitedError(err)) {
        return 'rate_limited';
      }
      return 'done';
    }
  }
}
