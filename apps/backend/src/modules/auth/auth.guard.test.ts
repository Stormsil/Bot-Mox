export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { UnauthorizedException } = require('@nestjs/common');
const { AuthGuard } = require('./auth.guard.ts');
const { REQUEST_IDENTITY_KEY } = require('./request-identity.ts');

function makeContext(req: Record<string, unknown>) {
  return {
    switchToHttp: () => ({
      getRequest: () => req,
    }),
  };
}

test('AuthGuard allows public health route without auth', async () => {
  let verifyCalls = 0;
  const authService = {
    verifyBearerToken: async () => {
      verifyCalls += 1;
      return null;
    },
    isShadow: () => false,
    createShadowIdentity: () => ({
      uid: 'shadow',
      email: 'shadow@local',
      roles: ['user'],
      tenantId: 'shadow-tenant',
      raw: {},
    }),
  };
  const guard = new AuthGuard(authService);
  const req: Record<string, unknown> = {
    method: 'GET',
    path: '/api/v1/health',
    headers: {},
  };

  const allowed = await guard.canActivate(makeContext(req));
  assert.equal(allowed, true);
  assert.equal(verifyCalls, 0);
});

test('AuthGuard in shadow mode injects shadow identity when token invalid', async () => {
  const authService = {
    verifyBearerToken: async () => null,
    isShadow: () => true,
    createShadowIdentity: () => ({
      uid: 'shadow-user',
      email: 'shadow@local',
      roles: ['user'],
      tenantId: 'shadow-tenant',
      raw: {},
    }),
  };
  const guard = new AuthGuard(authService);
  const req: Record<string, unknown> = {
    method: 'GET',
    path: '/api/v1/resources/licenses',
    headers: {},
  };

  const allowed = await guard.canActivate(makeContext(req));
  assert.equal(allowed, true);
  assert.ok(req[REQUEST_IDENTITY_KEY]);
  assert.equal((req[REQUEST_IDENTITY_KEY] as { tenantId: string }).tenantId, 'shadow-tenant');
});

test('AuthGuard in enforced mode rejects invalid token', async () => {
  const authService = {
    verifyBearerToken: async () => null,
    isShadow: () => false,
    createShadowIdentity: () => ({
      uid: 'shadow-user',
      email: 'shadow@local',
      roles: ['user'],
      tenantId: 'shadow-tenant',
      raw: {},
    }),
  };
  const guard = new AuthGuard(authService);
  const req: Record<string, unknown> = {
    method: 'GET',
    path: '/api/v1/resources/licenses',
    headers: {},
  };

  await assert.rejects(
    () => guard.canActivate(makeContext(req)),
    (error: unknown) => {
      assert.ok(error instanceof UnauthorizedException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'INVALID_OR_MISSING_BEARER_TOKEN',
        message: 'Invalid or missing bearer token',
      });
      return true;
    },
  );
});

test('AuthGuard stores verified identity on request', async () => {
  const authService = {
    verifyBearerToken: async () => ({
      uid: 'user-1',
      email: 'user1@botmox.local',
      roles: ['admin'],
      tenantId: 'tenant-a',
      tokenId: 'token-1',
      raw: {},
    }),
    isShadow: () => false,
    createShadowIdentity: () => ({
      uid: 'shadow-user',
      email: 'shadow@local',
      roles: ['user'],
      tenantId: 'shadow-tenant',
      raw: {},
    }),
  };
  const guard = new AuthGuard(authService);
  const req: Record<string, unknown> = {
    method: 'GET',
    path: '/api/v1/resources/licenses',
    headers: { authorization: 'Bearer valid-token' },
  };

  const allowed = await guard.canActivate(makeContext(req));
  assert.equal(allowed, true);
  assert.equal((req[REQUEST_IDENTITY_KEY] as { userId: string }).userId, 'user-1');
  assert.equal((req[REQUEST_IDENTITY_KEY] as { tenantId: string }).tenantId, 'tenant-a');
});
