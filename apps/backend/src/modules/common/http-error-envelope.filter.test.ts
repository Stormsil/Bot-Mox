// @ts-nocheck
export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, NotFoundException } = require('@nestjs/common');
const { HttpErrorEnvelopeFilter } = require('./http-error-envelope.filter.ts');

function createMockResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function createHost(response, request = { method: 'POST', url: '/api/v1/test' }) {
  return {
    switchToHttp() {
      return {
        getResponse() {
          return response;
        },
        getRequest() {
          return request;
        },
      };
    },
  };
}

test('HttpErrorEnvelopeFilter maps validation array into unified error envelope', () => {
  const filter = new HttpErrorEnvelopeFilter();
  const response = createMockResponse();
  const host = createHost(response);

  filter.catch(
    new BadRequestException({
      message: ['field_a is required', 'field_b must be uuid'],
      error: 'Bad Request',
    }),
    host,
  );

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: 'BAD_REQUEST',
      message: 'field_a is required; field_b must be uuid',
      details: {
        validation: ['field_a is required', 'field_b must be uuid'],
      },
    },
  });
});

test('HttpErrorEnvelopeFilter maps unknown errors to INTERNAL_ERROR', () => {
  const filter = new HttpErrorEnvelopeFilter();
  const response = createMockResponse();
  const host = createHost(response);

  filter.catch(new Error('boom'), host);

  assert.equal(response.statusCode, 500);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Internal server error',
    },
  });
});

test('HttpErrorEnvelopeFilter preserves explicit domain code from HttpException payload', () => {
  const filter = new HttpErrorEnvelopeFilter();
  const response = createMockResponse();
  const host = createHost(response);

  filter.catch(
    new NotFoundException({
      code: 'LEASE_NOT_FOUND',
      message: 'Execution lease not found',
    }),
    host,
  );

  assert.equal(response.statusCode, 404);
  assert.deepEqual(response.body, {
    success: false,
    error: {
      code: 'LEASE_NOT_FOUND',
      message: 'Execution lease not found',
    },
  });
});
