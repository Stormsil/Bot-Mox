import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'node:http';
import test from 'node:test';
import WebSocket from 'ws';
import { attachAgentsWsServer } from './agents-ws-server';

interface TestContext {
  server: HttpServer;
  baseUrl: string;
}

async function startServer(
  authService: { verifyBearerToken: (token: string) => Promise<unknown> },
  vmOpsService: {
    waitForNextAgentCommand: (input: unknown) => Promise<unknown>;
    updateCommandStatus: (input: unknown) => Promise<unknown>;
  },
  agentsService: {
    heartbeat: (input: unknown) => Promise<unknown>;
  },
): Promise<TestContext> {
  const server = createServer((_req, res) => {
    res.statusCode = 404;
    res.end();
  });

  attachAgentsWsServer({
    server,
    authService: authService as never,
    vmOpsService: vmOpsService as never,
    agentsService: agentsService as never,
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to resolve test server address');
  }

  return {
    server,
    baseUrl: `ws://127.0.0.1:${address.port}`,
  };
}

async function stopServer(server: HttpServer): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => {
      if (error) reject(error);
      else resolve();
    });
  });
}

async function openSocket(url: string): Promise<WebSocket> {
  return await new Promise<WebSocket>((resolve, reject) => {
    const ws = new WebSocket(url);
    ws.once('open', () => resolve(ws));
    ws.once('unexpected-response', (_request, response) => {
      reject(new Error(`Unexpected response: ${response.statusCode}`));
    });
    ws.once('error', reject);
  });
}

async function waitMessageType(
  ws: WebSocket,
  expectedType: string,
): Promise<Record<string, unknown>> {
  return await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error(`Timed out waiting for WS message type "${expectedType}"`));
    }, 5_000);

    const onMessage = (raw: WebSocket.RawData) => {
      try {
        const parsed = JSON.parse(String(raw || '')) as Record<string, unknown>;
        if (String(parsed.type || '').trim() !== expectedType) {
          return;
        }
        cleanup();
        resolve(parsed);
      } catch (error) {
        cleanup();
        reject(error);
      }
    };

    const onError = (error: Error) => {
      cleanup();
      reject(error);
    };

    const cleanup = () => {
      clearTimeout(timeout);
      ws.off('message', onMessage);
      ws.off('error', onError);
    };

    ws.on('message', onMessage);
    ws.on('error', onError);
  });
}

test('agents ws server rejects unauthorized handshake', async () => {
  const authService = {
    async verifyBearerToken(): Promise<null> {
      return null;
    },
  };
  const vmOpsService = {
    async waitForNextAgentCommand(): Promise<null> {
      return null;
    },
    async updateCommandStatus(): Promise<null> {
      return null;
    },
  };
  const agentsService = {
    async heartbeat(): Promise<null> {
      return null;
    },
  };

  const ctx = await startServer(authService, vmOpsService, agentsService);
  try {
    await assert.rejects(
      openSocket(`${ctx.baseUrl}/api/v1/agents/ws?agent_id=agent-1`),
      /Unexpected response: 401/,
    );
  } finally {
    await stopServer(ctx.server);
  }
});

test('agents ws server accepts ack and returns agent.command.ack', async () => {
  const authService = {
    async verifyBearerToken(): Promise<{ tenantId: string }> {
      return { tenantId: 'tenant-alpha' };
    },
  };

  const statusUpdates: Array<Record<string, unknown>> = [];
  const vmOpsService = {
    async waitForNextAgentCommand(): Promise<null> {
      return null;
    },
    async updateCommandStatus(input: unknown): Promise<{ id: string; status: string }> {
      statusUpdates.push(input as Record<string, unknown>);
      return { id: 'cmd-1', status: 'running' };
    },
  };
  const agentsService = {
    async heartbeat(): Promise<null> {
      return null;
    },
  };

  const ctx = await startServer(authService, vmOpsService, agentsService);
  let ws: WebSocket | null = null;
  try {
    ws = await openSocket(
      `${ctx.baseUrl}/api/v1/agents/ws?agent_id=agent-007&token=test-token&request_id=req-1`,
    );

    ws.send(
      JSON.stringify({
        type: 'agent.command.ack',
        request_id: 'ack-1',
        command_id: 'cmd-1',
        agent_id: 'agent-007',
      }),
    );

    const ack = await waitMessageType(ws, 'agent.command.ack');
    assert.equal(ack.type, 'agent.command.ack');
    assert.equal(ack.command_id, 'cmd-1');
    assert.equal(ack.request_id, 'ack-1');

    assert.equal(statusUpdates.length, 1);
    assert.deepEqual(statusUpdates[0], {
      id: 'cmd-1',
      status: 'running',
      tenantId: 'tenant-alpha',
    });
  } finally {
    if (ws) {
      ws.close();
    }
    await stopServer(ctx.server);
  }
});

