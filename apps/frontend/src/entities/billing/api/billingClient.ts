import { buildApiUrl } from '../../../config/env';

export interface BillingWhoamiAccess {
  accessTier?: unknown;
  premiumActive?: unknown;
  writeAccess?: unknown;
  lifetimePremium?: unknown;
  trialUsed?: unknown;
  trialEndsAt?: unknown;
  premiumUntil?: unknown;
}

export interface BillingWhoamiResponse {
  uid?: unknown;
  email?: unknown;
  roles?: unknown;
  access?: BillingWhoamiAccess;
}

interface ApiEnvelope<T> {
  success: boolean;
  data?: T;
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
}

export class BillingApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, input: { status: number; code: string; details?: unknown }) {
    super(message);
    this.name = 'BillingApiError';
    this.status = input.status;
    this.code = input.code;
    this.details = input.details;
  }
}

async function requestBilling<T>(path: string, init: RequestInit): Promise<T> {
  const headers = new Headers(init.headers || {});
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }

  const response = await fetch(buildApiUrl(path), {
    ...init,
    credentials: init.credentials ?? 'include',
    headers,
  });

  const text = await response.text();
  const payload = text
    ? (JSON.parse(text) as ApiEnvelope<T>)
    : ({ success: false } as ApiEnvelope<T>);
  if (!response.ok || payload.success !== true) {
    throw new BillingApiError(
      String(payload.error?.message || `Request failed (${response.status})`),
      {
        status: response.status,
        code: String(payload.error?.code || 'BILLING_REQUEST_FAILED'),
        details: payload.error?.details,
      },
    );
  }
  return payload.data as T;
}

export const fetchBillingWhoami = () =>
  requestBilling<BillingWhoamiResponse>('/api/v1/auth/whoami', { method: 'GET' });

export const activateBillingMock = (days: number) =>
  requestBilling<unknown>('/api/v1/billing/mock/activate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ days }),
  });

export const startBillingTrial = () =>
  requestBilling<unknown>('/api/v1/billing/trial/start', {
    method: 'POST',
  });
