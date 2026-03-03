import { expect, type Page, type Route, test } from '@playwright/test';

const e2eIdentity = {
  id: 'e2e-user',
  name: 'E2E User',
  email: 'e2e@example.com',
  roles: ['admin'],
  access: {
    access_tier: 'premium',
    write_access: true,
  },
};

type ApiEnvelope = {
  success: true;
  data: unknown;
  meta?: Record<string, unknown>;
};

type ResourceKind = 'licenses' | 'proxies' | 'subscriptions';

type ResourceRecord = {
  id: string;
  created_at: number;
  updated_at: number;
  [key: string]: unknown;
};

function envelope(data: unknown, meta?: Record<string, unknown>): ApiEnvelope {
  if (meta) {
    return { success: true, data, meta };
  }
  return { success: true, data };
}

function toJsonResponse(
  payload: ApiEnvelope,
  status = 200,
): {
  status: number;
  contentType: string;
  body: string;
} {
  return {
    status,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  };
}

function seedAuthStorage(identity: typeof e2eIdentity) {
  localStorage.setItem('botmox.auth.token', 'e2e-token');
  localStorage.setItem('botmox.auth.identity', JSON.stringify(identity));
  localStorage.setItem('botmox.auth.verify_at', String(Date.now()));
}

function createFixture() {
  const now = Date.now();
  const bot = {
    id: 'e2e-bot',
    project_id: 'wow_tbc',
    status: 'banned',
    name: 'E2E Bot',
    last_seen: now - 60_000,
    character: {
      name: 'E2E Thrall',
      class: 'warrior',
      race: 'orc',
      server: 'Gehennas',
      faction: 'horde',
      level: 70,
      gold: 1234,
    },
    account: {
      email: 'e2e-bot@example.com',
      password: 'e2e-pass',
    },
    vm: {
      name: 'vm-e2e-01',
    },
  };

  const resources: Record<ResourceKind, ResourceRecord[]> = {
    licenses: [],
    proxies: [],
    subscriptions: [],
  };

  const vmSettings = {
    proxmox: {
      url: 'https://pve.local:8006',
      username: 'root@pam',
      node: 'h1',
    },
    ssh: {
      host: '127.0.0.1',
      port: 22,
      username: 'root',
      useKeyAuth: true,
      configured: true,
    },
    storage: {
      options: ['data'],
      enabledDisks: ['data'],
      default: 'data',
      autoSelectBest: true,
    },
    format: {
      options: ['raw', 'qcow2'],
      default: 'raw',
    },
    template: {
      vmId: 100,
      name: 'VM 100',
    },
    hardware: {
      cores: 2,
      sockets: 1,
      memory: 4096,
      balloon: 0,
      cpu: 'host',
      onboot: false,
      agent: false,
    },
    projectHardware: {
      wow_tbc: {
        cores: 2,
        memory: 4096,
        diskGiB: 128,
      },
      wow_midnight: {
        cores: 2,
        memory: 4096,
        diskGiB: 256,
      },
    },
    hardwareApply: {
      applyCpu: false,
      applyOnboot: false,
      applyAgent: false,
    },
    services: {
      proxmoxUrl: 'https://pve.local:8006',
      tinyFmUrl: 'http://127.0.0.1:8080/index.php?p=',
      syncThingUrl: 'https://127.0.0.1:8384/',
      tinyFmUsername: '',
      syncThingUsername: '',
    },
    deleteVmFilters: {
      policy: {
        allowBanned: true,
        allowPrepareNoResources: true,
        allowOrphan: true,
      },
      view: {
        showAllowed: true,
        showLocked: true,
        showRunning: true,
        showStopped: true,
      },
    },
  };

  return {
    bots: [bot],
    bot,
    resources,
    vmSettings,
  };
}

