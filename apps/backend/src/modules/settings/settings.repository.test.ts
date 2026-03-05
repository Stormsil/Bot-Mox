export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { SettingsRepository } = require('./settings.repository.ts');

test('SettingsRepository cutover paths avoid legacy settings_items access', async () => {
  const prisma = {
    withTenantContext: async () => {
      throw new Error('legacy settings_items path must not be used');
    },
    $queryRaw: async () => [
      {
        path: 'settings/api_keys',
        value: { openai_api_key: 'typed' },
        namespace: 'settings',
        value_type: 'object',
      },
    ],
  };

  const repository = new SettingsRepository(prisma);
  const row = await repository.upsert({
    tenantId: 'tenant-a',
    path: 'settings/api_keys',
    payload: { openai_api_key: 'typed' },
  });
  assert.equal((row.payload || {}).openai_api_key, 'typed');

  const found = await repository.findByPath('tenant-a', 'settings/api_keys');
  assert.equal((found?.payload || {}).openai_api_key, 'typed');
});
