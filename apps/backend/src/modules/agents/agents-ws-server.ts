import { randomUUID } from 'node:crypto';
import type { Server as HttpServer, IncomingMessage } from 'node:http';
import { URL } from 'node:url';
import { agentWsEventSchema, agentWsInboundMessageSchema } from '@botmox/api-contract';
import { type WebSocket, WebSocketServer } from 'ws';
import type { AuthService } from '../auth/auth.service';
import type { VmOpsService } from '../vm-ops/vm-ops.service';
import type { AgentsService } from './agents.service';

interface AttachAgentsWsServerInput {
  server: HttpServer;
  authService: AuthService;
  vmOpsService: VmOpsService;
  agentsService: AgentsService;
}

interface SocketSession {
  tenantId: string;
  agentId: string;
  requestId: string;
}

type SocketWithSession = WebSocket & {
  __session?: SocketSession;
};

function tryParseJson(raw: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    return null;
  }
}

function sendJson(ws: WebSocket, payload: Record<string, unknown>): void {
  if (ws.readyState !== ws.OPEN) return;
  const parsed = agentWsEventSchema.safeParse(payload);
  if (!parsed.success) {
    ws.send(
      JSON.stringify({
        type: 'error',
        code: 'WS_EVENT_SCHEMA_VIOLATION',
        message: 'Internal websocket event schema violation',
        ts: new Date().toISOString(),
      }),
    );
    return;
  }
  ws.send(JSON.stringify(payload));
}

function resolveTimeoutMs(msg: { timeout_ms?: unknown; timeoutMs?: unknown }): number {
  const parsed = Number(msg.timeout_ms ?? msg.timeoutMs ?? 25_000);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 25_000;
  }
  return Math.min(120_000, Math.max(1_000, Math.trunc(parsed)));
}

function resolveBearerToken(req: IncomingMessage): string {
  const headerAuth = String(req.headers.authorization || '').trim();
  if (headerAuth) return headerAuth;

  const url = new URL(req.url || '/', 'http://localhost');
  const queryToken = String(url.searchParams.get('token') || '').trim();
  return queryToken ? `Bearer ${queryToken}` : '';
}