async function mountMockApi(page: Page) {
  const fixture = createFixture();
  const vmCommandResults = new Map<string, { commandType: string; result: unknown }>();

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === '/api/v1/auth/whoami') {
      await route.fulfill(
        toJsonResponse(
          envelope({
            uid: e2eIdentity.id,
            email: e2eIdentity.email,
            roles: e2eIdentity.roles,
            access: {
              accessTier: 'premium',
              premiumActive: true,
              writeAccess: true,
            },
          }),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/theme-assets') {
      await route.fulfill(toJsonResponse(envelope({ generated_at_ms: Date.now(), items: [] })));
      return;
    }

    if (pathname === '/api/v1/agents') {
      await route.fulfill(
        toJsonResponse(
          envelope([
            {
              id: 'agent-e2e',
              tenant_id: 'tenant-e2e',
              status: 'active',
              last_seen_at: new Date(Date.now() - 1_000).toISOString(),
            },
          ]),
        ),
      );
      return;
    }

    if (pathname.startsWith('/api/v1/vm-ops/proxmox/')) {
      const action = pathname.split('/').at(-1) || 'unknown';
      let result: unknown = { ok: true };

      if (action === 'status') {
        result = { connected: true, agent_online: true };
      } else if (action === 'ssh-status') {
        result = { configured: true, connected: true, code: 'CONNECTED' };
      } else if (action === 'list-targets') {
        result = [
          {
            id: 'target-e2e',
            label: 'E2E Target',
            url: 'https://pve.local:8006',
            username: 'root@pam',
            node: 'h1',
            isActive: true,
            sshConfigured: true,
          },
        ];
      } else if (action === 'list-vms') {
        result = [
          {
            vmid: 501,
            name: 'vm-e2e-01',
            status: 'stopped',
            node: 'h1',
            template: false,
          },
        ];
      } else if (action === 'cluster-resources') {
        result = [
          {
            id: 'storage-h1-data',
            node: 'h1',
            type: 'storage',
            storage: 'data',
            status: 'available',
            avail: 200 * 1024 * 1024 * 1024,
            total: 500 * 1024 * 1024 * 1024,
          },
        ];
      } else if (action === 'get-config') {
        result = {
          cores: 2,
          memory: 4096,
        };
      }

      const commandType = `proxmox.${action}`;
      const commandId = `cmd-${action}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      vmCommandResults.set(commandId, { commandType, result });
      await route.fulfill(
        toJsonResponse(
          envelope({
            id: commandId,
            status: 'pending',
            command_type: commandType,
            tenant_id: 'tenant-e2e',
            agent_id: 'agent-e2e',
            queued_at: new Date().toISOString(),
            expires_at: new Date(Date.now() + 60_000).toISOString(),
          }),
        ),
      );
      return;
    }

    if (pathname.startsWith('/api/v1/vm-ops/commands/')) {
      const commandId = pathname.split('/').at(-1) || '';
      const resolved = vmCommandResults.get(commandId);
      await route.fulfill(
        toJsonResponse(
          envelope({
            id: commandId,
            status: 'succeeded',
            command_type: resolved?.commandType || 'proxmox.unknown',
            tenant_id: 'tenant-e2e',
            agent_id: 'agent-e2e',
            result: resolved?.result ?? {},
          }),
        ),
      );
      return;
    }

    if (pathname.startsWith('/api/v1/vm-ops/events')) {
      await route.fulfill({ status: 204, body: '' });
      return;
    }

    if (pathname === '/api/v1/settings/projects') {
      await route.fulfill(
        toJsonResponse(
          envelope({
            wow_tbc: {
              name: 'WOW TBC E2E',
            },
          }),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/settings/alerts') {
      await route.fulfill(
        toJsonResponse(
          envelope({
            warning_days: 7,
            enabled: true,
            updated_at: Date.now(),
          }),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/settings/vmgenerator') {
      await route.fulfill(toJsonResponse(envelope(fixture.vmSettings)));
      return;
    }

    if (pathname === '/api/v1/bots') {
      await route.fulfill(toJsonResponse(envelope(fixture.bots, { total: fixture.bots.length })));
      return;
    }

    if (pathname.startsWith('/api/v1/bots/')) {
      await route.fulfill(toJsonResponse(envelope(fixture.bot)));
      return;
    }

    if (pathname.startsWith('/api/v1/resources/')) {
      const parts = pathname.split('/').filter(Boolean);
      const kind = parts[3] as ResourceKind | undefined;
      const id = parts[4];

      if (!kind || !(kind in fixture.resources)) {
        await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
        return;
      }

      const collection = fixture.resources[kind];

      if (method === 'GET' && !id) {
        await route.fulfill(toJsonResponse(envelope(collection, { total: collection.length })));
        return;
      }

      if (method === 'GET' && id) {
        const found = collection.find((item) => item.id === id);
        await route.fulfill(toJsonResponse(envelope(found ?? null), found ? 200 : 404));
        return;
      }

      await route.fulfill(toJsonResponse(envelope({ id: id || 'e2e-item' })));
      return;
    }

    if (pathname.startsWith('/api/v1/workspace/')) {
      if (method === 'GET') {
        await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
        return;
      }
      await route.fulfill(toJsonResponse(envelope({ id: 'e2e-item' })));
      return;
    }

    if (method === 'GET') {
      await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
      return;
    }

    await route.fulfill(toJsonResponse(envelope({ id: 'e2e-item' })));
  });
}

test.describe('fsd boundaries migration focused paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(seedAuthStorage, e2eIdentity);
    await mountMockApi(page);
  });

  test('project page critical render path stays intact', async ({ page }) => {
    await page.goto('/project/wow_tbc');

    await expect(page).toHaveURL(/\/project\/wow_tbc$/);
    await expect(page.getByRole('heading', { name: /WOW TBC E2E/i })).toBeVisible();
    await expect(page.getByText('Accounts summary table')).toBeVisible();
    await expect(page.getByPlaceholder('Search by ID, character, email, server...')).toBeVisible();
    await expect(page.getByRole('columnheader', { name: 'Status' })).toBeVisible();
    await expect(page.getByRole('button', { name: /E2E Thrall/i })).toBeVisible();
  });

  test('vms delete modal opens and renders candidate list', async ({ page }) => {
    await page.goto('/vms');

    await expect(page).toHaveURL(/\/vms$/);
    await expect(page.getByRole('button', { name: 'Delete VM' })).toBeVisible();
    await page.getByRole('button', { name: 'Delete VM' }).click();

    const deleteDialog = page.getByRole('dialog', { name: /Delete Existing VMs/i });
    await expect(deleteDialog).toBeVisible();
    await expect(deleteDialog.getByText('VM candidates')).toBeVisible();
    const candidateRow = deleteDialog.locator('.vm-delete-vm-modal-item', {
      hasText: 'VM 501 - vm-e2e-01',
    });
    await expect(candidateRow).toBeVisible();
    await expect(candidateRow).toContainText('Rule: VM deletion decision unavailable from backend');
  });

  test('bot profile sections render on migration-affected route', async ({ page }) => {
    await page.goto('/bot/e2e-bot');

    await expect(page).toHaveURL(/\/bot\/e2e-bot$/);
    const botTabs = page.getByRole('radiogroup');
    await expect(botTabs).toBeVisible();
    await expect(botTabs.getByText('Summary', { exact: true })).toBeVisible();
    await expect(botTabs.getByText('Configure', { exact: true })).toBeVisible();
    await expect(botTabs.getByText('Resources', { exact: true })).toBeVisible();

    await botTabs.getByText('Configure', { exact: true }).click();
    await expect(page.getByText('Person', { exact: true })).toBeVisible();
    await expect(page.getByText('Account', { exact: true })).toBeVisible();
    await expect(page.getByText('Character', { exact: true })).toBeVisible();
    await expect(page.getByText('Schedule', { exact: true })).toBeVisible();

    await botTabs.getByText('Resources', { exact: true }).click();
    await expect(page.getByText('No subscription for this bot')).toBeVisible();
  });
});
