export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSecretKey } = require('node:crypto');
const { SignJWT } = require('jose');
const { AuthService } = require('./auth.service.ts');

const ORIGINAL_ENV = {
  NODE_ENV: process.env.NODE_ENV,
  AUTH_MODE: process.env.AUTH_MODE,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  SUPABASE_JWT_ISSUER: process.env.SUPABASE_JWT_ISSUER,
  SUPABASE_JWT_AUDIENCE: process.env.SUPABASE_JWT_AUDIENCE,
  SUPABASE_JWKS_URL: process.env.SUPABASE_JWKS_URL,
  AGENT_AUTH_SECRET: process.env.AGENT_AUTH_SECRET,
  AGENT_AUTH_ISSUER: process.env.AGENT_AUTH_ISSUER,
  AGENT_AUTH_AUDIENCE: process.env.AGENT_AUTH_AUDIENCE,
  AGENT_AUTH_TOKEN_TTL_SECONDS: process.env.AGENT_AUTH_TOKEN_TTL_SECONDS,
  TRIAL_DURATION_HOURS: process.env.TRIAL_DURATION_HOURS,
  AUTH_SIGNIN_RATE_LIMIT_MAX: process.env.AUTH_SIGNIN_RATE_LIMIT_MAX,
  AUTH_SIGNIN_RATE_LIMIT_WINDOW_SECONDS: process.env.AUTH_SIGNIN_RATE_LIMIT_WINDOW_SECONDS,
  AUTH_ADMIN_RATE_LIMIT_MAX: process.env.AUTH_ADMIN_RATE_LIMIT_MAX,
  AUTH_ADMIN_RATE_LIMIT_WINDOW_SECONDS: process.env.AUTH_ADMIN_RATE_LIMIT_WINDOW_SECONDS,
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
};

async function signToken(payload: Record<string, unknown>) {
  const secret = String(process.env.SUPABASE_JWT_SECRET || '');
  const key = createSecretKey(Buffer.from(secret));
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject('user-1')
    .setIssuer(String(process.env.SUPABASE_JWT_ISSUER || 'supabase'))
    .setAudience(String(process.env.SUPABASE_JWT_AUDIENCE || 'authenticated'))
    .setIssuedAt()
    .setExpirationTime('10m')
    .sign(key);
}

function resetEnv() {
  process.env.NODE_ENV = ORIGINAL_ENV.NODE_ENV;
  process.env.AUTH_MODE = ORIGINAL_ENV.AUTH_MODE;
  process.env.SUPABASE_JWT_SECRET = ORIGINAL_ENV.SUPABASE_JWT_SECRET;
  process.env.SUPABASE_JWT_ISSUER = ORIGINAL_ENV.SUPABASE_JWT_ISSUER;
  process.env.SUPABASE_JWT_AUDIENCE = ORIGINAL_ENV.SUPABASE_JWT_AUDIENCE;
  process.env.SUPABASE_JWKS_URL = ORIGINAL_ENV.SUPABASE_JWKS_URL;
  process.env.AGENT_AUTH_SECRET = ORIGINAL_ENV.AGENT_AUTH_SECRET;
  process.env.AGENT_AUTH_ISSUER = ORIGINAL_ENV.AGENT_AUTH_ISSUER;
  process.env.AGENT_AUTH_AUDIENCE = ORIGINAL_ENV.AGENT_AUTH_AUDIENCE;
  process.env.AGENT_AUTH_TOKEN_TTL_SECONDS = ORIGINAL_ENV.AGENT_AUTH_TOKEN_TTL_SECONDS;
  process.env.TRIAL_DURATION_HOURS = ORIGINAL_ENV.TRIAL_DURATION_HOURS;
  process.env.AUTH_SIGNIN_RATE_LIMIT_MAX = ORIGINAL_ENV.AUTH_SIGNIN_RATE_LIMIT_MAX;
  process.env.AUTH_SIGNIN_RATE_LIMIT_WINDOW_SECONDS =
    ORIGINAL_ENV.AUTH_SIGNIN_RATE_LIMIT_WINDOW_SECONDS;
  process.env.AUTH_ADMIN_RATE_LIMIT_MAX = ORIGINAL_ENV.AUTH_ADMIN_RATE_LIMIT_MAX;
  process.env.AUTH_ADMIN_RATE_LIMIT_WINDOW_SECONDS =
    ORIGINAL_ENV.AUTH_ADMIN_RATE_LIMIT_WINDOW_SECONDS;
  process.env.SUPABASE_URL = ORIGINAL_ENV.SUPABASE_URL;
  process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_ENV.SUPABASE_SERVICE_ROLE_KEY;
}

