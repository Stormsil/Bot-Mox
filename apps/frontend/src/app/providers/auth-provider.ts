import type { AuthProvider } from '@refinedev/core';
import { ApiClientError, apiRequest } from '../../shared/api/apiClient';

const AUTH_IDENTITY_KEY = 'botmox.auth.identity';

interface StoredIdentity {
  id: string;
  name: string;
  email: string;
  roles?: string[];
  access?: {
    tenant_type?: 'user';
    access_tier?: 'free' | 'trial' | 'premium' | 'admin';
    premium_active?: boolean;
    write_access?: boolean;
    lifetime_premium?: boolean;
    trial_used?: boolean;
    trial_ends_at?: string | null;
    premium_until?: string | null;
  };
}

function saveIdentity(identity: StoredIdentity): void {
  localStorage.setItem(AUTH_IDENTITY_KEY, JSON.stringify(identity));
}

function clearSession(): void {
  localStorage.removeItem(AUTH_IDENTITY_KEY);
}

function readIdentity(): StoredIdentity | null {
  const raw = localStorage.getItem(AUTH_IDENTITY_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredIdentity;
  } catch {
    return null;
  }
}

function mapWhoamiToIdentity(data: {
  uid?: unknown;
  email?: unknown;
  roles?: unknown;
  access?: {
    tenantType?: unknown;
    accessTier?: unknown;
    premiumActive?: unknown;
    writeAccess?: unknown;
    lifetimePremium?: unknown;
    trialUsed?: unknown;
    trialEndsAt?: unknown;
    premiumUntil?: unknown;
  };
}): StoredIdentity {
  return {
    id: String(data.uid || 'unknown'),
    name: String(data.email || data.uid || 'User'),
    email: String(data.email || ''),
    roles: Array.isArray(data.roles) ? data.roles : [],
    access:
      data.access && typeof data.access === 'object'
        ? {
            tenant_type: 'user' as const,
            access_tier: String(data.access.accessTier || '')
              .trim()
              .toLowerCase() as 'free' | 'trial' | 'premium' | 'admin',
            premium_active: Boolean(data.access.premiumActive),
            write_access: Boolean(data.access.writeAccess),
            lifetime_premium: Boolean(data.access.lifetimePremium),
            trial_used: Boolean(data.access.trialUsed),
            trial_ends_at: String(data.access.trialEndsAt || '').trim() || null,
            premium_until: String(data.access.premiumUntil || '').trim() || null,
          }
        : undefined,
  };
}

async function fetchWhoamiIdentity(): Promise<StoredIdentity | null> {
  try {
    const payload = await apiRequest<{
      uid?: unknown;
      email?: unknown;
      roles?: unknown;
      access?: {
        tenantType?: unknown;
        accessTier?: unknown;
        premiumActive?: unknown;
        writeAccess?: unknown;
        lifetimePremium?: unknown;
        trialUsed?: unknown;
        trialEndsAt?: unknown;
        premiumUntil?: unknown;
      };
    }>('/api/v1/auth/whoami', {
      method: 'GET',
    });

    return mapWhoamiToIdentity(payload.data || {});
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 401) {
      return null;
    }
    throw error;
  }
}

export const authProvider: AuthProvider = {
  login: async ({
    email,
    password,
    mode,
  }: {
    email: string;
    password: string;
    mode?: 'signin' | 'signup';
  }) => {
    if (!email || !password) {
      return {
        success: false,
        error: {
          name: 'LoginError',
          message: 'Email and password are required',
        },
      };
    }

    try {
      const route = mode === 'signup' ? '/api/v1/auth/signup' : '/api/v1/auth/signin';
      const response = await apiRequest<{
        uid?: unknown;
        email?: unknown;
        access?: unknown;
      }>(route, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...(mode === 'signup' ? { email } : { login: email }),
          password,
        }),
      });
      if (!response.success) {
        return {
          success: false,
          error: {
            name: 'LoginError',
            message: 'Authentication failed',
          },
        };
      }

      const identity = await fetchWhoamiIdentity();
      if (!identity) {
        clearSession();
        return {
          success: false,
          error: {
            name: 'LoginError',
            message: 'Authentication session was not established',
          },
        };
      }

      saveIdentity(identity);

      return {
        success: true,
        redirectTo: '/',
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Invalid email or password';
      return {
        success: false,
        error: {
          name: 'LoginError',
          message,
        },
      };
    }
  },

  logout: async () => {
    try {
      await apiRequest<null>('/api/v1/auth/logout', {
        method: 'POST',
      });
    } catch {
      // Local state is still cleared even if server session is already invalid.
    }

    clearSession();

    return {
      success: true,
      redirectTo: '/login',
    };
  },

  check: async () => {
    try {
      const identity = await fetchWhoamiIdentity();
      if (identity) {
        saveIdentity(identity);
        return {
          authenticated: true,
        };
      }

      clearSession();
      return {
        authenticated: false,
        redirectTo: '/login',
        logout: true,
      };
    } catch (error) {
      if (error instanceof ApiClientError && error.status === 401) {
        clearSession();
        return {
          authenticated: false,
          redirectTo: '/login',
          logout: true,
        };
      }

      return {
        authenticated: false,
      };
    }
  },

  getPermissions: async () => {
    const identity = readIdentity();
    return identity?.roles || [];
  },

  getIdentity: async () => {
    const identity = readIdentity();
    if (!identity) return null;

    return {
      id: identity.id,
      name: identity.name,
      email: identity.email,
      roles: identity.roles || [],
      ...(identity.access ? { access: identity.access } : {}),
    };
  },

  onError: async (error) => {
    if (error?.statusCode === 403) {
      const code = String(error?.code || '');
      if (code === 'PREMIUM_REQUIRED') {
        return {
          redirectTo: '/billing',
          error,
        };
      }
    }
    if (error?.statusCode === 401 || error?.statusCode === 403) {
      clearSession();
      return {
        logout: true,
        redirectTo: '/login',
        error,
      };
    }

    return { error };
  },
};
