// @ts-nocheck
import assert from 'node:assert/strict';
import { createServer, type Server as HttpServer } from 'node:http';
import test from 'node:test';
import WebSocket from 'ws';
import { attachAgentsWsServer } from '../agents/agents-ws-server';
import { VmOpsService } from './vm-ops.service';

interface TestContext {
  server: HttpServer;
  baseUrl: string;
}

type RepoCommand = {
  id: string;
  tenantId: string;
  agentId: string;
  commandType: string;
  payload: Record<string, unknown>;
  status: string;
  queuedAt: Date;
  expiresAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  result: unknown;
  errorMessage: string | null;
  createdBy: string | null;
};

type ScopeFilters = {
  tenantId?: string;
  agentId?: string;
  status?: string;
};

type ClaimInput = {
  tenantId: string;
  agentId: string;
};

type UpdateStatusInput = {
  id: string;
  status: string;
  result?: unknown;
  errorMessage?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
};

type CreateInput = {
  id: string;
  tenantId: string;
  agentId: string;
  commandType: string;
  payload: Record<string, unknown>;
  status: string;
  expiresAt?: Date | null;
  createdBy?: string | null;
};

function createRepositoryStub() {
  const store = new Map<string, RepoCommand>();
  return {
    async create(input: CreateInput) {
      const row: RepoCommand = {
        id: input.id,
        tenantId: input.tenantId,
        agentId: input.agentId,
        commandType: input.commandType,
        payload: input.payload,
        status: input.status,
        queuedAt: new Date(),
        expiresAt: input.expiresAt ?? null,
        startedAt: null,
        completedAt: null,
        result: null,
        errorMessage: null,
        createdBy: input.createdBy ?? null,
      };
      store.set(row.id, row);
      return { ...row };
    },
    async findById(id: string) {
      const row = store.get(id);
      return row ? { ...row } : null;
    },
    async list(input: ScopeFilters) {
      return Array.from(store.values())
        .filter((row) => !input.tenantId || row.tenantId === input.tenantId)
        .filter((row) => !input.agentId || row.agentId === input.agentId)
        .filter((row) => !input.status || row.status === input.status)
        .map((row) => ({ ...row }));
    },
    async claimNextQueued(input: ClaimInput) {
      const row = Array.from(store.values()).find(
        (item) =>
          item.tenantId === input.tenantId &&
          item.agentId === input.agentId &&
          item.status === 'queued',
      );
      if (!row) {
        return null;
      }
      row.status = 'dispatched';
      return { ...row };
    },
    async updateStatus(input: UpdateStatusInput) {
      const row = store.get(input.id);
      if (!row) {
        return null;
      }
      row.status = input.status;
      if (Object.hasOwn(input, 'result')) {
        row.result = input.result ?? null;
      }
      if (Object.hasOwn(input, 'errorMessage')) {
        row.errorMessage = input.errorMessage ?? null;
      }
      if (Object.hasOwn(input, 'startedAt')) {
        row.startedAt = input.startedAt ?? null;
      }
      if (Object.hasOwn(input, 'completedAt')) {
        row.completedAt = input.completedAt ?? null;
      }
      return { ...row };
    },
    async expireStaleRunning() {
      return 0;
    },
    async listStaleDispatched() {
      return [];
    },
    async requeueDispatched() {
      return null;
    },
    async deadLetterDispatched() {
      return null;
    },
  };
}