test('AuthService throws when AUTH_MODE is not enforced in production', async () => {
  process.env.NODE_ENV = 'production';
  process.env.AUTH_MODE = 'shadow';
  process.env.SUPABASE_JWKS_URL = '';

  try {
    assert.throws(() => new AuthService(), /AUTH_MODE must be "enforced" in production/);
  } finally {
    resetEnv();
  }
});

test('AuthService allows enforced mode in production', async () => {
  process.env.NODE_ENV = 'production';
  process.env.AUTH_MODE = 'enforced';
  process.env.TRIAL_DURATION_HOURS = '24';
  process.env.SUPABASE_JWKS_URL = '';

  try {
    assert.doesNotThrow(() => new AuthService());
  } finally {
    resetEnv();
  }
});

test('AuthService throws in production when TRIAL_DURATION_HOURS is not 24', async () => {
  process.env.NODE_ENV = 'production';
  process.env.AUTH_MODE = 'enforced';
  process.env.TRIAL_DURATION_HOURS = '48';
  process.env.SUPABASE_JWKS_URL = '';

  try {
    assert.throws(() => new AuthService(), /TRIAL_DURATION_HOURS must be exactly 24 in production/);
  } finally {
    resetEnv();
  }
});

function createTenantAccessPrismaStub() {
  const rows = new Map<string, Record<string, unknown>>();
  return {
    withTenantContext: async (
      _tenantId: string,
      cb: (tx: Record<string, unknown>) => Promise<unknown>,
    ) => {
      const tx = {
        tenantAccountAccess: {
          findUnique: async (args: { where: { tenantId: string } }) => {
            const tenantId = String(args?.where?.tenantId || '')
              .trim()
              .toLowerCase();
            const row = rows.get(tenantId);
            return row ? { ...row } : null;
          },
          create: async (args: { data: Record<string, unknown> }) => {
            const tenantId = String(args?.data?.tenantId || '')
              .trim()
              .toLowerCase();
            const next = { ...args.data, tenantId };
            rows.set(tenantId, next);
            return { ...next };
          },
          upsert: async (args: {
            where: { tenantId: string };
            create: Record<string, unknown>;
            update: Record<string, unknown>;
          }) => {
            const tenantId = String(args?.where?.tenantId || '')
              .trim()
              .toLowerCase();
            const existing = rows.get(tenantId);
            const next = existing
              ? { ...existing, ...args.update, tenantId }
              : { ...args.create, tenantId };
            rows.set(tenantId, next);
            return { ...next };
          },
        },
      };
      return cb(tx);
    },
  };
}

test('AuthService enforced mode rejects token without tenant claim', async () => {
  process.env.AUTH_MODE = 'enforced';
  process.env.SUPABASE_JWT_SECRET = 'test-secret-1234567890';
  process.env.SUPABASE_JWT_ISSUER = 'supabase';
  process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
  process.env.SUPABASE_JWKS_URL = '';

  try {
    const token = await signToken({ role: 'user' });
    const service = new AuthService();
    const identity = await service.verifyBearerToken(token);
    assert.equal(identity, null);
  } finally {
    resetEnv();
  }
});

test('AuthService enforced mode accepts token with tenant claim', async () => {
  process.env.AUTH_MODE = 'enforced';
  process.env.SUPABASE_JWT_SECRET = 'test-secret-1234567890';
  process.env.SUPABASE_JWT_ISSUER = 'supabase';
  process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
  process.env.SUPABASE_JWKS_URL = '';

  try {
    const token = await signToken({
      role: 'admin',
      email: 'admin@botmox.local',
      tenant_id: 'tenant-a',
    });
    const service = new AuthService();
    const identity = await service.verifyBearerToken(token);

    assert.ok(identity);
    assert.equal(identity?.tenantId, 'tenant-a');
    assert.equal(identity?.email, 'admin@botmox.local');
    assert.deepEqual(identity?.roles, ['admin']);
  } finally {
    resetEnv();
  }
});

