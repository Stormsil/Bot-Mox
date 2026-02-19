import { buildApiUrl } from '../config/env';
import { authFetch } from './authFetch';

const INITIAL_RECONNECT_DELAY_MS = 1_000;
const MAX_RECONNECT_DELAY_MS = 15_000;

export interface VmOpsCommandEvent {
  event_id: number;
  event_type: string;
  tenant_id: string;
  server_time: string;
  command: {
    id: string;
    tenant_id: string;
    agent_id: string;
    command_type: string;
    status: string;
    payload?: Record<string, unknown>;
    result?: unknown;
    error_message?: string | null;
    queued_at?: string | null;
    started_at?: string | null;
    completed_at?: string | null;
    expires_at?: string | null;
    created_by?: string | null;
  };
}

interface VmOpsEventsListener {
  onEvent: (event: VmOpsCommandEvent) => void;
  onError?: (error: Error) => void;
  agentId?: string;
  commandId?: string;
}

const listeners = new Set<VmOpsEventsListener>();

let streamAbortController: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;
let isConnecting = false;
let lastEventId = 0;

function normalizeFilter(value?: string): string | undefined {
  const normalized = String(value || '').trim();
  return normalized || undefined;
}

function notifyErrors(error: Error): void {
  listeners.forEach((listener) => {
    try {
      listener.onError?.(error);
    } catch {
      // noop
    }
  });
}

function emitEvent(event: VmOpsCommandEvent): void {
  const eventId = Number(event.event_id);
  if (Number.isFinite(eventId) && eventId > 0) {
    lastEventId = Math.max(lastEventId, eventId);
  }

  listeners.forEach((listener) => {
    if (listener.agentId && String(event.command?.agent_id || '').trim() !== listener.agentId) {
      return;
    }
    if (listener.commandId && String(event.command?.id || '').trim() !== listener.commandId) {
      return;
    }

    try {
      listener.onEvent(event);
    } catch {
      // noop
    }
  });
}

function parseSseBlock(rawBlock: string): VmOpsCommandEvent | null {
  const lines = rawBlock.split('\n');
  let eventId = 0;
  let eventName = '';
  const dataLines: string[] = [];

  for (const line of lines) {
    if (!line || line.startsWith(':')) {
      continue;
    }

    if (line.startsWith('id:')) {
      const idValue = Number.parseInt(line.slice('id:'.length).trim(), 10);
      if (Number.isFinite(idValue) && idValue > 0) {
        eventId = idValue;
      }
      continue;
    }

    if (line.startsWith('event:')) {
      eventName = line.slice('event:'.length).trim();
      continue;
    }

    if (line.startsWith('data:')) {
      dataLines.push(line.slice('data:'.length).trimStart());
    }
  }

  if (!dataLines.length) {
    return null;
  }

  try {
    const parsed = JSON.parse(dataLines.join('\n')) as VmOpsCommandEvent;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    if (!parsed.command || typeof parsed.command !== 'object') {
      return null;
    }

    if (!parsed.event_id && eventId > 0) {
      parsed.event_id = eventId;
    }
    if (!parsed.event_type && eventName) {
      parsed.event_type = eventName;
    }
    return parsed;
  } catch {
    return null;
  }
}

function clearReconnectTimer(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
}

function scheduleReconnect(): void {
  if (listeners.size === 0 || reconnectTimer) {
    return;
  }

  reconnectTimer = setTimeout(() => {
    reconnectTimer = null;
    void ensureVmOpsEventsConnection();
  }, reconnectDelayMs);

  reconnectDelayMs = Math.min(MAX_RECONNECT_DELAY_MS, reconnectDelayMs * 2);
}

function stopVmOpsEventsConnection(): void {
  clearReconnectTimer();

  if (streamAbortController) {
    streamAbortController.abort();
    streamAbortController = null;
  }
}

async function connectVmOpsEventsStream(signal: AbortSignal): Promise<void> {
  const query = lastEventId > 0 ? `?last_event_id=${lastEventId}` : '';
  const response = await authFetch(buildApiUrl(`/api/v1/vm-ops/events${query}`), {
    method: 'GET',
    headers: {
      Accept: 'text/event-stream',
    },
    signal,
  });

  if (!response.ok || !response.body) {
    throw new Error(`VM events stream unavailable (HTTP ${response.status})`);
  }

  reconnectDelayMs = INITIAL_RECONNECT_DELAY_MS;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, '\n');

    let separatorIndex = buffer.indexOf('\n\n');
    while (separatorIndex >= 0) {
      const rawBlock = buffer.slice(0, separatorIndex);
      buffer = buffer.slice(separatorIndex + 2);

      const event = parseSseBlock(rawBlock);
      if (event) {
        emitEvent(event);
      }

      separatorIndex = buffer.indexOf('\n\n');
    }
  }

  throw new Error('VM events stream disconnected');
}

export async function ensureVmOpsEventsConnection(): Promise<void> {
  if (isConnecting || listeners.size === 0 || streamAbortController) {
    return;
  }

  isConnecting = true;
  const controller = new AbortController();
  streamAbortController = controller;

  try {
    await connectVmOpsEventsStream(controller.signal);
  } catch (error) {
    if (!controller.signal.aborted) {
      const normalizedError = error instanceof Error ? error : new Error('VM events stream error');
      notifyErrors(normalizedError);
      scheduleReconnect();
    }
  } finally {
    if (streamAbortController === controller) {
      streamAbortController = null;
    }
    isConnecting = false;
  }
}

export function subscribeToVmOpsEvents(
  onEvent: (event: VmOpsCommandEvent) => void,
  onError?: (error: Error) => void,
  options: { agentId?: string; commandId?: string } = {},
): () => void {
  const listener: VmOpsEventsListener = {
    onEvent,
    onError,
    agentId: normalizeFilter(options.agentId),
    commandId: normalizeFilter(options.commandId),
  };
  listeners.add(listener);
  void ensureVmOpsEventsConnection();

  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stopVmOpsEventsConnection();
    }
  };
}
