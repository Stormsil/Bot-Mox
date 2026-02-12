import type { AuthProvider } from '@refinedev/core';
import { signInWithEmailAndPassword, signOut } from 'firebase/auth';
import { buildApiUrl } from '../config/env';
import { auth, hasFirebaseAuth } from '../utils/firebase';

const AUTH_TOKEN_KEY = 'botmox.auth.token';
const AUTH_IDENTITY_KEY = 'botmox.auth.identity';
const AUTH_VERIFY_TS_KEY = 'botmox.auth.verify_at';
const VERIFY_TTL_MS = 5 * 60 * 1000;
const DEV_DEFAULT_INTERNAL_API_TOKEN = 'change-me-api-token';
const DEV_AUTH_BYPASS_ENABLED =
  import.meta.env.DEV &&
  String(import.meta.env.VITE_DEV_BYPASS_AUTH || 'true').trim().toLowerCase() !== 'false';
const DEV_IDENTITY: StoredIdentity = {
  id: 'dev-user',
  name: 'Dev User',
  email: 'dev@localhost',
  roles: ['admin', 'infra'],
};
let hasLoggedDevBypassWarning = false;

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

function ensureDevBypassSession(): void {
  const internalToken = String(import.meta.env.VITE_INTERNAL_API_TOKEN || '').trim();
  const token = internalToken || DEV_DEFAULT_INTERNAL_API_TOKEN;
  saveSession(token, DEV_IDENTITY);

  if (!internalToken && !hasLoggedDevBypassWarning) {
    hasLoggedDevBypassWarning = true;
    console.warn(
      `[Auth] VITE_DEV_BYPASS_AUTH enabled without VITE_INTERNAL_API_TOKEN. Using fallback token '${DEV_DEFAULT_INTERNAL_API_TOKEN}' for local dev.`
    );
  }
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
  const response = await fetch(buildApiUrl('/api/v1/auth/verify'), {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  const payload = await response.json().catch(() => null);

  if (!response.ok || !payload?.success) {
    return null;
  }

  const data = payload.data || {};
  return {
    id: String(data.uid || 'unknown'),
    name: String(data.email || data.uid || 'User'),
    email: String(data.email || ''),
    roles: Array.isArray(data.roles) ? data.roles : [],
  };
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

export const authProvider: AuthProvider = {
  login: async ({ email, password }) => {
    if (DEV_AUTH_BYPASS_ENABLED) {
      ensureDevBypassSession();
      return {
        success: true,
        redirectTo: '/',
      };
    }

    const internalToken = String(import.meta.env.VITE_INTERNAL_API_TOKEN || '').trim();

    if (internalToken && email && password) {
      const verified = await verifyTokenWithBackend(internalToken);
      if (!verified) {
        return {
          success: false,
          error: {
            name: 'InternalTokenVerificationFailed',
            message: 'Unable to verify internal API token against backend',
          },
        };
      }

      saveSession(internalToken, verified);
      return {
        success: true,
        redirectTo: '/',
      };
    }

    if (!email || !password) {
      return {
        success: false,
        error: {
          name: 'LoginError',
          message: 'Email and password are required',
        },
      };
    }

    if (!hasFirebaseAuth || !auth) {
      return {
        success: false,
        error: {
          name: 'FirebaseNotConfigured',
          message:
            'Firebase Auth is not configured. Set VITE_FIREBASE_* in bot-mox/.env or use VITE_INTERNAL_API_TOKEN for internal mode.',
        },
      };
    }

    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const token = await credential.user.getIdToken();
      const verifiedIdentity = await verifyTokenWithBackend(token);

      if (!verifiedIdentity) {
        await signOut(auth);
        return {
          success: false,
          error: {
            name: 'TokenVerificationFailed',
            message: 'Backend rejected Firebase token',
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
    if (DEV_AUTH_BYPASS_ENABLED) {
      clearSession();
      return {
        success: true,
        redirectTo: '/',
      };
    }

    clearSession();
    if (auth) {
      try {
        await signOut(auth);
      } catch {
        // Firebase session may already be invalid.
      }
    }

    return {
      success: true,
      redirectTo: '/login',
    };
  },

  check: async () => {
    if (DEV_AUTH_BYPASS_ENABLED) {
      ensureDevBypassSession();
      return {
        authenticated: true,
      };
    }

    const isValid = await ensureSessionValid();

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
    if (DEV_AUTH_BYPASS_ENABLED) {
      return DEV_IDENTITY.roles || [];
    }

    const identity = readIdentity();
    return identity?.roles || [];
  },

  getIdentity: async () => {
    if (DEV_AUTH_BYPASS_ENABLED) {
      return {
        id: DEV_IDENTITY.id,
        name: DEV_IDENTITY.name,
        email: DEV_IDENTITY.email,
        roles: DEV_IDENTITY.roles || [],
      };
    }

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
    if (DEV_AUTH_BYPASS_ENABLED) {
      return { error };
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
