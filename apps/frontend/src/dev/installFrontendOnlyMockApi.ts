type ApiEnvelope = {
  success: true;
  data: unknown;
  meta?: Record<string, unknown>;
};

function envelope(data: unknown, meta?: Record<string, unknown>): ApiEnvelope {
  if (meta) {
    return { success: true, data, meta };
  }

  return { success: true, data };
}

function jsonResponse(
  data: unknown,
  init?: { meta?: Record<string, unknown>; status?: number },
): Response {
  const payload = envelope(data, init?.meta);
  return new Response(JSON.stringify(payload), {
    status: init?.status ?? 200,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function resolvePathname(input: RequestInfo | URL): string | null {
  const raw =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input instanceof Request
          ? input.url
          : String(input);

  try {
    return new URL(raw, window.location.origin).pathname;
  } catch {
    return null;
  }
}

function isApiRequest(pathname: string | null): pathname is string {
  return Boolean(pathname?.startsWith('/api/v1/'));
}

function readMethod(input: RequestInfo | URL, init?: RequestInit): string {
  const method = init?.method || (input instanceof Request ? input.method : undefined) || 'GET';
  return String(method).trim().toUpperCase();
}

function installSession(): void {
  localStorage.setItem(
    'botmox.auth.identity',
    JSON.stringify({
      id: 'frontend-only-user',
      name: 'Frontend Only',
      email: 'frontend-only@local.dev',
      roles: ['admin'],
      access: {
        tenant_type: 'user',
        access_tier: 'admin',
        premium_active: true,
        write_access: true,
        lifetime_premium: true,
        trial_used: true,
        trial_ends_at: null,
        premium_until: null,
      },
    }),
  );
}

function buildMockResponse(pathname: string, method: string): Response | null {
  if (pathname === '/api/v1/auth/whoami') {
    return jsonResponse({
      uid: 'frontend-only-user',
      email: 'frontend-only@local.dev',
      roles: ['admin'],
      access: {
        tenantType: 'user',
        accessTier: 'admin',
        premiumActive: true,
        writeAccess: true,
        lifetimePremium: true,
        trialUsed: true,
        trialEndsAt: null,
        premiumUntil: null,
      },
    });
  }

  if (pathname === '/api/v1/auth/signin' || pathname === '/api/v1/auth/signup') {
    return jsonResponse({
      uid: 'frontend-only-user',
      email: 'frontend-only@local.dev',
      access: { accessTier: 'admin', writeAccess: true },
    });
  }

  if (pathname === '/api/v1/auth/logout') {
    return jsonResponse(null);
  }

  if (pathname === '/api/v1/resources/status-aggregate') {
    return jsonResponse({
      summary: {
        licenses: { total: 0, active: 0, expiring_soon: 0, expired: 0, unassigned: 0 },
        proxies: { total: 0, active: 0, expiring_soon: 0, expired: 0, unassigned: 0 },
        subscriptions: { total: 0, active: 0, expiring_soon: 0, expired: 0 },
      },
      expiring_items: [],
    });
  }

  if (pathname === '/api/v1/finance/summary') {
    return jsonResponse({ income_total: 0, expense_total: 0, net_total: 0 });
  }

  if (pathname === '/api/v1/finance/breakdown') {
    return jsonResponse({ items: [] });
  }

  if (pathname === '/api/v1/finance/time-series') {
    return jsonResponse({ points: [] });
  }

  if (
    pathname === '/api/v1/finance/daily-stats' ||
    pathname === '/api/v1/finance/gold-price-history'
  ) {
    return jsonResponse([]);
  }

  if (pathname === '/api/v1/finance/operations') {
    if (method === 'GET') {
      return jsonResponse([], { meta: { total: 0 } });
    }
    return jsonResponse({ id: 'frontend-only-finance-item' });
  }

  if (pathname.startsWith('/api/v1/resources/')) {
    if (method === 'GET') {
      const segments = pathname.split('/').filter(Boolean);
      const isCollection = segments.length === 4;
      if (isCollection) {
        return jsonResponse([], { meta: { total: 0 } });
      }
    }
    return jsonResponse({ id: 'frontend-only-resource-item' });
  }

  if (pathname === '/api/v1/bots') {
    if (method === 'GET') {
      return jsonResponse([], { meta: { total: 0 } });
    }
    return jsonResponse({ id: 'frontend-only-bot' });
  }

  if (pathname.startsWith('/api/v1/bots/')) {
    return jsonResponse({
      id: 'frontend-only-bot',
      project_id: 'wow_tbc',
      status: 'offline',
      character: { name: 'Frontend Only Bot' },
    });
  }

  if (pathname.startsWith('/api/v1/workspace/')) {
    const isListLike = method === 'GET' && !pathname.split('/').pop()?.includes('-');
    if (isListLike) {
      return jsonResponse([], { meta: { total: 0 } });
    }
    return jsonResponse({ id: 'frontend-only-workspace-item' });
  }

  if (pathname === '/api/v1/theme-assets') {
    return jsonResponse({ generated_at_ms: Date.now(), items: [] });
  }

  if (pathname.startsWith('/api/v1/settings/')) {
    return jsonResponse({});
  }

  if (pathname.startsWith('/api/v1/vm-ops/') || pathname.startsWith('/api/v1/vms/')) {
    return jsonResponse({});
  }

  if (method === 'GET') {
    return jsonResponse([]);
  }

  return jsonResponse({ id: 'frontend-only-item' });
}

export function installFrontendOnlyMockApi(): void {
  const originalFetch = window.fetch.bind(window);

  installSession();

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const pathname = resolvePathname(input);
    if (!isApiRequest(pathname)) {
      return originalFetch(input, init);
    }

    const method = readMethod(input, init);
    const mockResponse = buildMockResponse(pathname, method);
    if (mockResponse) {
      return mockResponse;
    }

    return originalFetch(input, init);
  };
}
