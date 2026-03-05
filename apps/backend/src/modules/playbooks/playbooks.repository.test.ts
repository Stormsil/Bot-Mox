export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { PlaybooksRepository } = require('./playbooks.repository.ts');

test('PlaybooksRepository cutover paths avoid legacy playbook_items access', async () => {
  const prisma = {
    withTenantContext: async () => {
      throw new Error('legacy playbook_items path must not be used');
    },
    $queryRaw: async () => [
      {
        id: 'pb-1',
        data: {},
        name: 'typed',
        content: 'typed-content',
        is_default: false,
        status: 'active',
        version: 'v1',
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    $executeRaw: async () => 1,
  };

  const repository = new PlaybooksRepository(prisma);
  const upserted = await repository.upsert({
    tenantId: 'tenant-a',
    id: 'pb-1',
    payload: { id: 'pb-1', name: 'typed', content: 'typed-content' },
  });
  assert.equal(upserted.id, 'pb-1');

  const deleted = await repository.delete('tenant-a', 'pb-1');
  assert.equal(deleted, true);
});
