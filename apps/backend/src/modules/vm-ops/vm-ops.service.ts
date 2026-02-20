import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Injectable, Logger } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { cloneCommand, mapDbCommand, normalizeTenantId, nowIso } from './vm-ops.mappers';
import {
  buildDeadLetterMessage,
  buildRequeueMessage,
  extractDispatchRequeueCount,
  getVmOpsReliabilityConfig,
} from './vm-ops.reliability';
import { VmOpsRepository } from './vm-ops.repository';
import {
  TERMINAL_STATUSES,
  type VmCommandEvent,
  type VmCommandRecord,
  type Waiter,
} from './vm-ops.types';

@Injectable()
export class VmOpsService {
  private readonly logger = new Logger(VmOpsService.name);
  private readonly commandEvents: VmCommandEvent[] = [];
  private readonly eventEmitter = new EventEmitter();
  private readonly waiters = new Set<Waiter>();
  private nextEventId = 1;
  private readonly runningCommandMaxMs: number;
  private readonly dispatchedCommandMaxMs: number;
  private readonly dispatchMaxRequeues: number;
  private readonly staleSweepTimer: ReturnType<typeof setInterval>;

  private static readonly MAX_EVENT_HISTORY = 500;

  constructor(private readonly repository: VmOpsRepository) {
    const reliabilityConfig = getVmOpsReliabilityConfig(process.env);
    this.runningCommandMaxMs = reliabilityConfig.runningCommandMaxMs;
    this.dispatchedCommandMaxMs = reliabilityConfig.dispatchedCommandMaxMs;
    this.dispatchMaxRequeues = reliabilityConfig.dispatchMaxRequeues;

    this.staleSweepTimer = setInterval(() => {
      this.sweepStaleRunningCommands();
    }, 60_000);
    if (typeof this.staleSweepTimer.unref === 'function') {
      this.staleSweepTimer.unref();
    }
  }

  private emitCommandEvent(command: VmCommandRecord): void {
    const event: VmCommandEvent = {
      event_id: this.nextEventId,
      event_type: 'vm-command',
      tenant_id: command.tenant_id,
      server_time: nowIso(),
      command: cloneCommand(command),
    };

    this.nextEventId += 1;
    this.commandEvents.push(event);
    if (this.commandEvents.length > VmOpsService.MAX_EVENT_HISTORY) {
      this.commandEvents.splice(0, this.commandEvents.length - VmOpsService.MAX_EVENT_HISTORY);
    }

    this.eventEmitter.emit('vm-command', event);
  }

  private async resolvePendingWaiters(tenantId: string, agentId: string): Promise<void> {
    const pending = Array.from(this.waiters);
    for (const waiter of pending) {
      if (waiter.tenantId !== tenantId || waiter.agentId !== agentId) {
        continue;
      }

      let claimed: Awaited<ReturnType<VmOpsRepository['claimNextQueued']>> = null;
      try {
        claimed = await this.repository.claimNextQueued({ tenantId, agentId });
      } catch (error) {
        this.logger.error(
          `Failed to resolve pending command waiter: ${(error as Error)?.message || String(error)}`,
        );
        break;
      }
      if (!claimed) {
        break;
      }
      const command = mapDbCommand(claimed);
      this.emitCommandEvent(command);

      this.waiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.resolve(command);
    }
  }

  async dispatch(input: {
    tenantId: string;
    agentId: string;
    commandType: string;
    payload: Record<string, unknown>;
    createdBy?: string;
    expiresInSeconds?: number;
  }): Promise<VmCommandRecord> {
    const id = randomUUID();
    const queuedAt = nowIso();
    const expiresAt =
      input.expiresInSeconds && Number.isFinite(input.expiresInSeconds)
        ? new Date(Date.now() + input.expiresInSeconds * 1_000).toISOString()
        : null;

    const normalizedTenantId = input.tenantId ? normalizeTenantId(input.tenantId) : '';
    if (!normalizedTenantId) {
      throw new Error('tenantId is required');
    }

    const command: VmCommandRecord = {
      id,
      tenant_id: normalizedTenantId,
      agent_id: input.agentId,
      command_type: input.commandType,
      payload: { ...(input.payload || {}) },
      status: 'queued',
      queued_at: queuedAt,
      expires_at: expiresAt,
      started_at: null,
      completed_at: null,
      result: null,
      error_message: null,
      created_by: input.createdBy || null,
    };
    const dbCommand = await this.repository.create({
      id,
      tenantId: command.tenant_id,
      agentId: command.agent_id,
      commandType: command.command_type,
      payload: command.payload as Prisma.InputJsonValue,
      status: command.status,
      expiresAt: expiresAt ? new Date(expiresAt) : null,
      createdBy: command.created_by || null,
    });
    const mapped = mapDbCommand(dbCommand);
    this.emitCommandEvent(mapped);
    void this.resolvePendingWaiters(mapped.tenant_id, mapped.agent_id);
    return mapped;
  }

  async getById(id: string, tenantId?: string): Promise<VmCommandRecord | null> {
    const dbCommand = await this.repository.findById(id);
    if (!dbCommand) return null;
    const mapped = mapDbCommand(dbCommand);
    if (tenantId && mapped.tenant_id !== tenantId) {
      return null;
    }
    return mapped;
  }