test('agents ws server returns assigned command for next_command', async () => {
  const authService = {
    async verifyBearerToken(): Promise<{ tenantId: string }> {
      return { tenantId: 'tenant-beta' };
    },
  };

  const nextCalls: Array<Record<string, unknown>> = [];
  const vmOpsService = {
    async waitForNextAgentCommand(input: unknown): Promise<Record<string, unknown>> {
      nextCalls.push(input as Record<string, unknown>);
      return {
        id: 'cmd-next-1',
        tenant_id: 'tenant-beta',
        agent_id: 'agent-55',
        command_type: 'proxmox.start',
        payload: {},
        status: 'dispatched',
        queued_at: new Date().toISOString(),
        expires_at: null,
        started_at: null,
        completed_at: null,
      };
    },
    async updateCommandStatus(): Promise<null> {
      return null;
    },
  };
  const agentsService = {
    async heartbeat(): Promise<null> {
      return null;
    },
  };

  const ctx = await startServer(authService, vmOpsService, agentsService);
  let ws: WebSocket | null = null;
  try {
    ws = await openSocket(`${ctx.baseUrl}/api/v1/agents/ws?agent_id=agent-55&token=test-token`);

    ws.send(
      JSON.stringify({
        type: 'next_command',
        request_id: 'next-1',
        agent_id: 'agent-55',
        timeout_ms: 2000,
      }),
    );

    const assigned = await waitMessageType(ws, 'agent.command.assigned');
    assert.equal(assigned.type, 'agent.command.assigned');
    const command = assigned.command as Record<string, unknown>;
    assert.equal(command.id, 'cmd-next-1');
    assert.equal(command.agent_id, 'agent-55');

    assert.equal(nextCalls.length, 1);
    assert.deepEqual(nextCalls[0], {
      tenantId: 'tenant-beta',
      agentId: 'agent-55',
      timeoutMs: 2000,
    });
  } finally {
    if (ws) {
      ws.close();
    }
    await stopServer(ctx.server);
  }
});

test('agents ws server accepts command result and returns agent.command.result', async () => {
  const authService = {
    async verifyBearerToken(): Promise<{ tenantId: string }> {
      return { tenantId: 'tenant-gamma' };
    },
  };

  const statusUpdates: Array<Record<string, unknown>> = [];
  const vmOpsService = {
    async waitForNextAgentCommand(): Promise<null> {
      return null;
    },
    async updateCommandStatus(input: unknown): Promise<{ id: string; status: string }> {
      statusUpdates.push(input as Record<string, unknown>);
      return { id: 'cmd-result-1', status: 'succeeded' };
    },
  };
  const agentsService = {
    async heartbeat(): Promise<null> {
      return null;
    },
  };

  const ctx = await startServer(authService, vmOpsService, agentsService);
  let ws: WebSocket | null = null;
  try {
    ws = await openSocket(`${ctx.baseUrl}/api/v1/agents/ws?agent_id=agent-88&token=test-token`);

    ws.send(
      JSON.stringify({
        type: 'agent.command.result',
        request_id: 'result-1',
        command_id: 'cmd-result-1',
        agent_id: 'agent-88',
        status: 'succeeded',
        result: { ok: true },
      }),
    );

    const result = await waitMessageType(ws, 'agent.command.result');
    assert.equal(result.type, 'agent.command.result');
    assert.equal(result.command_id, 'cmd-result-1');
    assert.equal(result.status, 'succeeded');

    assert.equal(statusUpdates.length, 1);
    assert.deepEqual(statusUpdates[0], {
      id: 'cmd-result-1',
      status: 'succeeded',
      tenantId: 'tenant-gamma',
      result: { ok: true },
    });
  } finally {
    if (ws) {
      ws.close();
    }
    await stopServer(ctx.server);
  }
});