test('AuthService shadow mode still rejects token without tenant claim', async () => {
  process.env.NODE_ENV = 'test';
  process.env.AUTH_MODE = 'shadow';
  process.env.SUPABASE_JWT_SECRET = 'test-secret-1234567890';
  process.env.SUPABASE_JWT_ISSUER = 'supabase';
  process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
  process.env.SUPABASE_JWKS_URL = '';

  try {
    const token = await signToken({ role: 'user' });
    const service = new AuthService();
    const identity = await service.verifyBearerToken(token);
    assert.equal(identity, null);
  } finally {
    resetEnv();
  }
});

test('AuthService issues and verifies dedicated agent token', async () => {
  process.env.AUTH_MODE = 'enforced';
  process.env.SUPABASE_JWKS_URL = '';
  process.env.AGENT_AUTH_SECRET = 'agent-secret-1234567890';
  process.env.AGENT_AUTH_ISSUER = 'botmox-agent';
  process.env.AGENT_AUTH_AUDIENCE = 'botmox-agent';
  process.env.AGENT_AUTH_TOKEN_TTL_SECONDS = '900';

  try {
    const service = new AuthService();
    const issued = await service.issueAgentToken({
      tenantId: 'tenant-z',
      agentId: 'agent-z',
      pairedByUserId: 'user-z',
    });

    const identity = await service.verifyAgentBearerToken(`Bearer ${issued.token}`);
    assert.ok(identity);
    assert.equal(identity?.tenantId, 'tenant-z');
    assert.deepEqual(identity?.roles, ['agent']);
    assert.equal(identity?.raw.agent_id, 'agent-z');
  } finally {
    resetEnv();
  }
});

test('AuthService free -> trial -> revoke -> premium flow is deterministic and one-way', async () => {
  process.env.AUTH_MODE = 'enforced';
  process.env.SUPABASE_JWT_SECRET = 'test-secret-1234567890';
  process.env.SUPABASE_JWT_ISSUER = 'supabase';
  process.env.SUPABASE_JWT_AUDIENCE = 'authenticated';
  process.env.SUPABASE_JWKS_URL = '';
  process.env.TRIAL_DURATION_HOURS = '24';

  try {
    const token = await signToken({
      role: 'user',
      email: 'u@tenant-a.local',
      tenant_id: 'tenant-a',
    });
    const prismaStub = createTenantAccessPrismaStub();
    const service = new AuthService(prismaStub);

    const firstIdentity = await service.verifyBearerToken(`Bearer ${token}`);
    assert.ok(firstIdentity);
    assert.equal(firstIdentity?.access.accessTier, 'free');
    assert.equal(firstIdentity?.access.writeAccess, false);

    const trial = await service.startTrial({ tenantId: 'tenant-a' });
    assert.equal(trial.accessTier, 'trial');
    assert.equal(trial.writeAccess, true);

    const revoked = await service.revokePremium({ tenantId: 'tenant-a' });
    assert.equal(revoked.accessTier, 'free');
    assert.equal(revoked.writeAccess, false);

    const secondIdentity = await service.verifyBearerToken(`Bearer ${token}`);
    assert.ok(secondIdentity);
    assert.equal(secondIdentity?.access.accessTier, 'free');
    assert.equal(secondIdentity?.access.writeAccess, false);

    const granted = await service.grantPremium({ tenantId: 'tenant-a', days: 7 });
    assert.equal(granted.accessTier, 'premium');
    assert.equal(granted.writeAccess, true);

    const thirdIdentity = await service.verifyBearerToken(`Bearer ${token}`);
    assert.ok(thirdIdentity);
    assert.equal(thirdIdentity?.access.accessTier, 'premium');
    assert.equal(thirdIdentity?.access.writeAccess, true);
  } finally {
    resetEnv();
  }
});

test('AuthService public auth rate limit rejects excessive signin attempts', async () => {
  process.env.SUPABASE_JWKS_URL = '';
  process.env.AUTH_SIGNIN_RATE_LIMIT_MAX = '1';
  process.env.AUTH_SIGNIN_RATE_LIMIT_WINDOW_SECONDS = '60';

  try {
    const service = new AuthService();
    service.enforcePublicAuthRateLimit({
      scope: 'signin',
      clientIp: '203.0.113.9',
      principal: 'u@example.local',
    });

    assert.throws(
      () =>
        service.enforcePublicAuthRateLimit({
          scope: 'signin',
          clientIp: '203.0.113.9',
          principal: 'u@example.local',
        }),
      (error: unknown) => {
        const response = (error as { getResponse?: () => unknown }).getResponse?.() as {
          code?: string;
          message?: string;
        };
        assert.equal(response.code, 'AUTH_RATE_LIMITED');
        assert.equal(response.message, 'Too many authentication attempts. Please retry later.');
        return true;
      },
    );
  } finally {
    resetEnv();
  }
});

