import { randomUUID } from 'node:crypto';
import { agentWsEventSchema, agentWsInboundMessageSchema } from '@botmox/api-contract';
import WebSocket from 'ws';
import {
  NEXT_COMMAND_TIMEOUT_MS,
  WS_CONNECT_TIMEOUT_MS,
  WS_EVENT_TIMEOUT_MS,
  WS_RECONNECT_BASE_MS,
  WS_RECONNECT_JITTER_RATIO,
  WS_RECONNECT_MAX_MS,
} from './agent-loop.constants';
import type { AgentConfig } from './config-store';
import type { Logger } from './logger';
import { computeReconnectDelayMs } from './reconnect-policy';
import { type QueuedCommand, queuedCommandSchema } from './schemas';

export interface WsTransportState {
  client: WebSocket | null;
  reconnectAttempt: number;
  nextReconnectAt: number;
  fallbackToHttpCount: number;
  connectSuccessCount: number;
  connectFailureCount: number;
  lastConnectedAt: string | null;
  lastFailureAt: string | null;
}

export interface WsTransportContext {
  config: AgentConfig;
  logger: Logger;
  state: WsTransportState;
  isRunning: () => boolean;
}

export function createWsTransportState(): WsTransportState {
  return {
    client: null,
    reconnectAttempt: 0,
    nextReconnectAt: 0,
    fallbackToHttpCount: 0,
    connectSuccessCount: 0,
    connectFailureCount: 0,
    lastConnectedAt: null,
    lastFailureAt: null,
  };
}

export function markWsHeartbeatFallback(state: WsTransportState): number {
  state.fallbackToHttpCount += 1;
  return state.fallbackToHttpCount;
}

export function buildTransportHeartbeatMetadata(
  transportMode: string,
  state: WsTransportState,
): Record<string, unknown> {
  return {
    transport_mode: transportMode,
    ws_reconnect_attempt: state.reconnectAttempt,
    ws_next_reconnect_at:
      state.nextReconnectAt > 0 ? new Date(state.nextReconnectAt).toISOString() : null,
    ws_fallback_http_count: state.fallbackToHttpCount,
    ws_connect_success_count: state.connectSuccessCount,
    ws_connect_failure_count: state.connectFailureCount,
    ws_last_connected_at: state.lastConnectedAt,
    ws_last_failure_at: state.lastFailureAt,
  };
}

export async function ensureWsClient(ctx: WsTransportContext): Promise<WebSocket | null> {
  if (!ctx.isRunning()) return null;
  if (ctx.state.client && ctx.state.client.readyState === WebSocket.OPEN) {
    return ctx.state.client;
  }
  if (Date.now() < ctx.state.nextReconnectAt) {
    return null;
  }

  if (ctx.state.client) {
    try {
      ctx.state.client.terminate();
    } catch {
      // noop
    }
    ctx.state.client = null;
  }

  const requestId = randomUUID();
  const wsBase = toWsUrl(ctx.config.serverUrl);
  const wsUrl = `${wsBase}/api/v1/agents/ws?agent_id=${encodeURIComponent(ctx.config.agentId)}&request_id=${encodeURIComponent(requestId)}&token=${encodeURIComponent(ctx.config.apiToken)}`;

  const ws = new WebSocket(wsUrl, {
    handshakeTimeout: WS_CONNECT_TIMEOUT_MS,
    headers: {
      Authorization: `Bearer ${ctx.config.apiToken}`,
      'x-request-id': requestId,
    },
  });

  return await new Promise<WebSocket | null>((resolve) => {
    const onOpen = () => {
      cleanup();
      ctx.state.client = ws;
      if (ctx.state.reconnectAttempt > 0) {
        ctx.logger.info('WS transport recovered', {
          event_name: 'agent.transport.ws.recovered',
          reconnect_attempts: ctx.state.reconnectAttempt,
          request_id: requestId,
          agent_id: ctx.config.agentId,
        });
      }
      ctx.state.reconnectAttempt = 0;
      ctx.state.nextReconnectAt = 0;
      ctx.state.connectSuccessCount += 1;
      ctx.state.lastConnectedAt = new Date().toISOString();
      ctx.logger.info('WS transport connected', {
        event_name: 'agent.transport.ws.connected',
        request_id: requestId,
        agent_id: ctx.config.agentId,
      });
      resolve(ws);
    };
    const onError = (err: Error) => {
      cleanup();
      onWsFailure(ctx);
      ctx.logger.warn(`WS transport unavailable: ${err.message}`, {
        event_name: 'agent.transport.ws.unavailable',
        request_id: requestId,
        agent_id: ctx.config.agentId,
        reconnect_attempt: ctx.state.reconnectAttempt,
        next_reconnect_at: new Date(ctx.state.nextReconnectAt).toISOString(),
      });
      resolve(null);
    };
    const onClose = () => {
      cleanup();
      onWsFailure(ctx);
      resolve(null);
    };
    const timer = setTimeout(() => {
      cleanup();
      try {
        ws.terminate();
      } catch {
        // noop
      }
      onWsFailure(ctx);
      resolve(null);
    }, WS_CONNECT_TIMEOUT_MS + 2_000);

    const cleanup = () => {
      clearTimeout(timer);
      ws.off('open', onOpen);
      ws.off('error', onError);
      ws.off('close', onClose);
    };

    ws.once('open', onOpen);
    ws.once('error', onError);
    ws.once('close', onClose);
  });
}