  async listCommands(filters: {
    tenantId?: string;
    agentId?: string;
    status?: string;
  }): Promise<VmCommandRecord[]> {
    const statusFilter = String(filters.status || '')
      .trim()
      .toLowerCase();
    const agentIdFilter = String(filters.agentId || '').trim();

    const dbFilters: { tenantId?: string; agentId?: string; status?: string } = {};
    if (filters.tenantId) {
      dbFilters.tenantId = filters.tenantId;
    }
    if (agentIdFilter) {
      dbFilters.agentId = agentIdFilter;
    }
    if (statusFilter) {
      dbFilters.status = statusFilter;
    }
    const rows = await this.repository.list(dbFilters);
    return rows.map((row) => mapDbCommand(row));
  }

  async waitForNextAgentCommand(input: {
    tenantId: string;
    agentId: string;
    timeoutMs?: number;
  }): Promise<VmCommandRecord | null> {
    const tenantId = normalizeTenantId(input.tenantId);
    if (!tenantId) {
      throw new Error('tenantId is required');
    }
    const agentId = String(input.agentId || '').trim();
    const timeoutMs = Number.isFinite(input.timeoutMs) ? Number(input.timeoutMs) : 25_000;

    const claimed = await this.repository.claimNextQueued({ tenantId, agentId });
    if (claimed) {
      const mapped = mapDbCommand(claimed);
      this.emitCommandEvent(mapped);
      return mapped;
    }

    return new Promise((resolve) => {
      const waiter: Waiter = {
        tenantId,
        agentId,
        resolve,
        timer: setTimeout(() => {
          this.waiters.delete(waiter);
          resolve(null);
        }, timeoutMs),
      };
      this.waiters.add(waiter);
    });
  }

  async updateCommandStatus(input: {
    id: string;
    status: 'running' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
    result?: unknown;
    errorMessage?: string;
    tenantId?: string;
  }): Promise<VmCommandRecord | null> {
    const normalizedTenantId = input.tenantId ? normalizeTenantId(input.tenantId) : '';
    if (normalizedTenantId) {
      const existing = await this.repository.findById(input.id);
      if (!existing) {
        return null;
      }
      const existingMapped = mapDbCommand(existing);
      if (existingMapped.tenant_id !== normalizedTenantId) {
        return null;
      }
    }

    const now = new Date();
    const updated = await this.repository.updateStatus({
      id: input.id,
      status: input.status,
      ...(Object.hasOwn(input, 'result')
        ? { result: (input.result ?? null) as Prisma.InputJsonValue | null }
        : {}),
      ...(Object.hasOwn(input, 'errorMessage') ? { errorMessage: input.errorMessage ?? null } : {}),
      ...(input.status === 'running' ? { startedAt: now } : {}),
      ...(TERMINAL_STATUSES.has(input.status) ? { completedAt: now } : {}),
    });
    if (!updated) {
      return null;
    }
    const mapped = mapDbCommand(updated);
    this.emitCommandEvent(mapped);
    return mapped;
  }

  private async sweepStaleRunningCommands(): Promise<void> {
    try {
      const expiredRunningCount = await this.repository.expireStaleRunning({
        runningMaxAgeMs: this.runningCommandMaxMs,
      });

      const staleDispatched = await this.repository.listStaleDispatched({
        dispatchedMaxAgeMs: this.dispatchedCommandMaxMs,
      });

      let requeuedCount = 0;
      let deadLetteredCount = 0;
      for (const command of staleDispatched) {
        const retryCount = extractDispatchRequeueCount(command.errorMessage);
        if (retryCount < this.dispatchMaxRequeues) {
          const updated = await this.repository.requeueDispatched({
            id: command.id,
            errorMessage: buildRequeueMessage(
              retryCount + 1,
              this.dispatchedCommandMaxMs,
              command.errorMessage,
            ),
          });
          if (updated) {
            requeuedCount += 1;
            this.emitCommandEvent(mapDbCommand(updated));
          }
          continue;
        }

        const updated = await this.repository.deadLetterDispatched({
          id: command.id,
          errorMessage: buildDeadLetterMessage(
            retryCount,
            this.dispatchedCommandMaxMs,
            command.errorMessage,
          ),
        });
        if (updated) {
          deadLetteredCount += 1;
          this.emitCommandEvent(mapDbCommand(updated));
        }
      }

      if (expiredRunningCount > 0 || requeuedCount > 0 || deadLetteredCount > 0) {
        this.logger.warn(
          `Reliability sweep: runningExpired=${expiredRunningCount}, dispatchedRequeued=${requeuedCount}, dispatchedDeadLettered=${deadLetteredCount} (running>${this.runningCommandMaxMs}ms, dispatched>${this.dispatchedCommandMaxMs}ms, maxRequeues=${this.dispatchMaxRequeues})`,
        );
      }
    } catch (error) {
      this.logger.error(`Reliability sweep failed: ${(error as Error)?.message || String(error)}`);
    }
  }

  listEventsSince(lastEventId: number): VmCommandEvent[] {
    return this.commandEvents
      .filter((event) => event.event_id > lastEventId)
      .map((event) => ({
        ...event,
        command: cloneCommand(event.command),
      }));
  }

  subscribeEvents(listener: (event: VmCommandEvent) => void): () => void {
    const handler = (event: VmCommandEvent) => listener(event);
    this.eventEmitter.on('vm-command', handler);

    return () => {
      this.eventEmitter.off('vm-command', handler);
    };
  }
}
