export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  normalizeOrigin,
  parseAllowedOrigins,
  extractRequestOrigin,
  isAdminOriginProtectedPath,
} = require('./origin-policy.ts');

test('normalizeOrigin normalizes host and strips path', () => {
  assert.equal(normalizeOrigin('HTTPS://Admin.Example.com/path?q=1'), 'https://admin.example.com');
  assert.equal(normalizeOrigin('not-a-url'), '');
});

test('parseAllowedOrigins uses fallback when env is empty', () => {
  const set = parseAllowedOrigins('', ['http://localhost:5173', 'http://admin.localhost']);
  assert.deepEqual(Array.from(set), ['http://localhost:5173', 'http://admin.localhost']);
});

test('parseAllowedOrigins uses explicit env list when provided', () => {
  const set = parseAllowedOrigins('https://app.example.com, https://admin.example.com', [
    'http://localhost:5173',
  ]);
  assert.deepEqual(Array.from(set), ['https://app.example.com', 'https://admin.example.com']);
});

test('extractRequestOrigin prioritizes Origin header and falls back to Referer', () => {
  assert.equal(
    extractRequestOrigin({
      origin: 'https://admin.example.com',
      referer: 'https://ignored.example.com/path',
    }),
    'https://admin.example.com',
  );

  assert.equal(
    extractRequestOrigin({
      referer: 'https://admin.example.com/path?q=1',
    }),
    'https://admin.example.com',
  );
});

test('isAdminOriginProtectedPath detects admin-sensitive endpoints', () => {
  assert.equal(isAdminOriginProtectedPath('/api/v1/admin/access/tenants'), true);
  assert.equal(isAdminOriginProtectedPath('/api/v1/auth/admin/create-user'), true);
  assert.equal(isAdminOriginProtectedPath('/api/v1/billing/admin/mock-payment'), true);
  assert.equal(isAdminOriginProtectedPath('/api/v1/diag/runtime-metrics'), true);
  assert.equal(isAdminOriginProtectedPath('/api/v1/resources/licenses'), false);
});
