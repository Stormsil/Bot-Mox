import { randomUUID } from 'node:crypto';
import type { AgentTransportMode } from './agent-loop.constants';
import {
  COMMAND_ERROR_BACKOFF_MS,
  HEARTBEAT_INTERVAL_MS,
  NEXT_COMMAND_TIMEOUT_MS,
  RATE_LIMIT_COOLDOWN_MS,
  resolveTransportMode,
  transportModePrefersWs,
} from './agent-loop.constants';
import { type ProcessCommandResult, processQueuedCommand } from './agent-loop-command';
import { isRateLimitedError, isRevokedError } from './agent-loop-errors';
import {
  buildTransportHeartbeatMetadata,
  createWsTransportState,
  fetchNextCommandViaWs,
  markWsHeartbeatFallback,
  reportWsEvent,
  type WsTransportContext,
} from './agent-loop-ws';
import type { ApiClient } from './api-client';
import type { AgentConfig } from './config-store';
import type { Logger } from './logger';
import type { QueuedCommand } from './schemas';
import { queuedCommandSchema } from './schemas';

export type AgentStatus = 'idle' | 'connecting' | 'online' | 'error' | 'revoked';
export type StatusCallback = (status: AgentStatus, message?: string) => void;

export class AgentLoop {
  private interval: ReturnType<typeof setInterval> | null = null;
  private status: AgentStatus = 'idle';
  private onStatusChange: StatusCallback | null = null;
  private nextTickAt = 0;
  private running = false;
  private readonly transportMode: AgentTransportMode;
  private readonly wsState = createWsTransportState();

  constructor(
    private config: AgentConfig,
    private apiClient: ApiClient,
    private logger: Logger,
  ) {
    this.transportMode = resolveTransportMode();
  }

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
    if (this.wsState.client) {
      try {
        this.wsState.client.close();
      } catch {
        // noop
      }
      this.wsState.client = null;
    }
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

  private async sendHeartbeat(): Promise<void> {
    if (!this.running) {
      return;
    }
    if (Date.now() < this.nextTickAt) {
      return;
    }

    try {
      if (transportModePrefersWs(this.transportMode)) {
        const wsHeartbeatReported = await reportWsEvent(
          this.getWsContext(),
          {
            type: 'heartbeat',
            request_id: randomUUID(),
            agent_id: this.config.agentId,
            status: 'active',
            metadata: this.buildTransportHeartbeatMetadata(),
          },
          'agent.heartbeat',
        );
        if (wsHeartbeatReported) {
          this.setStatus('online');
          return;
        }

        const fallbackCount = markWsHeartbeatFallback(this.wsState);
        this.logger.warn('WS heartbeat unavailable, using HTTP fallback', {
          event_name: 'agent.transport.ws.heartbeat_fallback_http',
          fallback_count: fallbackCount,
          agent_id: this.config.agentId,
        });
      }

      await this.apiClient.post('/api/v1/agents/heartbeat', {
        agent_id: this.config.agentId,
        metadata: this.buildTransportHeartbeatMetadata(),
      });
      this.setStatus('online');
    } catch (err) {
      if (isRateLimitedError(err)) {
        this.nextTickAt = Date.now() + RATE_LIMIT_COOLDOWN_MS;
        this.setStatus(
          'error',
          `Rate limited, retrying in ${Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000)}s`,
        );
        return;
      }

      if (isRevokedError(err)) {
        this.setStatus('revoked', err.message);
        this.stop();
        return;
      }

      const msg = err instanceof Error ? err.message : String(err);
      this.setStatus('error', msg);
    }
  }

  private async fetchNextCommand(): Promise<QueuedCommand | null> {
    if (transportModePrefersWs(this.transportMode)) {
      const wsCommand = await fetchNextCommandViaWs(this.getWsContext());
      if (wsCommand || this.transportMode === 'ws') {
        return wsCommand;
      }
      // hybrid fallback to HTTP long-polling if WS path is unavailable
    }

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
        await this.sleep(500);
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
        if (isRateLimitedError(err)) {
          this.nextTickAt = Date.now() + RATE_LIMIT_COOLDOWN_MS;
          this.setStatus(
            'error',
            `Rate limited, retrying in ${Math.ceil(RATE_LIMIT_COOLDOWN_MS / 1000)}s`,
          );
          await this.sleep(500);
          continue;
        }

        if (isRevokedError(err)) {
          this.setStatus('revoked', err.message);
          this.stop();
          return;
        }

        const msg = err instanceof Error ? err.message : String(err);
        this.setStatus('error', msg);
        await this.sleep(COMMAND_ERROR_BACKOFF_MS);
      }
    }
  }

  private async processCommand(cmd: QueuedCommand): Promise<ProcessCommandResult> {
    return await processQueuedCommand(cmd, {
      config: this.config,
      apiClient: this.apiClient,
      logger: this.logger,
      reportWsEvent: async (payload, expectedType) =>
        reportWsEvent(this.getWsContext(), payload, expectedType),
      isRateLimitedError: (err) => isRateLimitedError(err),
    });
  }

  private getWsContext(): WsTransportContext {
    return {
      config: this.config,
      logger: this.logger,
      state: this.wsState,
      isRunning: () => this.running,
    };
  }

  private buildTransportHeartbeatMetadata(): Record<string, unknown> {
    return buildTransportHeartbeatMetadata(this.transportMode, this.wsState);
  }

  private async sleep(ms: number): Promise<void> {
    await new Promise((resolve) => setTimeout(resolve, ms));
  }
}
