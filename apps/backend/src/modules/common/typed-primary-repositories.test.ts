export {};

const test = require('node:test');
const assert = require('node:assert/strict');

const { WorkspaceRepository } = require('../workspace/workspace.repository.ts');
const { PlaybooksRepository } = require('../playbooks/playbooks.repository.ts');
const { SettingsRepository } = require('../settings/settings.repository.ts');
const { ThemeAssetsRepository } = require('../theme-assets/theme-assets.repository.ts');

function withEnv(overrides: Record<string, string>, run: () => Promise<void> | void) {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(overrides)) {
    previous[key] = process.env[key];
    process.env[key] = value;
  }

  const restore = () => {
    for (const key of Object.keys(overrides)) {
      const prior = previous[key];
      if (prior === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = prior;
      }
    }
  };

  try {
    const result = run();
    if (result && typeof (result as Promise<void>).then === 'function') {
      return (result as Promise<void>).finally(restore);
    }
    restore();
    return result;
  } catch (error) {
    restore();
    throw error;
  }
}

function sqlText(statement: unknown): string {
  const candidate = statement as { strings?: string[]; sql?: string[] };
  const chunks = Array.isArray(candidate?.strings)
    ? candidate.strings
    : Array.isArray(candidate?.sql)
      ? candidate.sql
      : [];
  return chunks.join(' ').replace(/\s+/g, ' ').trim().toLowerCase();
}

function sqlValues(statement: unknown): unknown[] {
  const candidate = statement as { values?: unknown[] };
  return Array.isArray(candidate?.values) ? candidate.values : [];
}

