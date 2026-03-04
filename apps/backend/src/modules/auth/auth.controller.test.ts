const test = require('node:test');
const assert = require('node:assert/strict');
const { BadRequestException, UnauthorizedException } = require('@nestjs/common');
const { AuthController } = require('./auth.controller.ts');

import type { Request, Response } from 'express';

function createMockRequest(input?: { headers?: Record<string, string>; ip?: string }): Request {
  return {
    headers: input?.headers ?? {},
    ip: input?.ip ?? '127.0.0.1',
  } as unknown as Request;
}

function createMockResponse(): {
  response: Response;
  cookieCalls: Array<{ name: string; value: string; options: Record<string, unknown> }>;
  clearCookieCalls: string[];
} {
  const cookieCalls: Array<{ name: string; value: string; options: Record<string, unknown> }> = [];
  const clearCookieCalls: string[] = [];

  return {
    response: {
      cookie: (name: string, value: string, options: Record<string, unknown>) => {
        cookieCalls.push({ name, value, options });
        return undefined as unknown as Response;
      },
      clearCookie: (name: string) => {
        clearCookieCalls.push(name);
        return undefined as unknown as Response;
      },
    } as unknown as Response,
    cookieCalls,
    clearCookieCalls,
  };
}

test('AuthController returns deterministic code for missing bearer token', async () => {
  const controller = new AuthController({
    verifyBearerToken: async () => null,
  });

  await assert.rejects(
    () => controller.verify(undefined),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'MISSING_BEARER_TOKEN',
        message: 'Missing bearer token',
      });
      return true;
    },
  );
});

test('AuthController whoami returns mapped identity', async () => {
  const controller = new AuthController({
    verifyBearerToken: async () => ({
      uid: 'user-1',
      email: 'u@example.local',
      roles: ['admin'],
      tenantId: 'tenant-a',
    }),
  });

  const response = await controller.whoami('Bearer test-token');
  assert.deepEqual(response, {
    success: true,
    data: {
      uid: 'user-1',
      email: 'u@example.local',
      roles: ['admin'],
      tenant_id: 'tenant-a',
      tenant_type: 'user',
    },
  });
});

test('AuthController signup applies public auth rate limit with client ip + email', async () => {
  const rateLimitCalls: Array<Record<string, unknown>> = [];
  const mockResponse = createMockResponse();
  const controller = new AuthController({
    verifyBearerToken: async () => null,
    enforcePublicAuthRateLimit: (input: unknown) => {
      rateLimitCalls.push(input as Record<string, unknown>);
    },
    createUserWithTenant: async () => ({
      id: 'u-1',
      email: 'new@example.local',
      tenantId: 'tenant-new',
    }),
    signInWithPassword: async () => ({
      accessToken: 'token-1',
      identity: {
        uid: 'u-1',
        email: 'new@example.local',
        tenantId: 'tenant-new',
        access: { accessTier: 'trial' },
      },
    }),
  });

  const response = await controller.signup(
    { email: 'new@example.local', password: 'StrongPass123' },
    createMockRequest({
      headers: { 'x-forwarded-for': '203.0.113.7, 10.0.0.2' },
      ip: '127.0.0.1',
    }),
    mockResponse.response,
  );

  assert.equal(response.success, true);
  assert.equal(rateLimitCalls.length, 1);
  assert.deepEqual(rateLimitCalls[0], {
    scope: 'signup',
    clientIp: '203.0.113.7',
    principal: 'new@example.local',
  });
  assert.equal(mockResponse.cookieCalls.length, 1);
  assert.equal(mockResponse.cookieCalls[0]?.name, 'botmox_token');
  assert.equal(mockResponse.cookieCalls[0]?.value, 'token-1');
  assert.equal(mockResponse.cookieCalls[0]?.options.httpOnly, true);
  assert.equal(mockResponse.cookieCalls[0]?.options.sameSite, 'lax');
  assert.equal(mockResponse.cookieCalls[0]?.options.maxAge, 86400000);
});

test('AuthController signin sets auth cookie on successful signin', async () => {
  const mockResponse = createMockResponse();
  const controller = new AuthController({
    verifyBearerToken: async () => null,
    enforcePublicAuthRateLimit: () => undefined,
    signInWithPassword: async () => ({
      accessToken: 'signin-token-1',
      identity: {
        uid: 'u-1',
        email: 'new@example.local',
        tenantId: 'tenant-new',
        access: { accessTier: 'trial' },
      },
    }),
  });

  const response = await controller.signin(
    { login: 'new@example.local', password: 'StrongPass123' },
    createMockRequest({
      headers: {},
      ip: '127.0.0.1',
    }),
    mockResponse.response,
  );

  assert.equal(response.success, true);
  assert.equal(mockResponse.cookieCalls.length, 1);
  assert.equal(mockResponse.cookieCalls[0]?.name, 'botmox_token');
  assert.equal(mockResponse.cookieCalls[0]?.value, 'signin-token-1');
});

test('AuthController signin propagates rate-limit error', async () => {
  const controller = new AuthController({
    verifyBearerToken: async () => null,
    enforcePublicAuthRateLimit: () => {
      const error = new Error('AUTH_RATE_LIMITED') as Error & { getResponse?: () => unknown };
      error.getResponse = () => ({
        code: 'AUTH_RATE_LIMITED',
        message: 'Too many authentication attempts. Please retry later.',
      });
      throw error;
    },
    signInWithPassword: async () => ({
      accessToken: 'token-1',
      identity: {
        uid: 'u-1',
        email: 'new@example.local',
        tenantId: 'tenant-new',
        access: { accessTier: 'trial' },
      },
    }),
  });

  await assert.rejects(
    () =>
      controller.signin(
        { login: 'new@example.local', password: 'StrongPass123' },
        createMockRequest({
          headers: {},
          ip: '127.0.0.1',
        }),
      ),
    (error: unknown) => {
      assert.deepEqual((error as { getResponse?: () => unknown }).getResponse?.(), {
        code: 'AUTH_RATE_LIMITED',
        message: 'Too many authentication attempts. Please retry later.',
      });
      return true;
    },
  );
});