export async function fetchNextCommandViaWs(
  ctx: WsTransportContext,
): Promise<QueuedCommand | null> {
  const ws = await ensureWsClient(ctx);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return null;
  }

  return await new Promise<QueuedCommand | null>((resolve) => {
    const requestId = randomUUID();
    const timeout = setTimeout(() => {
      cleanup();
      resolve(null);
    }, NEXT_COMMAND_TIMEOUT_MS + 15_000);

    const onMessage = (raw: WebSocket.RawData) => {
      const msg = String(raw || '').trim();
      if (!msg) return;

      const rawParsed = tryParseWsJson(msg);
      if (!rawParsed) return;
      const parsed = agentWsEventSchema.safeParse(rawParsed);
      if (!parsed.success) {
        ctx.logger.warn('Ignoring invalid WS event payload', {
          event_name: 'agent.transport.ws.invalid_event',
          transport: 'ws',
        });
        return;
      }
      if (parsed.data.type !== 'agent.command.assigned') return;

      const command = parsed.data.command ?? null;
      if (command === null) {
        cleanup();
        resolve(null);
        return;
      }

      const validated = queuedCommandSchema.safeParse(command);
      if (!validated.success) {
        ctx.logger.warn('Skipping invalid queued command payload (ws)', {
          event_name: 'agent.command.invalid_payload',
          transport: 'ws',
        });
        cleanup();
        resolve(null);
        return;
      }

      cleanup();
      resolve(validated.data);
    };

    const onClose = () => {
      cleanup();
      onWsDisconnect(ctx);
      resolve(null);
    };
    const onError = () => {
      cleanup();
      onWsDisconnect(ctx);
      resolve(null);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      ws.off('message', onMessage);
      ws.off('close', onClose);
      ws.off('error', onError);
    };

    ws.on('message', onMessage);
    ws.once('close', onClose);
    ws.once('error', onError);
    ws.send(
      JSON.stringify({
        type: 'next_command',
        request_id: requestId,
        agent_id: ctx.config.agentId,
        timeout_ms: NEXT_COMMAND_TIMEOUT_MS,
      }),
    );
  });
}

export async function reportWsEvent(
  ctx: WsTransportContext,
  payload: Record<string, unknown>,
  expectedType: string,
): Promise<boolean> {
  const ws = await ensureWsClient(ctx);
  if (!ws || ws.readyState !== WebSocket.OPEN) {
    return false;
  }

  return await new Promise<boolean>((resolve) => {
    const outbound = agentWsInboundMessageSchema.safeParse(payload);
    if (!outbound.success) {
      ctx.logger.warn('Skipping invalid outbound WS payload', {
        event_name: 'agent.transport.ws.invalid_outbound_payload',
        transport: 'ws',
        expected_type: expectedType,
      });
      resolve(false);
      return;
    }

    const timeout = setTimeout(() => {
      cleanup();
      resolve(false);
    }, WS_EVENT_TIMEOUT_MS);

    const onMessage = (raw: WebSocket.RawData) => {
      const msg = String(raw || '').trim();
      if (!msg) return;

      const rawParsed = tryParseWsJson(msg);
      if (!rawParsed) return;
      const parsed = agentWsEventSchema.safeParse(rawParsed);
      if (!parsed.success) {
        return;
      }
      if (parsed.data.type !== expectedType) return;

      cleanup();
      resolve(true);
    };

    const onClose = () => {
      cleanup();
      onWsDisconnect(ctx);
      resolve(false);
    };
    const onError = () => {
      cleanup();
      onWsDisconnect(ctx);
      resolve(false);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      ws.off('message', onMessage);
      ws.off('close', onClose);
      ws.off('error', onError);
    };

    ws.on('message', onMessage);
    ws.once('close', onClose);
    ws.once('error', onError);
    ws.send(JSON.stringify(outbound.data));
  });
}

function toWsUrl(baseUrl: string): string {
  const normalized = String(baseUrl || '')
    .trim()
    .replace(/\/+$/, '');
  if (normalized.startsWith('https://')) {
    return normalized.replace(/^https:\/\//, 'wss://');
  }
  if (normalized.startsWith('http://')) {
    return normalized.replace(/^http:\/\//, 'ws://');
  }
  return normalized;
}

function onWsDisconnect(ctx: WsTransportContext): void {
  ctx.state.client = null;
  scheduleWsReconnectBackoff(ctx.state);
}

function onWsFailure(ctx: WsTransportContext): void {
  ctx.state.connectFailureCount += 1;
  ctx.state.lastFailureAt = new Date().toISOString();
  scheduleWsReconnectBackoff(ctx.state);
}

function scheduleWsReconnectBackoff(state: WsTransportState): void {
  const parsedBase = Number.parseInt(
    String(process.env.BOTMOX_AGENT_WS_RECONNECT_BASE_MS || ''),
    10,
  );
  const parsedMax = Number.parseInt(String(process.env.BOTMOX_AGENT_WS_RECONNECT_MAX_MS || ''), 10);
  const parsedJitter = Number.parseFloat(
    String(process.env.BOTMOX_AGENT_WS_RECONNECT_JITTER || ''),
  );

  state.reconnectAttempt += 1;
  const delayMs = computeReconnectDelayMs({
    attempt: state.reconnectAttempt,
    baseMs: Number.isFinite(parsedBase) ? parsedBase : WS_RECONNECT_BASE_MS,
    maxMs: Number.isFinite(parsedMax) ? parsedMax : WS_RECONNECT_MAX_MS,
    jitterRatio: Number.isFinite(parsedJitter) ? parsedJitter : WS_RECONNECT_JITTER_RATIO,
  });
  state.nextReconnectAt = Date.now() + delayMs;
}

function tryParseWsJson(rawMessage: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(rawMessage) as Record<string, unknown>;
    if (!parsed || typeof parsed !== 'object') {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}