test('agents ws server heartbeat updates agents service and echoes metadata', async () => {
  const authService = {
    async verifyBearerToken(): Promise<{ tenantId: string }> {
      return { tenantId: 'tenant-heartbeat' };
    },
  };
  const vmOpsService = {
    async waitForNextAgentCommand(): Promise<null> {
      return null;
    },
    async updateCommandStatus(): Promise<null> {
      return null;
    },
  };
  const heartbeatCalls: Array<Record<string, unknown>> = [];
  const agentsService = {
    async heartbeat(input: unknown): Promise<{ id: string }> {
      heartbeatCalls.push(input as Record<string, unknown>);
      return { id: 'agent-heartbeat-1' };
    },
  };

  const ctx = await startServer(authService, vmOpsService, agentsService);
  let ws: WebSocket | null = null;
  try {
    ws = await openSocket(
      `${ctx.baseUrl}/api/v1/agents/ws?agent_id=agent-heartbeat-1&token=test-token`,
    );
    ws.send(
      JSON.stringify({
        type: 'heartbeat',
        request_id: 'hb-1',
        status: 'active',
        metadata: {
          transport_mode: 'ws',
          ws_reconnect_attempt: 2,
        },
      }),
    );

    const heartbeatAck = await waitMessageType(ws, 'agent.heartbeat');
    assert.equal(heartbeatAck.type, 'agent.heartbeat');
    assert.equal(heartbeatAck.agent_id, 'agent-heartbeat-1');
    assert.equal(heartbeatAck.request_id, 'hb-1');
    assert.deepEqual(heartbeatAck.metadata, {
      transport_mode: 'ws',
      ws_reconnect_attempt: 2,
    });

    assert.equal(heartbeatCalls.length, 1);
    assert.deepEqual(heartbeatCalls[0], {
      tenantId: 'tenant-heartbeat',
      agentId: 'agent-heartbeat-1',
      status: 'active',
      metadata: {
        transport_mode: 'ws',
        ws_reconnect_attempt: 2,
      },
    });
  } finally {
    if (ws) {
      ws.close();
    }
    await stopServer(ctx.server);
  }
});

test('agents ws server rejects heartbeat with invalid metadata payload', async () => {
  const authService = {
    async verifyBearerToken(): Promise<{ tenantId: string }> {
      return { tenantId: 'tenant-heartbeat' };
    },
  };
  const vmOpsService = {
    async waitForNextAgentCommand(): Promise<null> {
      return null;
    },
    async updateCommandStatus(): Promise<null> {
      return null;
    },
  };
  const heartbeatCalls: Array<Record<string, unknown>> = [];
  const agentsService = {
    async heartbeat(input: unknown): Promise<{ id: string }> {
      heartbeatCalls.push(input as Record<string, unknown>);
      return { id: 'agent-heartbeat-2' };
    },
  };

  const ctx = await startServer(authService, vmOpsService, agentsService);
  let ws: WebSocket | null = null;
  try {
    ws = await openSocket(
      `${ctx.baseUrl}/api/v1/agents/ws?agent_id=agent-heartbeat-2&token=test-token`,
    );
    ws.send(
      JSON.stringify({
        type: 'heartbeat',
        request_id: 'hb-2',
        status: 'active',
        metadata: ['invalid', 'metadata'],
      }),
    );

    const error = await waitMessageType(ws, 'error');
    assert.equal(error.type, 'error');
    assert.equal(error.code, 'INVALID_MESSAGE');
    assert.equal(heartbeatCalls.length, 0);
  } finally {
    if (ws) {
      ws.close();
    }
    await stopServer(ctx.server);
  }
});
