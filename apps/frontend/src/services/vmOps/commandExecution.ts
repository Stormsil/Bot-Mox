import {
  dispatchVmOpsViaContract,
  getVmOpsCommandViaContract,
} from '../../providers/vmops-contract-client';
import { ApiClientError } from '../apiClient';
import { subscribeToVmOpsEvents, type VmOpsCommandEvent } from '../vmOpsEventsService';
import { type CommandStatus, toCommandStatus } from './parsers';

const TERMINAL_STATES = new Set(['succeeded', 'failed', 'expired', 'cancelled']);
const VM_OPS_WAIT_TIMEOUT_MS = 120_000;
const VM_OPS_STATUS_POLL_INTERVAL_MS = 1_500;

const inFlightCommandWaits = new Map<string, Promise<unknown>>();

function commandErrorFromStatus(status: CommandStatus): Error {
  const statusValue = String(status.status || '')
    .trim()
    .toLowerCase();
  if (statusValue === 'failed') {
    const rawMessage = String(status.error_message || 'Command failed').trim();
    const tagged = rawMessage.match(/^([A-Z_]+):\s*(.+)$/);
    if (tagged) {
      return new ApiClientError(tagged[2], {
        status: 409,
        code: tagged[1],
        details: {
          command_id: status.id,
          command_type: status.command_type,
        },
      });
    }
    return new Error(rawMessage || 'Command failed');
  }
  return new Error(`Command ${statusValue || 'unknown'}`);
}

async function fetchCommandStatus(commandId: string): Promise<CommandStatus> {
  const { data } = await getVmOpsCommandViaContract(commandId);
  return toCommandStatus(data);
}

function isTerminalStatus(status: string): boolean {
  return TERMINAL_STATES.has(
    String(status || '')
      .trim()
      .toLowerCase(),
  );
}

async function waitForCommandTerminal<T>(params: {
  commandId: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
  agentId?: string;
}): Promise<T> {
  const commandId = String(params.commandId || '').trim();
  if (!commandId) {
    throw new Error('commandId is required');
  }

  const existingWait = inFlightCommandWaits.get(commandId);
  if (existingWait) {
    return existingWait as Promise<T>;
  }

  const waitPromise = (async (): Promise<T> => {
    const timeoutMs = params.timeoutMs ?? VM_OPS_WAIT_TIMEOUT_MS;
    const pollIntervalMs = Math.max(
      500,
      Math.min(10_000, Math.trunc(params.pollIntervalMs ?? VM_OPS_STATUS_POLL_INTERVAL_MS)),
    );
    const initialStatus = await fetchCommandStatus(commandId);
    if (isTerminalStatus(initialStatus.status)) {
      if (initialStatus.status === 'succeeded') {
        return initialStatus.result as T;
      }
      throw commandErrorFromStatus(initialStatus);
    }

    return new Promise<T>((resolve, reject) => {
      let settled = false;
      let pollTimer: ReturnType<typeof setTimeout> | null = null;

      const cleanupCallbacks: Array<() => void> = [];
      const cleanup = () => {
        cleanupCallbacks.forEach((fn) => {
          try {
            fn();
          } catch {
            // noop
          }
        });
        cleanupCallbacks.length = 0;
      };

      const settle = (handler: () => void) => {
        if (settled) return;
        settled = true;
        cleanup();
        handler();
      };

      const handleTerminalStatus = (status: CommandStatus) => {
        settle(() => {
          if (status.status === 'succeeded') {
            resolve(status.result as T);
            return;
          }
          reject(commandErrorFromStatus(status));
        });
      };

      const pollCommandStatus = async () => {
        if (settled) return;
        try {
          const status = await fetchCommandStatus(commandId);
          if (isTerminalStatus(status.status)) {
            handleTerminalStatus(status);
            return;
          }
        } catch {
          // Ignore transient poll errors; timeout handler will do final check.
        }
        if (!settled) {
          pollTimer = globalThis.setTimeout(() => {
            pollTimer = null;
            void pollCommandStatus();
          }, pollIntervalMs);
        }
      };

      cleanupCallbacks.push(() => {
        if (pollTimer) {
          globalThis.clearTimeout(pollTimer);
          pollTimer = null;
        }
      });

      const unsubscribe = subscribeToVmOpsEvents(
        (event: VmOpsCommandEvent) => {
          const command = event.command;
          if (String(command.id || '').trim() !== commandId) {
            return;
          }
          if (!isTerminalStatus(command.status)) {
            return;
          }

          handleTerminalStatus(command as CommandStatus);
        },
        undefined,
        { agentId: params.agentId, commandId },
      );
      cleanupCallbacks.push(unsubscribe);

      pollTimer = globalThis.setTimeout(
        () => {
          pollTimer = null;
          void pollCommandStatus();
        },
        Math.min(300, pollIntervalMs),
      );

      const timeout = globalThis.setTimeout(async () => {
        try {
          const status = await fetchCommandStatus(commandId);
          settle(() => {
            if (status.status === 'succeeded') {
              resolve(status.result as T);
              return;
            }
            if (isTerminalStatus(status.status)) {
              reject(commandErrorFromStatus(status));
              return;
            }
            reject(new Error('Command timed out'));
          });
        } catch (error) {
          settle(() => {
            reject(error instanceof Error ? error : new Error('Command timed out'));
          });
        }
      }, timeoutMs);
      cleanupCallbacks.push(() => globalThis.clearTimeout(timeout));
    });
  })();

  inFlightCommandWaits.set(commandId, waitPromise);
  try {
    return await waitPromise;
  } finally {
    if (inFlightCommandWaits.get(commandId) === waitPromise) {
      inFlightCommandWaits.delete(commandId);
    }
  }
}

export async function dispatchAndPoll<T = unknown>(params: {
  type: 'proxmox' | 'syncthing';
  action: string;
  agentId: string;
  params?: Record<string, unknown>;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<T> {
  const { data: cmd } = await dispatchVmOpsViaContract(params.type, params.action, {
    agent_id: params.agentId,
    params: params.params,
  });
  const command = toCommandStatus(cmd);

  return waitForCommandTerminal<T>({
    commandId: command.id,
    timeoutMs: params.timeoutMs,
    pollIntervalMs: params.pollIntervalMs,
    agentId: params.agentId,
  });
}
