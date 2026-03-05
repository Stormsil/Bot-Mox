export {};

const test = require('node:test');
const assert = require('node:assert/strict');
const { WorkspaceRepository } = require('./workspace.repository.ts');

test('WorkspaceRepository cutover paths avoid legacy workspace_items access', async () => {
  const prisma = {
    withTenantContext: async () => {
      throw new Error('legacy workspace_items path must not be used');
    },
    $queryRaw: async () => [
      {
        id: 'note-1',
        data: {},
        kind: 'notes',
        title: 'typed',
        content: 'typed-content',
        preview: 'typed-preview',
        tags: [],
        blocks: {},
        status: 'active',
        priority: 'high',
        start_at: null,
        end_at: null,
        due_at: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ],
    $executeRaw: async () => 1,
  };

  const repository = new WorkspaceRepository(prisma);
  const upserted = await repository.upsert({
    tenantId: 'tenant-a',
    kind: 'notes',
    id: 'note-1',
    payload: { id: 'note-1', kind: 'notes', title: 'typed' },
  });
  assert.equal(upserted.id, 'note-1');

  const deleted = await repository.delete('tenant-a', 'notes', 'note-1');
  assert.equal(deleted, true);
});
