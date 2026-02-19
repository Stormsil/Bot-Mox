import type { AuthProvider } from '@refinedev/core';
import { apiRequest } from '../services/apiClient';
import { hasSupabaseAuth, supabase } from '../utils/supabase';

const AUTH_TOKEN_KEY = 'botmox.auth.token';
const AUTH_IDENTITY_KEY = 'botmox.auth.identity';
const AUTH_VERIFY_TS_KEY = 'botmox.auth.verify_at';
const VERIFY_TTL_MS = 5 * 60 * 1000;
const verifyInFlightByToken = new Map<string, Promise<StoredIdentity | null>>();

interface StoredIdentity {
  id: string;
  name: string;
  email: string;
  roles?: string[];
}

function saveSession(token: string, identity: StoredIdentity): void {
  localStorage.setItem(AUTH_TOKEN_KEY, token);
  localStorage.setItem(AUTH_IDENTITY_KEY, JSON.stringify(identity));
  localStorage.setItem(AUTH_VERIFY_TS_KEY, String(Date.now()));
}

function clearSession(): void {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  localStorage.removeItem(AUTH_IDENTITY_KEY);
  localStorage.removeItem(AUTH_VERIFY_TS_KEY);
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

async function verifyTokenWithBackend(token: string): Promise<StoredIdentity | null> {
  const normalizedToken = String(token || '').trim();
  if (!normalizedToken) {
    return null;
  }

  const pending = verifyInFlightByToken.get(normalizedToken);
  if (pending) {
    return pending;
  }

  const request = (async () => {
    try {
      const payload = await apiRequest<{
        uid?: unknown;
        email?: unknown;
        roles?: unknown;
      }>('/api/v1/auth/whoami', {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${normalizedToken}`,
        },
      });

      const data = payload.data || {};
      return {
        id: String(data.uid || 'unknown'),
        name: String(data.email || data.uid || 'User'),
        email: String(data.email || ''),
        roles: Array.isArray(data.roles) ? data.roles : [],
      };
    } catch {
      return null;
    }
  })();

  verifyInFlightByToken.set(normalizedToken, request);

  try {
    return await request;
  } finally {
    verifyInFlightByToken.delete(normalizedToken);
  }
}

async function ensureSessionValid(): Promise<boolean> {
  const token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (!token) return false;

  const lastVerify = Number(localStorage.getItem(AUTH_VERIFY_TS_KEY) || 0);
  const stillFresh = Number.isFinite(lastVerify) && Date.now() - lastVerify < VERIFY_TTL_MS;
  if (stillFresh) return true;

  const identity = await verifyTokenWithBackend(token);
  if (!identity) {
    clearSession();
    return false;
  }

  saveSession(token, identity);
  return true;
}

async function ensureSupabaseSessionValid(): Promise<boolean> {
  if (!hasSupabaseAuth || !supabase) {
    return false;
  }

  const sessionResult = await supabase.auth.getSession().catch(() => null);
  const session = sessionResult?.data?.session || null;

  if (!session?.access_token) {
    return false;
  }

  const cachedToken = String(localStorage.getItem(AUTH_TOKEN_KEY) || '');
  const lastVerify = Number(localStorage.getItem(AUTH_VERIFY_TS_KEY) || 0);
  const stillFresh = Number.isFinite(lastVerify) && Date.now() - lastVerify < VERIFY_TTL_MS;
  if (stillFresh && cachedToken && cachedToken === session.access_token && readIdentity()) {
    return true;
  }

  const verified = await verifyTokenWithBackend(session.access_token);
  if (verified) {
    saveSession(session.access_token, verified);
    return true;
  }

  const refreshed = await supabase.auth.refreshSession().catch(() => null);
  const refreshedSession = refreshed?.data?.session || null;
  if (!refreshedSession?.access_token) {
    return false;
  }

  const verifiedAfterRefresh = await verifyTokenWithBackend(refreshedSession.access_token);
  if (!verifiedAfterRefresh) {
    return false;
  }

  saveSession(refreshedSession.access_token, verifiedAfterRefresh);
  return true;
}

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    if (!email || !password) {
      return {
        success: false,
        error: {
          name: 'LoginError',
          message: 'Email and password are required',
        },
      };
    }

    if (!hasSupabaseAuth || !supabase) {
      return {
        success: false,
        error: {
          name: 'SupabaseNotConfigured',
          message:
            'Supabase Auth is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
        },
      };
    }

    try {
      const result = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (result.error) {
        return {
          success: false,
          error: {
            name: 'LoginError',
            message: result.error.message || 'Invalid email or password',
          },
        };
      }

      const token = result.data.session?.access_token || '';
      if (!token) {
        return {
          success: false,
          error: {
            name: 'LoginError',
            message: 'Supabase did not return access token',
          },
        };
      }

      const verifiedIdentity = await verifyTokenWithBackend(token);

      if (!verifiedIdentity) {
        try {
          await supabase.auth.signOut();
        } catch {
          // ignore
        }
        return {
          success: false,
          error: {
            name: 'TokenVerificationFailed',
            message: 'Backend rejected Supabase token',
          },
        };
      }

      saveSession(token, verifiedIdentity);

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
    clearSession();

    if (supabase) {
      try {
        await supabase.auth.signOut();
      } catch {
        // Supabase session may already be invalid.
      }
    }

    return {
      success: true,
      redirectTo: '/login',
    };
  },

  check: async () => {
    const isValid = (await ensureSupabaseSessionValid()) || (await ensureSessionValid());

    if (isValid) {
      return {
        authenticated: true,
      };
    }

    return {
      authenticated: false,
      redirectTo: '/login',
      logout: true,
    };
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
    };
  },

  onError: async (error) => {
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
