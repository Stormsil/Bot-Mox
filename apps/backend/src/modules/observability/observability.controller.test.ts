// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { ObservabilityController } = require('./observability.controller.ts');
const { REQUEST_IDENTITY_KEY } = require('../auth/request-identity.ts');

function createServiceStub(overrides = {}) {
  return {
    getTraceSnapshot: () => ({
      timestamp: new Date().toISOString(),
      node_env: 'test',
      received: {},
      active: { trace_id: null, span_id: null },
      response_headers: {},
    }),
    ingestClientLogs: () => ({ accepted: 1, dropped: 0 }),
    isOtelProxyEnabled: () => false,
    proxyOtelTraces: async () => ({
      status: 200,
      contentType: 'application/x-protobuf',
      body: Buffer.from('ok'),
    }),
    ...overrides,
  };
}

function createRuntimeMetricsStub(overrides = {}) {
  return {
    snapshot: () => ({
      ts: new Date().toISOString(),
      uptime_ms: 100,
      active: { sse: 0, ws: 0 },
      counters: {},
    }),
    ...overrides,
  };
}

function createAuthStub(overrides = {}) {
  return {
    isAdmin: () => true,
    ...overrides,
  };
}

function createRequest(identity = {}) {
  const req = {};
  req[REQUEST_IDENTITY_KEY] = {
    userId: identity.userId || 'admin-user',
    email: identity.email || 'admin@localhost',
    roles: identity.roles || ['admin'],
    tenantId: identity.tenantId || 'tenant-admin',
    raw: identity.raw || {},
  };
  return req;
}

function createResponseMock() {
  const state = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
  };
  return {
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    setHeader(name: string, value: string) {
      state.headers[name] = value;
    },
    json(payload: unknown) {
      state.body = payload;
      return this;
    },
    send(payload: unknown) {
      state.body = payload;
      return this;
    },
    state,
  };
}

test('ObservabilityController returns deterministic code for invalid client logs payload', async () => {
  const controller = new ObservabilityController(
    createServiceStub(),
    createRuntimeMetricsStub(),
    createAuthStub(),
  );

  await assert.rejects(
    async () => controller.ingestClientLogs({}),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse: () => unknown }).getResponse() as {
        code?: string;
      };
      assert.equal(response.code, 'OBSERVABILITY_INVALID_CLIENT_LOGS_BODY');
      return true;
    },
  );
});

test('ObservabilityController returns deterministic not-found envelope when OTLP proxy disabled', async () => {
  const controller = new ObservabilityController(
    createServiceStub({ isOtelProxyEnabled: () => false }),
    createRuntimeMetricsStub(),
    createAuthStub(),
  );
  const res = createResponseMock();
  const req = { headers: {}, body: Buffer.alloc(0) };

  await controller.proxyOtelTraces(req, res);

  assert.equal(res.state.statusCode, 404);
  assert.deepEqual(res.state.body, {
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Not found',
    },
  });
});

test('ObservabilityController returns deterministic proxy-failed envelope when OTLP upstream fails', async () => {
  const controller = new ObservabilityController(
    createServiceStub({
      isOtelProxyEnabled: () => true,
      proxyOtelTraces: async () => {
        throw new Error('upstream down');
      },
    }),
    createRuntimeMetricsStub(),
    createAuthStub(),
  );
  const res = createResponseMock();
  const req = { headers: {}, body: Buffer.alloc(0) };

  await controller.proxyOtelTraces(req, res);

  assert.equal(res.state.statusCode, 502);
  assert.deepEqual(res.state.body, {
    success: false,
    error: {
      code: 'OTLP_PROXY_FAILED',
      message: 'Failed to proxy OTLP traces',
    },
  });
});

test('ObservabilityController returns runtime metrics snapshot', async () => {
  const controller = new ObservabilityController(
    createServiceStub(),
    createRuntimeMetricsStub({
      snapshot: () => ({
        ts: '2026-01-01T00:00:00.000Z',
        uptime_ms: 42,
        active: { sse: 2, ws: 1 },
        counters: { 'http.status.401': 5 },
      }),
    }),
    createAuthStub(),
  );

  const result = controller.getRuntimeMetrics('Bearer token', createRequest());
  assert.equal(result.success, true);
  assert.deepEqual(result.data, {
    ts: '2026-01-01T00:00:00.000Z',
    uptime_ms: 42,
    active: { sse: 2, ws: 1 },
    counters: { 'http.status.401': 5 },
  });
});

test('ObservabilityController runtime metrics requires bearer token and admin role', async () => {
  const controller = new ObservabilityController(
    createServiceStub(),
    createRuntimeMetricsStub(),
    createAuthStub({ isAdmin: () => false }),
  );

  assert.throws(
    () => controller.getRuntimeMetrics(undefined, createRequest()),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      const payload = error.getResponse();
      assert.equal(payload.code, 'MISSING_BEARER_TOKEN');
      return true;
    },
  );

  assert.throws(
    () => controller.getRuntimeMetrics('Bearer token', createRequest({ roles: ['user'] })),
    (error) => {
      assert.ok(error instanceof UnauthorizedException);
      const payload = error.getResponse();
      assert.equal(payload.code, 'AUTH_ADMIN_ROLE_REQUIRED');
      return true;
    },
  );
});