async function startServer(
  authService: { verifyBearerToken: (token: string) => Promise<unknown> },
  vmOpsService: VmOpsService,
  agentsService: { heartbeat: (input: unknown) => Promise<unknown> },
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

test('vm-ops ws lifecycle dispatches, acknowledges, and completes command', async () => {
  const vmOpsService = new VmOpsService(createRepositoryStub() as never);
  const authService = {
    async verifyBearerToken(): Promise<{ tenantId: string }> {
      return { tenantId: 'tenant-int' };
    },
  };
  const agentsService = {
    async heartbeat(): Promise<null> {
      return null;
    },
  };

  const dispatched = await vmOpsService.dispatch({
    tenantId: 'tenant-int',
    agentId: 'agent-int',
    commandType: 'proxmox.start',
    payload: { vm_uuid: 'vm-1' },
    createdBy: 'integration-test',
  });

  const ctx = await startServer(authService, vmOpsService, agentsService);
  let ws: WebSocket | null = null;
  try {
    ws = await openSocket(`${ctx.baseUrl}/api/v1/agents/ws?agent_id=agent-int&token=test-token`);

    ws.send(
      JSON.stringify({
        type: 'next_command',
        request_id: 'next-integration-1',
        agent_id: 'agent-int',
        timeout_ms: 3000,
      }),
    );
    const assigned = await waitMessageType(ws, 'agent.command.assigned');
    const assignedCommand = assigned.command as Record<string, unknown>;
    assert.equal(assignedCommand.id, dispatched.id);
    assert.equal(assignedCommand.status, 'dispatched');

    ws.send(
      JSON.stringify({
        type: 'agent.command.ack',
        request_id: 'ack-integration-1',
        command_id: dispatched.id,
        agent_id: 'agent-int',
      }),
    );
    await waitMessageType(ws, 'agent.command.ack');

    const afterAck = await vmOpsService.getById(dispatched.id, 'tenant-int');
    assert.equal(afterAck?.status, 'running');

    ws.send(
      JSON.stringify({
        type: 'agent.command.result',
        request_id: 'result-integration-1',
        command_id: dispatched.id,
        agent_id: 'agent-int',
        status: 'succeeded',
        result: { ok: true },
      }),
    );
    await waitMessageType(ws, 'agent.command.result');

    const afterResult = await vmOpsService.getById(dispatched.id, 'tenant-int');
    assert.equal(afterResult?.status, 'succeeded');
    assert.deepEqual(afterResult?.result, { ok: true });
  } finally {
    if (ws) {
      ws.close();
    }
    await stopServer(ctx.server);
  }
});

test('vm-ops ws enforces tenant isolation for assigned and ack flows', async () => {
  const vmOpsService = new VmOpsService(createRepositoryStub() as never);
  const authService = {
    async verifyBearerToken(): Promise<{ tenantId: string }> {
      return { tenantId: 'tenant-other' };
    },
  };
  const agentsService = {
    async heartbeat(): Promise<null> {
      return null;
    },
  };

  const dispatched = await vmOpsService.dispatch({
    tenantId: 'tenant-int',
    agentId: 'agent-int',
    commandType: 'proxmox.start',
    payload: { vm_uuid: 'vm-iso-1' },
    createdBy: 'integration-test-tenant',
  });

  const ctx = await startServer(authService, vmOpsService, agentsService);
  let ws: WebSocket | null = null;
  try {
    ws = await openSocket(`${ctx.baseUrl}/api/v1/agents/ws?agent_id=agent-int&token=test-token`);

    ws.send(
      JSON.stringify({
        type: 'next_command',
        request_id: 'next-tenant-iso-1',
        agent_id: 'agent-int',
        timeout_ms: 1200,
      }),
    );
    const assigned = await waitMessageType(ws, 'agent.command.assigned');
    assert.equal(assigned.command, null);

    ws.send(
      JSON.stringify({
        type: 'agent.command.ack',
        request_id: 'ack-tenant-iso-1',
        command_id: dispatched.id,
        agent_id: 'agent-int',
      }),
    );

    const errorMessage = await waitMessageType(ws, 'error');
    assert.equal(errorMessage.code, 'COMMAND_NOT_FOUND');

    const command = await vmOpsService.getById(dispatched.id, 'tenant-int');
    assert.equal(command?.status, 'queued');
  } finally {
    if (ws) {
      ws.close();
    }
    await stopServer(ctx.server);
  }
});
