import type { Page, Route } from '@playwright/test';

type ApiEnvelope = {
  success: true;
  data: unknown;
  meta?: Record<string, unknown>;
};

export type MockIdentity = {
  id: string;
  email: string;
  roles: string[];
};

export type AppMockRouteContext = {
  route: Route;
  request: Route['request'] extends () => infer T ? T : never;
  method: string;
  url: URL;
  pathname: string;
  fulfillJson: (data: unknown, meta?: Record<string, unknown>, status?: number) => Promise<void>;
};

export type AppMockRouteOverride = (context: AppMockRouteContext) => Promise<boolean> | boolean;

export type SetupAppMocksOptions = {
  identity: MockIdentity;
  whoamiData?: Record<string, unknown>;
  overrides?: AppMockRouteOverride[];
  fallbackItemId?: string;
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

export async function setupAppMocks(page: Page, options: SetupAppMocksOptions): Promise<void> {
  const { identity, whoamiData, overrides = [], fallbackItemId = 'e2e-item' } = options;

  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const method = request.method();
    const url = new URL(request.url());
    const pathname = url.pathname;

    const context: AppMockRouteContext = {
      route,
      request,
      method,
      url,
      pathname,
      fulfillJson: async (data: unknown, meta?: Record<string, unknown>, status = 200) => {
        await route.fulfill(toJsonResponse(envelope(data, meta), status));
      },
    };

    for (const override of overrides) {
      const handled = await override(context);
      if (handled) {
        return;
      }
    }

    if (pathname === '/api/v1/auth/whoami') {
      await context.fulfillJson({
        uid: identity.id,
        email: identity.email,
        roles: identity.roles,
        ...whoamiData,
      });
      return;
    }

    if (pathname.startsWith('/api/v1/resources/')) {
      await context.fulfillJson([], { total: 0 });
      return;
    }

    if (pathname === '/api/v1/bots') {
      await context.fulfillJson([], { total: 0 });
      return;
    }

    if (pathname.startsWith('/api/v1/bots/')) {
      await context.fulfillJson({
        id: 'e2e-bot',
        project_id: 'wow_tbc',
        status: 'offline',
        character: { name: 'E2E Bot' },
      });
      return;
    }

    if (pathname.startsWith('/api/v1/workspace/')) {
      const isListLike = method === 'GET' && !pathname.split('/').pop()?.includes('-');
      if (isListLike) {
        await context.fulfillJson([], { total: 0 });
        return;
      }

      await context.fulfillJson({ id: fallbackItemId });
      return;
    }

    if (pathname === '/api/v1/finance/operations') {
      await context.fulfillJson([], { total: 0 });
      return;
    }

    if (
      pathname === '/api/v1/finance/daily-stats' ||
      pathname === '/api/v1/finance/gold-price-history'
    ) {
      await context.fulfillJson([]);
      return;
    }

    if (pathname === '/api/v1/theme-assets') {
      await context.fulfillJson({ generated_at_ms: Date.now(), items: [] });
      return;
    }

    if (pathname.startsWith('/api/v1/settings/')) {
      await context.fulfillJson({});
      return;
    }

    if (method === 'GET') {
      await context.fulfillJson([]);
      return;
    }

    await context.fulfillJson({ id: fallbackItemId });
  });
}