test('AuthService admin rate limit rejects excessive attempts', async () => {
  process.env.SUPABASE_JWKS_URL = '';
  process.env.AUTH_ADMIN_RATE_LIMIT_MAX = '1';
  process.env.AUTH_ADMIN_RATE_LIMIT_WINDOW_SECONDS = '60';

  try {
    const service = new AuthService();
    service.enforceAdminRateLimit({
      action: 'admin.access.get:/api/v1/admin/access/tenants',
      clientIp: '203.0.113.10',
      actorUserId: 'admin-user-1',
      principal: 'tenant-admin',
    });

    assert.throws(
      () =>
        service.enforceAdminRateLimit({
          action: 'admin.access.get:/api/v1/admin/access/tenants',
          clientIp: '203.0.113.10',
          actorUserId: 'admin-user-1',
          principal: 'tenant-admin',
        }),
      (error: unknown) => {
        const response = (error as { getResponse?: () => unknown }).getResponse?.() as {
          code?: string;
          message?: string;
        };
        assert.equal(response.code, 'AUTH_RATE_LIMITED');
        assert.equal(response.message, 'Too many authentication attempts. Please retry later.');
        return true;
      },
    );
  } finally {
    resetEnv();
  }
});

test('AuthService createUserWithTenant maps duplicate email to deterministic conflict code', async () => {
  process.env.SUPABASE_URL = 'http://supabase.local';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  process.env.SUPABASE_JWKS_URL = '';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () =>
    ({
      ok: false,
      status: 400,
      json: async () => ({
        msg: 'A user with this email has already been registered',
      }),
    }) as Response) as typeof fetch;

  try {
    const service = new AuthService();
    await assert.rejects(
      () =>
        service.createUserWithTenant({
          email: 'existing@example.local',
          password: 'StrongPass123',
        }),
      (error: unknown) => {
        const response = (error as { getResponse?: () => unknown }).getResponse?.() as {
          code?: string;
          message?: string;
        };
        assert.equal(response.code, 'AUTH_EMAIL_ALREADY_EXISTS');
        assert.equal(response.message, 'Account with this email already exists');
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    resetEnv();
  }
});

test('AuthService createUserWithTenant rejects weak password by policy before external call', async () => {
  process.env.SUPABASE_URL = 'http://supabase.local';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  process.env.SUPABASE_JWKS_URL = '';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('fetch should not be called for weak password');
  }) as typeof fetch;

  try {
    const service = new AuthService();
    await assert.rejects(
      () =>
        service.createUserWithTenant({
          email: 'new@example.local',
          password: 'weakpass1',
        }),
      (error: unknown) => {
        const response = (error as { getResponse?: () => unknown }).getResponse?.() as {
          code?: string;
          message?: string;
        };
        assert.equal(response.code, 'AUTH_PASSWORD_POLICY_FAILED');
        assert.equal(
          response.message,
          'Password must be 8-256 chars and include uppercase, lowercase, and digit characters',
        );
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    resetEnv();
  }
});

test('AuthService resetUserPassword rejects weak password by policy before external call', async () => {
  process.env.SUPABASE_URL = 'http://supabase.local';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key';
  process.env.SUPABASE_JWKS_URL = '';

  const originalFetch = globalThis.fetch;
  globalThis.fetch = (async () => {
    throw new Error('fetch should not be called for weak password');
  }) as typeof fetch;

  try {
    const service = new AuthService();
    await assert.rejects(
      () =>
        service.resetUserPassword({
          userId: 'user-1',
          newPassword: 'weakpass1',
        }),
      (error: unknown) => {
        const response = (error as { getResponse?: () => unknown }).getResponse?.() as {
          code?: string;
          message?: string;
        };
        assert.equal(response.code, 'AUTH_PASSWORD_POLICY_FAILED');
        assert.equal(
          response.message,
          'Password must be 8-256 chars and include uppercase, lowercase, and digit characters',
        );
        return true;
      },
    );
  } finally {
    globalThis.fetch = originalFetch;
    resetEnv();
  }
});
