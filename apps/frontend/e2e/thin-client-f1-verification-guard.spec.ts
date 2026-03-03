import { expect, type Page, type Route, test } from '@playwright/test';

const FIXED_NOW = 1_735_689_600_000;

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

type RequestCounters = {
  financeSummary: number;
  financeOperations: number;
};

function envelope(data: unknown, meta?: Record<string, unknown>): ApiEnvelope {
  if (meta) {
    return { success: true, data, meta };
  }
  return { success: true, data };
}

function toJsonResponse(payload: ApiEnvelope): {
  status: number;
  contentType: string;
  body: string;
} {
  return {
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  };
}

function seedAuthStorage(identity: typeof e2eIdentity) {
  localStorage.setItem('botmox.auth.token', 'e2e-token');
  localStorage.setItem('botmox.auth.identity', JSON.stringify(identity));
  localStorage.setItem('botmox.auth.verify_at', String(FIXED_NOW));
}

async function mountF1GuardApi(page: Page): Promise<RequestCounters> {
  const counters: RequestCounters = {
    financeSummary: 0,
    financeOperations: 0,
  };

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
      await route.fulfill(toJsonResponse(envelope({ generated_at_ms: FIXED_NOW, items: [] })));
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
              last_seen_at: new Date(FIXED_NOW).toISOString(),
            },
          ]),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/settings/projects') {
      await route.fulfill(
        toJsonResponse(
          envelope({
            wow_tbc: { name: 'WOW TBC E2E' },
            wow_midnight: { name: 'WOW MIDNIGHT E2E' },
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
            updated_at: FIXED_NOW,
          }),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/bots') {
      await route.fulfill(
        toJsonResponse(
          envelope(
            [
              {
                id: 'bot-e2e',
                name: 'Bot E2E',
                status: 'active',
                character: { name: 'Thrall' },
                vm: { name: 'vm-e2e-01' },
                created_at: FIXED_NOW,
                updated_at: FIXED_NOW,
              },
            ],
            { total: 1 },
          ),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/resources/licenses') {
      await route.fulfill(
        toJsonResponse(
          envelope(
            [
              {
                id: 'lic-e2e',
                key: 'LIC-E2E-001',
                type: 'sin',
                status: 'active',
                computed_status: 'active',
                days_remaining: 20,
                is_expiring_soon: false,
                bot_ids: ['bot-e2e'],
                expires_at: FIXED_NOW + 20 * 24 * 60 * 60 * 1000,
                created_at: FIXED_NOW,
                updated_at: FIXED_NOW,
              },
            ],
            { total: 1 },
          ),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/resources/proxies') {
      await route.fulfill(
        toJsonResponse(
          envelope(
            [
              {
                id: 'proxy-e2e',
                ip: '10.11.12.13',
                port: 8080,
                login: 'login',
                password: 'password',
                provider: 'e2e-provider',
                country: 'US',
                type: 'http',
                status: 'banned',
                computed_status: 'banned',
                days_remaining: 10,
                is_expiring_soon: false,
                bot_id: 'bot-e2e',
                fraud_score: 97,
                vpn: false,
                proxy: true,
                tor: false,
                expires_at: FIXED_NOW + 10 * 24 * 60 * 60 * 1000,
                created_at: FIXED_NOW,
                updated_at: FIXED_NOW,
              },
            ],
            { total: 1 },
          ),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/resources/subscriptions') {
      await route.fulfill(
        toJsonResponse(
          envelope(
            [
              {
                id: 'sub-e2e',
                type: 'wow',
                status: 'active',
                computed_status: 'expiring_soon',
                days_remaining: 3,
                is_expiring_soon: true,
                bot_id: 'bot-e2e',
                expires_at: FIXED_NOW + 3 * 24 * 60 * 60 * 1000,
                created_at: FIXED_NOW,
                updated_at: FIXED_NOW,
              },
            ],
            { total: 1 },
          ),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/finance/operations') {
      counters.financeOperations += 1;
      await route.fulfill(
        toJsonResponse(
          envelope(
            [
              {
                id: 'op-e2e-1',
                date: FIXED_NOW,
                type: 'income',
                category: 'sale',
                amount: 99.5,
                description: 'e2e operation',
                project_id: 'wow_tbc',
                gold_amount: 1000,
                created_at: FIXED_NOW,
                updated_at: FIXED_NOW,
              },
            ],
            { total: 1 },
          ),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/finance/summary') {
      counters.financeSummary += 1;
      await route.fulfill(
        toJsonResponse(
          envelope({
            total_income: 500,
            total_expense: 100,
            net_profit: 400,
            operation_count: 1,
          }),
        ),
      );
      return;
    }

    if (pathname === '/api/v1/finance/breakdown') {
      await route.fulfill(toJsonResponse(envelope({ income: [], expense: [] })));
      return;
    }

    if (pathname === '/api/v1/finance/time-series') {
      await route.fulfill(toJsonResponse(envelope([])));
      return;
    }

    if (pathname === '/api/v1/finance/project-performance') {
      await route.fulfill(toJsonResponse(envelope({ items: [] })));
      return;
    }

    if (pathname === '/api/v1/finance/gold-price-history') {
      await route.fulfill(toJsonResponse(envelope([])));
      return;
    }

    if (pathname === '/api/v1/finance/daily-stats') {
      await route.fulfill(toJsonResponse(envelope([])));
      return;
    }

    if (method === 'GET') {
      await route.fulfill(toJsonResponse(envelope([], { total: 0 })));
      return;
    }

    await route.fulfill(toJsonResponse(envelope({ id: 'e2e-item' })));
  });

  return counters;
}

test('thin-client guard: finance summary isolates operations network calls by tab', async ({
  page,
}) => {
  await page.addInitScript(seedAuthStorage, e2eIdentity);
  const counters = await mountF1GuardApi(page);

  await page.goto('/finance');
  await expect(page).toHaveURL(/\/finance$/);
  await expect(page.getByText('Operational cashflow and performance')).toBeVisible();

  await expect
    .poll(() => counters.financeSummary, {
      message: 'Summary tab must fetch /api/v1/finance/summary',
    })
    .toBeGreaterThan(0);

  expect(counters.financeOperations, 'Summary tab must not fetch /api/v1/finance/operations').toBe(
    0,
  );

  await page.locator('.ant-segmented-item', { hasText: 'Transactions' }).click();
  await expect(page.getByRole('button', { name: 'Add Transaction' })).toBeVisible();

  await expect
    .poll(() => counters.financeOperations, {
      message: 'Transactions tab must fetch /api/v1/finance/operations',
    })
    .toBeGreaterThan(0);
});

test('thin-client guard: backend status fields render status badges on resources pages', async ({
  page,
}) => {
  await page.addInitScript(seedAuthStorage, e2eIdentity);
  await mountF1GuardApi(page);

  await page.goto('/licenses');
  await expect(page).toHaveURL(/\/licenses$/);
  await expect(page.locator('tr', { hasText: 'LIC-E2E-001' }).getByText('ACTIVE')).toBeVisible();

  await page.goto('/proxies');
  await expect(page).toHaveURL(/\/proxies$/);
  await expect(
    page.locator('tr', { hasText: '10.11.12.13:8080' }).getByText('BANNED'),
  ).toBeVisible();

  await page.goto('/subscriptions');
  await expect(page).toHaveURL(/\/subscriptions$/);
  await expect(
    page.locator('tr', { hasText: 'bot-e2e' }).getByText('EXPIRING SOON (3 DAYS)', { exact: true }),
  ).toBeVisible();
});