test('AuthController admin signin uses admin rate limit and returns token for admin', async () => {
  const adminRateLimitCalls: Array<Record<string, unknown>> = [];
  const mockResponse = createMockResponse();
  const controller = new AuthController({
    enforceAdminRateLimit: (input: unknown) => {
      adminRateLimitCalls.push(input as Record<string, unknown>);
    },
    signInWithPassword: async () => ({
      accessToken: 'admin-token-1',
      identity: {
        uid: 'admin-1',
        email: 'admin@example.local',
        tenantId: 'tenant-admin',
        roles: ['admin'],
        access: { accessTier: 'admin' },
      },
    }),
    isAdmin: (roles: string[]) =>
      roles.map((value) => String(value || '').toLowerCase()).includes('admin'),
  });

  const response = await controller.adminSignin(
    { login: 'admin@example.local', password: 'StrongPass123' },
    createMockRequest({
      headers: { 'x-forwarded-for': '203.0.113.8, 10.0.0.2' },
      ip: '127.0.0.1',
    }),
    mockResponse.response,
  );

  assert.equal(response.success, true);
  assert.equal(adminRateLimitCalls.length, 1);
  assert.deepEqual(adminRateLimitCalls[0], {
    action: 'auth.admin.signin',
    clientIp: '203.0.113.8',
    principal: 'admin@example.local',
  });
  assert.equal(mockResponse.cookieCalls.length, 1);
  assert.equal(mockResponse.cookieCalls[0]?.name, 'botmox_token');
  assert.equal(mockResponse.cookieCalls[0]?.value, 'admin-token-1');
});

test('AuthController logout clears auth cookie and returns success', () => {
  const mockResponse = createMockResponse();
  const controller = new AuthController({
    verifyBearerToken: async () => null,
  });

  const response = controller.logout(mockResponse.response);

  assert.deepEqual(response, { success: true });
  assert.deepEqual(mockResponse.clearCookieCalls, ['botmox_token']);
});

test('AuthController admin signin rejects non-admin credentials', async () => {
  const controller = new AuthController({
    enforceAdminRateLimit: () => undefined,
    signInWithPassword: async () => ({
      accessToken: 'token-1',
      identity: {
        uid: 'user-1',
        email: 'user@example.local',
        tenantId: 'tenant-user',
        roles: ['user'],
        access: { accessTier: 'trial' },
      },
    }),
    isAdmin: () => false,
  });

  await assert.rejects(
    () =>
      controller.adminSignin(
        { login: 'user@example.local', password: 'StrongPass123' },
        createMockRequest({
          headers: {},
          ip: '127.0.0.1',
        }),
      ),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse?: () => unknown }).getResponse?.(), {
        code: 'AUTH_ADMIN_INVALID_CREDENTIALS',
        message: 'Invalid admin credentials',
      });
      return true;
    },
  );
});

test('AuthController admin whoami returns mapped identity for admin', async () => {
  const controller = new AuthController({
    verifyBearerToken: async () => ({
      uid: 'admin-1',
      email: 'admin@example.local',
      roles: ['admin'],
      tenantId: 'tenant-admin',
    }),
    isAdmin: (roles: string[]) =>
      roles.map((value) => String(value || '').toLowerCase()).includes('admin'),
  });

  const response = await controller.adminWhoami('Bearer admin-token');
  assert.deepEqual(response, {
    success: true,
    data: {
      uid: 'admin-1',
      email: 'admin@example.local',
      roles: ['admin'],
      tenant_id: 'tenant-admin',
      tenant_type: 'user',
    },
  });
});

test('AuthController admin whoami rejects non-admin identity', async () => {
  const controller = new AuthController({
    verifyBearerToken: async () => ({
      uid: 'user-1',
      email: 'user@example.local',
      roles: ['user'],
      tenantId: 'tenant-user',
    }),
    isAdmin: () => false,
  });

  await assert.rejects(
    () => controller.adminWhoami('Bearer user-token'),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse?: () => unknown }).getResponse?.(), {
        code: 'AUTH_ADMIN_INVALID_CREDENTIALS',
        message: 'Invalid admin credentials',
      });
      return true;
    },
  );
});

test('AuthController signup rejects weak password by policy', async () => {
  const mockResponse = createMockResponse();
  const controller = new AuthController({
    verifyBearerToken: async () => null,
    enforcePublicAuthRateLimit: () => undefined,
    createUserWithTenant: async () => ({
      id: 'u-1',
      email: 'new@example.local',
      tenantId: 'tenant-new',
    }),
    signInWithPassword: async () => ({
      accessToken: 'token-1',
      identity: {
        uid: 'u-1',
        email: 'new@example.local',
        tenantId: 'tenant-new',
        access: { accessTier: 'trial' },
      },
    }),
  });

  await assert.rejects(
    () =>
      controller.signup(
        { email: 'new@example.local', password: 'weakpass1' },
        createMockRequest({
          headers: {},
          ip: '127.0.0.1',
        }),
        mockResponse.response,
      ),
    (error: unknown) => {
      assert.ok(error instanceof BadRequestException);
      const response = (error as { getResponse?: () => unknown }).getResponse?.() as {
        code?: string;
      };
      assert.equal(response.code, 'AUTH_SIGNUP_INVALID_BODY');
      return true;
    },
  );
});
