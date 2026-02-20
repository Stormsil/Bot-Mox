export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSecretKey } = require('node:crypto');
const { SignJWT } = require('jose');
const { AuthService } = require('./auth.service.ts');

const ORIGINAL_ENV = {
  AUTH_MODE: process.env.AUTH_MODE,
  SUPABASE_JWT_SECRET: process.env.SUPABASE_JWT_SECRET,
  SUPABASE_JWT_ISSUER: process.env.SUPABASE_JWT_ISSUER,
  SUPABASE_JWT_AUDIENCE: process.env.SUPABASE_JWT_AUDIENCE,
  SUPABASE_JWKS_URL: process.env.SUPABASE_JWKS_URL,
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
  process.env.AUTH_MODE = ORIGINAL_ENV.AUTH_MODE;
  process.env.SUPABASE_JWT_SECRET = ORIGINAL_ENV.SUPABASE_JWT_SECRET;
  process.env.SUPABASE_JWT_ISSUER = ORIGINAL_ENV.SUPABASE_JWT_ISSUER;
  process.env.SUPABASE_JWT_AUDIENCE = ORIGINAL_ENV.SUPABASE_JWT_AUDIENCE;
  process.env.SUPABASE_JWKS_URL = ORIGINAL_ENV.SUPABASE_JWKS_URL;
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
