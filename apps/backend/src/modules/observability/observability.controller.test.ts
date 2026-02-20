export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException } = require('@nestjs/common');
const { ObservabilityController } = require('./observability.controller.ts');

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
  const controller = new ObservabilityController(createServiceStub());

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
