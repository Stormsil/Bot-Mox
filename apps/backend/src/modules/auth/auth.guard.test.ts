export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { ForbiddenException, UnauthorizedException } = require('@nestjs/common');
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

test('AuthGuard allows public admin signin route without auth', async () => {
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
    method: 'POST',
    path: '/api/v1/auth/admin/signin',
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

test('AuthGuard stores verified identity on request from cookie token', async () => {
  let seenToken = '';
  const authService = {
    verifyBearerToken: async (token: string) => {
      seenToken = token;
      return {
        uid: 'user-1',
        email: 'user1@botmox.local',
        roles: ['admin'],
        tenantId: 'tenant-a',
        tokenId: 'token-1',
        raw: {},
      };
    },
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
    cookies: { botmox_token: '  cookie-user-token  ' },
  };

  const allowed = await guard.canActivate(makeContext(req));
  assert.equal(allowed, true);
  assert.equal(seenToken, 'cookie-user-token');
  assert.equal((req[REQUEST_IDENTITY_KEY] as { userId: string }).userId, 'user-1');
  assert.equal((req[REQUEST_IDENTITY_KEY] as { tenantId: string }).tenantId, 'tenant-a');
});

test('AuthGuard falls back to agent bearer token when user cookie token is invalid', async () => {
  let seenUserToken = '';
  let seenAgentHeader = '';
  const authService = {
    verifyBearerToken: async (token: string) => {
      seenUserToken = token;
      return null;
    },
    verifyAgentBearerToken: async (authorization: string) => {
      seenAgentHeader = authorization;
      return {
        uid: 'agent-1',
        email: 'agent1@botmox.local',
        roles: ['agent'],
        tenantId: 'tenant-agent',
        access: {
          tenantType: 'agent',
          accessTier: 'premium',
          premiumActive: true,
          writeAccess: true,
          lifetimePremium: false,
          trialEndsAt: null,
          premiumUntil: null,
        },
        raw: {},
      };
    },
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
    method: 'POST',
    path: '/api/v1/agents/heartbeat',
    headers: { authorization: 'Bearer agent-token' },
    cookies: { botmox_token: 'user-token-that-fails' },
  };

  const allowed = await guard.canActivate(makeContext(req));
  assert.equal(allowed, true);
  assert.equal(seenUserToken, 'user-token-that-fails');
  assert.equal(seenAgentHeader, 'Bearer agent-token');
  assert.equal((req[REQUEST_IDENTITY_KEY] as { userId: string }).userId, 'agent-1');
  assert.equal((req[REQUEST_IDENTITY_KEY] as { tenantId: string }).tenantId, 'tenant-agent');
});

test('AuthGuard blocks write endpoints for free access tier', async () => {
  const authService = {
    verifyBearerToken: async () => ({
      uid: 'user-free',
      email: 'free@botmox.local',
      roles: ['user'],
      tenantId: 'tenant-free',
      access: {
        tenantType: 'user',
        accessTier: 'free',
        premiumActive: false,
        writeAccess: false,
        lifetimePremium: false,
        trialEndsAt: null,
        premiumUntil: null,
      },
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
    method: 'POST',
    path: '/api/v1/bots',
    headers: { authorization: 'Bearer free-token' },
  };

  await assert.rejects(
    () => guard.canActivate(makeContext(req)),
    (error: unknown) => {
      assert.ok(error instanceof ForbiddenException);
      assert.deepEqual((error as { getResponse: () => unknown }).getResponse(), {
        code: 'PREMIUM_REQUIRED',
        message: 'Premium access or active trial is required for write operations',
      });
      return true;
    },
  );
});

test('AuthGuard allows free access tier to start one-time trial', async () => {
  const authService = {
    verifyBearerToken: async () => ({
      uid: 'user-free',
      email: 'free@botmox.local',
      roles: ['user'],
      tenantId: 'tenant-free',
      access: {
        tenantType: 'user',
        accessTier: 'free',
        premiumActive: false,
        writeAccess: false,
        lifetimePremium: false,
        trialEndsAt: null,
        premiumUntil: null,
      },
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
    method: 'POST',
    path: '/api/v1/billing/trial/start',
    headers: { authorization: 'Bearer free-token' },
  };

  const allowed = await guard.canActivate(makeContext(req));
  assert.equal(allowed, true);
  assert.equal((req[REQUEST_IDENTITY_KEY] as { tenantId: string }).tenantId, 'tenant-free');
});