export function attachAgentsWsServer(input: AttachAgentsWsServerInput): void {
  const wsServer = new WebSocketServer({
    noServer: true,
  });

  input.server.on('upgrade', async (req, socket, head) => {
    const url = new URL(req.url || '/', 'http://localhost');
    if (!url.pathname.startsWith('/api/v1/agents/ws')) {
      return;
    }

    const authHeader = resolveBearerToken(req);
    const identity = await input.authService.verifyBearerToken(authHeader);
    if (!identity) {
      socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
      socket.destroy();
      return;
    }

    wsServer.handleUpgrade(req, socket, head, (client) => {
      const ws = client as SocketWithSession;
      ws.__session = {
        tenantId: identity.tenantId,
        agentId: String(url.searchParams.get('agent_id') || '').trim(),
        requestId: String(url.searchParams.get('request_id') || '').trim() || randomUUID(),
      };
      wsServer.emit('connection', ws, req);
    });
  });

  wsServer.on('connection', (client) => {
    const ws = client as SocketWithSession;
    sendJson(ws, {
      type: 'connected',
      ts: new Date().toISOString(),
      transport: 'ws',
    });

    ws.on('message', async (raw) => {
      const rawMessage = tryParseJson(String(raw || ''));
      if (!rawMessage) {
        sendJson(ws, {
          type: 'error',
          code: 'INVALID_JSON',
          message: 'Message must be valid JSON object',
        });
        return;
      }

      const parsed = agentWsInboundMessageSchema.safeParse(rawMessage);
      if (!parsed.success) {
        sendJson(ws, {
          type: 'error',
          code: 'INVALID_MESSAGE',
          message: 'Unsupported message payload',
          ts: new Date().toISOString(),
        });
        return;
      }
      const message = parsed.data;

      if (message.type === 'heartbeat') {
        const session = ws.__session;
        if (!session) {
          sendJson(ws, {
            type: 'error',
            code: 'NO_SESSION',
            message: 'Missing authenticated session',
          });
          return;
        }
        const agentId = String(message.agent_id || '').trim() || session.agentId;
        if (!agentId) {
          sendJson(ws, {
            type: 'error',
            code: 'MISSING_AGENT_ID',
            message: 'agent_id is required',
          });
          return;
        }

        const normalizedMetadata =
          message.metadata &&
          typeof message.metadata === 'object' &&
          !Array.isArray(message.metadata)
            ? message.metadata
            : {};

        await input.agentsService.heartbeat({
          tenantId: session.tenantId,
          agentId,
          status: message.status || 'active',
          metadata: normalizedMetadata,
        });

        sendJson(ws, {
          type: 'agent.heartbeat',
          ts: new Date().toISOString(),
          request_id: message.request_id || null,
          agent_id: agentId,
          status: message.status || 'active',
          ...(message.metadata !== undefined ? { metadata: normalizedMetadata } : {}),
        });
        return;
      }

      if (message.type === 'next_command') {
        const session = ws.__session;
        if (!session) {
          sendJson(ws, {
            type: 'error',
            code: 'NO_SESSION',
            message: 'Missing authenticated session',
          });
          return;
        }

        const agentId = String(message.agent_id || '').trim() || session.agentId;
        if (!agentId) {
          sendJson(ws, {
            type: 'error',
            code: 'MISSING_AGENT_ID',
            message: 'agent_id is required',
          });
          return;
        }

        const command = await input.vmOpsService.waitForNextAgentCommand({
          tenantId: session.tenantId,
          agentId,
          timeoutMs: resolveTimeoutMs(message),
        });

        sendJson(ws, {
          type: 'agent.command.assigned',
          ts: new Date().toISOString(),
          command: command || null,
        });
        return;
      }

      if (message.type === 'agent.command.ack') {
        const session = ws.__session;
        if (!session) {
          sendJson(ws, {
            type: 'error',
            code: 'NO_SESSION',
            message: 'Missing authenticated session',
          });
          return;
        }

        const updated = await input.vmOpsService.updateCommandStatus({
          id: message.command_id,
          status: 'running',
          tenantId: session.tenantId,
        });

        if (!updated) {
          sendJson(ws, {
            type: 'error',
            code: 'COMMAND_NOT_FOUND',
            message: `Command not found: ${message.command_id}`,
            request_id: message.request_id || null,
          });
          return;
        }

        sendJson(ws, {
          type: 'agent.command.ack',
          ts: new Date().toISOString(),
          request_id: message.request_id || null,
          command_id: message.command_id,
          agent_id: message.agent_id,
        });
        return;
      }

      if (message.type === 'agent.command.progress') {
        const session = ws.__session;
        if (!session) {
          sendJson(ws, {
            type: 'error',
            code: 'NO_SESSION',
            message: 'Missing authenticated session',
          });
          return;
        }

        const updated = await input.vmOpsService.updateCommandStatus({
          id: message.command_id,
          status: 'running',
          tenantId: session.tenantId,
        });

        if (!updated) {
          sendJson(ws, {
            type: 'error',
            code: 'COMMAND_NOT_FOUND',
            message: `Command not found: ${message.command_id}`,
            request_id: message.request_id || null,
          });
          return;
        }

        sendJson(ws, {
          type: 'agent.command.progress',
          ts: new Date().toISOString(),
          request_id: message.request_id || null,
          command_id: message.command_id,
          agent_id: message.agent_id,
          ...(message.progress !== undefined ? { progress: message.progress } : {}),
          ...(message.message ? { message: message.message } : {}),
        });
        return;
      }

      if (message.type === 'agent.command.result') {
        const session = ws.__session;
        if (!session) {
          sendJson(ws, {
            type: 'error',
            code: 'NO_SESSION',
            message: 'Missing authenticated session',
          });
          return;
        }

        const updated = await input.vmOpsService.updateCommandStatus({
          id: message.command_id,
          status: message.status,
          tenantId: session.tenantId,
          ...(Object.hasOwn(message, 'result') ? { result: message.result } : {}),
          ...(message.error_message ? { errorMessage: message.error_message } : {}),
        });

        if (!updated) {
          sendJson(ws, {
            type: 'error',
            code: 'COMMAND_NOT_FOUND',
            message: `Command not found: ${message.command_id}`,
            request_id: message.request_id || null,
          });
          return;
        }

        sendJson(ws, {
          type: 'agent.command.result',
          ts: new Date().toISOString(),
          request_id: message.request_id || null,
          command_id: message.command_id,
          agent_id: message.agent_id,
          status: message.status,
        });
        return;
      }

      sendJson(ws, {
        type: 'error',
        code: 'UNKNOWN_MESSAGE_TYPE',
        message: 'Unsupported message type',
      });
    });
  });
}