test('workspace repository reads typed business columns before JSON data', async () => {
  await withEnv(
    {
      BOTMOX_TYPED_STORE_PARITY_GATE: 'false',
      BOTMOX_WORKSPACE_DUAL_WRITE: 'false',
      BOTMOX_WORKSPACE_READ_PRECEDENCE: 'typed-first',
    },
    async () => {
      let legacyReads = 0;
      const prisma = {
        $queryRaw: async () => [
          {
            id: 'note-1',
            data: { title: 'json-title', status: 'json-status' },
            kind: 'notes',
            title: 'typed-title',
            status: 'typed-status',
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],
        withTenantContext: async () => {
          legacyReads += 1;
          return [];
        },
      };

      const repository = new WorkspaceRepository(prisma);
      const rows = await repository.list('tenant-a', 'notes');

      assert.equal(legacyReads, 0);
      assert.equal(rows.length, 1);
      assert.equal(rows[0].payload.title, 'typed-title');
      assert.equal(rows[0].payload.status, 'typed-status');
    },
  );
});

test('workspace repository typed-first does not fallback to legacy JSON read path', async () => {
  await withEnv(
    {
      BOTMOX_TYPED_STORE_PARITY_GATE: 'false',
      BOTMOX_WORKSPACE_DUAL_WRITE: 'false',
      BOTMOX_WORKSPACE_READ_PRECEDENCE: 'typed-first',
    },
    async () => {
      let legacyReads = 0;
      const prisma = {
        $queryRaw: async () => [],
        withTenantContext: async () => {
          legacyReads += 1;
          return [
            {
              id: 'legacy-note',
              payload: { title: 'legacy-title' },
            },
          ];
        },
      };

      const repository = new WorkspaceRepository(prisma);
      const rows = await repository.list('tenant-a', 'notes');

      assert.equal(legacyReads, 0);
      assert.deepEqual(rows, []);
    },
  );
});

test('playbooks repository upsert targets typed columns', async () => {
  await withEnv(
    { BOTMOX_TYPED_STORE_PARITY_GATE: 'false', BOTMOX_PLAYBOOKS_DUAL_WRITE: 'false' },
    async () => {
      const statements: string[] = [];
      const prisma = {
        $queryRaw: async (statement: unknown) => {
          statements.push(sqlText(statement));
          return [
            {
              id: 'pb-1',
              data: { name: 'json-name' },
              name: 'typed-name',
              content: 'typed-content',
              is_default: true,
              status: 'active',
              version: 'v1',
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
        },
        withTenantContext: async () => {
          throw new Error('legacy write should not be used in typed-primary mode');
        },
      };

      const repository = new PlaybooksRepository(prisma);
      const row = await repository.upsert({
        tenantId: 'tenant-a',
        id: 'pb-1',
        payload: { name: 'typed-name', content: 'typed-content', is_default: true },
      });

      assert.match(
        statements[0] || '',
        /insert into public\.playbooks \( .*name, .*content, .*is_default, .*status, .*version,/,
      );
      assert.equal(row.payload.name, 'typed-name');
      assert.equal(row.payload.content, 'typed-content');
      assert.equal(row.payload.is_default, true);
    },
  );
});

test('settings repository reads typed path/value even when data map is stale', async () => {
  await withEnv(
    {
      BOTMOX_TYPED_STORE_PARITY_GATE: 'false',
      BOTMOX_SETTINGS_DUAL_WRITE: 'false',
      BOTMOX_SETTINGS_READ_PRECEDENCE: 'typed-first',
    },
    async () => {
      const prisma = {
        $queryRaw: async () => [
          {
            path: 'settings/theme',
            value: { palette: 'from-typed-value' },
            namespace: 'settings',
            value_type: 'object',
            data: {
              'settings/theme': { palette: 'from-stale-data-map' },
            },
          },
        ],
        withTenantContext: async () => {
          throw new Error('legacy read should not be used when typed row exists');
        },
      };

      const repository = new SettingsRepository(prisma);
      const row = await repository.findByPath('tenant-a', 'settings/theme');

      assert.ok(row);
      assert.deepEqual(row.payload, { palette: 'from-typed-value' });
    },
  );
});

test('settings repository typed-first write path ignores legacy storage availability', async () => {
  await withEnv(
    {
      BOTMOX_TYPED_STORE_PARITY_GATE: 'false',
      BOTMOX_SETTINGS_READ_PRECEDENCE: 'typed-first',
      BOTMOX_SETTINGS_DUAL_WRITE: 'true',
      BOTMOX_SETTINGS_DUAL_WRITE_PHASE: 'hard',
    },
    async () => {
      const prisma = {
        $queryRaw: async () => [
          {
            path: 'settings/theme',
            value: { palette: 'typed' },
            namespace: 'settings',
            value_type: 'object',
          },
        ],
        withTenantContext: async () => {
          const missingStorageError = new Error(
            'relation "settings_items" does not exist',
          ) as Error & {
            code?: string;
          };
          missingStorageError.code = 'P2021';
          throw missingStorageError;
        },
      };

      const repository = new SettingsRepository(prisma);
      const row = await repository.upsert({
        tenantId: 'tenant-a',
        path: 'settings/theme',
        payload: { palette: 'typed' },
      });

      assert.deepEqual(row.payload, { palette: 'typed' });
    },
  );
});

test('settings repository typed-first does not fallback to legacy JSON path', async () => {
  await withEnv(
    {
      BOTMOX_TYPED_STORE_PARITY_GATE: 'false',
      BOTMOX_SETTINGS_DUAL_WRITE: 'false',
      BOTMOX_SETTINGS_READ_PRECEDENCE: 'typed-first',
    },
    async () => {
      let legacyReads = 0;
      const prisma = {
        $queryRaw: async () => [],
        withTenantContext: async () => {
          legacyReads += 1;
          return {
            payload: { palette: 'legacy' },
          };
        },
      };

      const repository = new SettingsRepository(prisma);
      const row = await repository.findByPath('tenant-a', 'settings/theme');

      assert.equal(legacyReads, 0);
      assert.equal(row, null);
    },
  );
});

test('settings repository does not read requested path from app_settings.data map', async () => {
  await withEnv(
    {
      BOTMOX_TYPED_STORE_PARITY_GATE: 'false',
      BOTMOX_SETTINGS_DUAL_WRITE: 'false',
      BOTMOX_SETTINGS_READ_PRECEDENCE: 'typed-first',
    },
    async () => {
      const prisma = {
        $queryRaw: async () => [
          {
            path: 'settings/last-written',
            value: { palette: 'typed-latest' },
            namespace: 'settings',
            value_type: 'object',
            data: {
              'settings/theme': { palette: 'stale-json-map' },
            },
          },
        ],
        withTenantContext: async () => {
          throw new Error('legacy read should not be used when typed row exists');
        },
      };

      const repository = new SettingsRepository(prisma);
      const row = await repository.findByPath('tenant-a', 'settings/theme');

      assert.equal(row, null);
    },
  );
});

test('settings repository keeps typed rows isolated per path for same tenant', async () => {
  await withEnv(
    {
      BOTMOX_TYPED_STORE_PARITY_GATE: 'false',
      BOTMOX_SETTINGS_DUAL_WRITE: 'false',
      BOTMOX_SETTINGS_READ_PRECEDENCE: 'typed-first',
    },
    async () => {
      const statements: string[] = [];
      const typedRows = new Map<string, Record<string, unknown>>();

      const prisma = {
        $queryRaw: async (statement: unknown) => {
          const text = sqlText(statement);
          statements.push(text);
          const values = sqlValues(statement);

          if (text.startsWith('insert into public.app_settings')) {
            const tenantId = String(values[0] ?? '');
            const path = String(values[1] ?? '');
            const payloadRaw = String(values[2] ?? '{}');
            const namespace = String(values[3] ?? 'root');
            const valueType = String(values[4] ?? 'object');
            const value = JSON.parse(payloadRaw) as unknown;

            const row = {
              path,
              value,
              namespace,
              value_type: valueType,
              data: { [path]: value },
            };
            typedRows.set(`${tenantId}:${path}`, row);
            return [row];
          }

          if (
            text.startsWith('select path, value, namespace, value_type from public.app_settings')
          ) {
            const tenantId = String(values[0] ?? '');
            const path = String(values[1] ?? '');
            const row = typedRows.get(`${tenantId}:${path}`);
            return row ? [row] : [];
          }

          return [];
        },
        withTenantContext: async () => {
          throw new Error('legacy storage should not be used in typed-first settings test');
        },
      };

      const repository = new SettingsRepository(prisma);
      await repository.upsert({
        tenantId: 'tenant-a',
        path: 'settings/path-a',
        payload: { marker: 'A' },
      });
      await repository.upsert({
        tenantId: 'tenant-a',
        path: 'settings/path-b',
        payload: { marker: 'B' },
      });

      const pathARow = await repository.findByPath('tenant-a', 'settings/path-a');
      const pathBRow = await repository.findByPath('tenant-a', 'settings/path-b');

      assert.deepEqual(pathARow?.payload, { marker: 'A' });
      assert.deepEqual(pathBRow?.payload, { marker: 'B' });
      assert.match(
        statements.find((statement) => statement.includes('insert into public.app_settings')) || '',
        /on conflict \(tenant_id, path\)/,
      );
    },
  );
});

test('theme-assets repository upsert targets typed asset columns', async () => {
  await withEnv(
    { BOTMOX_TYPED_STORE_PARITY_GATE: 'false', BOTMOX_THEME_ASSETS_DUAL_WRITE: 'false' },
    async () => {
      const statements: string[] = [];
      const prisma = {
        $queryRaw: async (statement: unknown) => {
          statements.push(sqlText(statement));
          return [
            {
              id: 'asset-1',
              data: {},
              object_key: 'theme-assets/tenant/asset-1.png',
              mime_type: 'image/png',
              size_bytes: 1024,
              width: 1280,
              height: 720,
              status: 'ready',
              image_url: 'https://example.local/a.png',
              image_url_expires_at_ms: 123,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          ];
        },
        withTenantContext: async () => {
          throw new Error('legacy write should not be used in typed-primary mode');
        },
      };

      const repository = new ThemeAssetsRepository(prisma);
      const row = await repository.upsert({
        tenantId: 'tenant-a',
        id: 'asset-1',
        payload: {
          object_key: 'theme-assets/tenant/asset-1.png',
          mime_type: 'image/png',
          size_bytes: 1024,
        },
      });

      assert.match(
        statements[0] || '',
        /insert into public\.theme_background_assets \( .*object_key, .*mime_type, .*size_bytes, .*width, .*height, .*status,/,
      );
      assert.equal(row.payload.object_key, 'theme-assets/tenant/asset-1.png');
      assert.equal(row.payload.mime_type, 'image/png');
      assert.equal(row.payload.size_bytes, 1024);
    },
  );
});
