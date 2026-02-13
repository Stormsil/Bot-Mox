import { ApiClient, ApiError } from './api-client';
import { AgentConfig } from './config-store';
import { Logger } from './logger';
import { executeCommand } from '../executors';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AgentStatus = 'idle' | 'connecting' | 'online' | 'error' | 'revoked';

interface QueuedCommand {
  id: string;
  tenant_id: string;
  agent_id: string;
  command_type: string;
  payload: Record<string, unknown>;
  status: string;
  queued_at: string;
  expires_at: string;
}

export type StatusCallback = (status: AgentStatus, message?: string) => void;

// ---------------------------------------------------------------------------
// AgentLoop — heartbeat + poll + execute
// ---------------------------------------------------------------------------

export class AgentLoop {
  private interval: ReturnType<typeof setInterval> | null = null;
  private status: AgentStatus = 'idle';
  private onStatusChange: StatusCallback | null = null;
  private executing = false;

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
    if (this.interval) return;

    this.setStatus('connecting');
    this.logger.info('Agent loop starting...');

    // Immediate first tick
    await this.tick();

    // Then every 30 seconds
    this.interval = setInterval(() => this.tick(), 30_000);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
    this.setStatus('idle');
    this.logger.info('Agent loop stopped');
  }

  private setStatus(status: AgentStatus, message?: string): void {
    if (this.status === status) return;
    this.status = status;
    this.logger.info(`Status: ${status}${message ? ' — ' + message : ''}`);
    this.onStatusChange?.(status, message);
  }

  private async tick(): Promise<void> {
    try {
      // 1. Heartbeat
      await this.apiClient.post('/api/v1/agents/heartbeat', {
        agent_id: this.config.agentId,
      });

      this.setStatus('online');

      // 2. Poll for queued commands (skip if already executing)
      if (this.executing) return;

      const commands = await this.apiClient.get<QueuedCommand[]>(
        `/api/v1/vm-ops/commands?agent_id=${this.config.agentId}&status=queued`,
      );

      if (!Array.isArray(commands) || commands.length === 0) return;

      // 3. Execute each command sequentially
      this.executing = true;
      try {
        for (const cmd of commands) {
          await this.processCommand(cmd);
        }
      } finally {
        this.executing = false;
      }
    } catch (err) {
      if (err instanceof ApiError) {
        if (err.code === 'AGENT_REVOKED' || err.status === 403) {
          this.setStatus('revoked', err.message);
          this.stop();
          return;
        }
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus('error', msg);
    }
  }

  private async processCommand(cmd: QueuedCommand): Promise<void> {
    this.logger.info(`Executing command ${cmd.id} (${cmd.command_type})`);

    // Check if expired
    if (cmd.expires_at && new Date(cmd.expires_at) < new Date()) {
      this.logger.warn(`Command ${cmd.id} already expired, skipping`);
      return;
    }

    // Mark as running
    try {
      await this.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
        status: 'running',
      });
    } catch (err) {
      this.logger.error(`Failed to mark command ${cmd.id} as running:`, err);
      return;
    }

    // Execute
    try {
      const result = await executeCommand(
        cmd.command_type,
        cmd.payload,
        this.config,
        this.logger,
      );

      await this.apiClient.patch(`/api/v1/vm-ops/commands/${cmd.id}`, {
        status: 'succeeded',
        result: result ?? {},
      });

      this.logger.info(`Command ${cmd.id} succeeded`);
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
    }
  }
}
