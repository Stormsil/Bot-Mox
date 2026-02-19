import { randomUUID } from 'node:crypto';
import { EventEmitter } from 'node:events';
import { Injectable } from '@nestjs/common';

type VmCommandStatus =
  | 'queued'
  | 'dispatched'
  | 'running'
  | 'succeeded'
  | 'failed'
  | 'expired'
  | 'cancelled';

const TERMINAL_STATUSES: ReadonlySet<VmCommandStatus> = new Set([
  'succeeded',
  'failed',
  'expired',
  'cancelled',
]);

interface VmCommandRecord {
  id: string;
  tenant_id: string;
  agent_id: string;
  command_type: string;
  payload: Record<string, unknown>;
  status: VmCommandStatus;
  queued_at: string;
  expires_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result?: unknown | null;
  error_message?: string | null;
  created_by?: string | null;
}

interface VmCommandEvent {
  event_id: number;
  event_type: 'vm-command';
  tenant_id: string;
  server_time: string;
  command: VmCommandRecord;
}

interface Waiter {
  tenantId: string;
  agentId: string;
  resolve: (command: VmCommandRecord | null) => void;
  timer: ReturnType<typeof setTimeout>;
}

@Injectable()
export class VmOpsService {
  private readonly commands = new Map<string, VmCommandRecord>();
  private readonly commandOrder: string[] = [];
  private readonly commandEvents: VmCommandEvent[] = [];
  private readonly eventEmitter = new EventEmitter();
  private readonly waiters = new Set<Waiter>();
  private nextEventId = 1;

  private static readonly MAX_EVENT_HISTORY = 500;

  private nowIso(): string {
    return new Date().toISOString();
  }

  private cloneCommand(command: VmCommandRecord): VmCommandRecord {
    return {
      ...command,
      payload: { ...command.payload },
    };
  }

  private emitCommandEvent(command: VmCommandRecord): void {
    const event: VmCommandEvent = {
      event_id: this.nextEventId,
      event_type: 'vm-command',
      tenant_id: command.tenant_id,
      server_time: this.nowIso(),
      command: this.cloneCommand(command),
    };

    this.nextEventId += 1;
    this.commandEvents.push(event);
    if (this.commandEvents.length > VmOpsService.MAX_EVENT_HISTORY) {
      this.commandEvents.splice(0, this.commandEvents.length - VmOpsService.MAX_EVENT_HISTORY);
    }

    this.eventEmitter.emit('vm-command', event);
  }

  private findQueuedCommand(tenantId: string, agentId: string): VmCommandRecord | null {
    for (const commandId of this.commandOrder) {
      const command = this.commands.get(commandId);
      if (!command) {
        continue;
      }
      if (command.tenant_id !== tenantId) {
        continue;
      }
      if (command.agent_id !== agentId) {
        continue;
      }
      if (command.status !== 'queued') {
        continue;
      }
      return command;
    }
    return null;
  }

  private takeQueuedCommand(tenantId: string, agentId: string): VmCommandRecord | null {
    const command = this.findQueuedCommand(tenantId, agentId);
    if (!command) {
      return null;
    }

    command.status = 'dispatched';
    this.emitCommandEvent(command);
    return this.cloneCommand(command);
  }

  private resolvePendingWaiters(tenantId: string, agentId: string): void {
    const pending = Array.from(this.waiters);
    for (const waiter of pending) {
      if (waiter.tenantId !== tenantId || waiter.agentId !== agentId) {
        continue;
      }

      const command = this.takeQueuedCommand(tenantId, agentId);
      if (!command) {
        break;
      }

      this.waiters.delete(waiter);
      clearTimeout(waiter.timer);
      waiter.resolve(command);
    }
  }

  dispatch(input: {
    tenantId?: string;
    agentId: string;
    commandType: string;
    payload: Record<string, unknown>;
    createdBy?: string;
    expiresInSeconds?: number;
  }): VmCommandRecord {
    const id = randomUUID();
    const queuedAt = this.nowIso();
    const expiresAt =
      input.expiresInSeconds && Number.isFinite(input.expiresInSeconds)
        ? new Date(Date.now() + input.expiresInSeconds * 1_000).toISOString()
        : null;

    const command: VmCommandRecord = {
      id,
      tenant_id: String(input.tenantId || 'default'),
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

    this.commands.set(id, command);
    this.commandOrder.push(id);
    this.emitCommandEvent(command);
    this.resolvePendingWaiters(command.tenant_id, command.agent_id);

    return this.cloneCommand(command);
  }

  getById(id: string): VmCommandRecord | null {
    const command = this.commands.get(id);
    return command ? this.cloneCommand(command) : null;
  }

  listCommands(filters: { agentId?: string; status?: string }): VmCommandRecord[] {
    const statusFilter = String(filters.status || '')
      .trim()
      .toLowerCase();
    const agentIdFilter = String(filters.agentId || '').trim();

    return this.commandOrder
      .map((commandId) => this.commands.get(commandId))
      .filter((command): command is VmCommandRecord => Boolean(command))
      .filter((command) => {
        if (agentIdFilter && command.agent_id !== agentIdFilter) {
          return false;
        }
        if (statusFilter && String(command.status).toLowerCase() !== statusFilter) {
          return false;
        }
        return true;
      })
      .map((command) => this.cloneCommand(command));
  }

  waitForNextAgentCommand(input: {
    tenantId?: string;
    agentId: string;
    timeoutMs?: number;
  }): Promise<VmCommandRecord | null> {
    const tenantId = String(input.tenantId || 'default');
    const agentId = String(input.agentId || '').trim();
    const timeoutMs = Number.isFinite(input.timeoutMs) ? Number(input.timeoutMs) : 25_000;

    const immediate = this.takeQueuedCommand(tenantId, agentId);
    if (immediate) {
      return Promise.resolve(immediate);
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

  updateCommandStatus(input: {
    id: string;
    status: 'running' | 'succeeded' | 'failed';
    result?: unknown;
    errorMessage?: string;
  }): VmCommandRecord | null {
    const command = this.commands.get(input.id);
    if (!command) {
      return null;
    }

    command.status = input.status;
    if (input.status === 'running') {
      command.started_at = command.started_at || this.nowIso();
    }
    if (TERMINAL_STATUSES.has(input.status)) {
      command.completed_at = this.nowIso();
      command.started_at = command.started_at || command.completed_at;
    }

    if (Object.hasOwn(input, 'result')) {
      command.result = input.result ?? null;
    }
    if (Object.hasOwn(input, 'errorMessage')) {
      command.error_message = input.errorMessage ?? null;
    }

    this.emitCommandEvent(command);
    return this.cloneCommand(command);
  }

  listEventsSince(lastEventId: number): VmCommandEvent[] {
    return this.commandEvents
      .filter((event) => event.event_id > lastEventId)
      .map((event) => ({
        ...event,
        command: this.cloneCommand(event.command),
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
