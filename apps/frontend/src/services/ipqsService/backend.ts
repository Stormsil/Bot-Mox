import { API_BASE_URL as API_BASE_URL_FROM_ENV } from '../../config/env';
import { uiLogger } from '../../observability/uiLogger';
import {
  checkIpqsViaContract,
  getIpqsStatusViaContract,
} from '../../providers/ipqs-contract-client';
import type { IPQSResponse } from '../../types';
import { ApiClientError } from '../apiClient';

export const LOCAL_PROXY_URL = API_BASE_URL_FROM_ENV;

interface BackendStatusPayload {
  enabled?: unknown;
  configured?: unknown;
  supabaseSettingsConnected?: unknown;
}

export interface BackendStatus {
  enabled: boolean;
  configured: boolean;
  supabaseSettingsConnected: boolean;
}

function normalizeBackendStatus(payload: BackendStatusPayload): BackendStatus {
  return {
    enabled: Boolean(payload.enabled),
    configured: Boolean(payload.configured),
    supabaseSettingsConnected: Boolean(payload.supabaseSettingsConnected),
  };
}

function toErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return `${error.code}: ${error.message}`;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export async function getStatusFromBackend(): Promise<BackendStatus | null> {
  try {
    const response = await getIpqsStatusViaContract();
    return normalizeBackendStatus(response.data || {});
  } catch (error) {
    uiLogger.warn('Failed to fetch IPQS status from backend:', toErrorMessage(error));
    return null;
  }
}

export async function isLocalProxyAvailable(): Promise<boolean> {
  const status = await getStatusFromBackend();
  return Boolean(status);
}

async function checkIPQualityViaBackend(ip: string): Promise<IPQSResponse | null> {
  const normalizedIp = String(ip || '').trim();
  if (!normalizedIp) {
    return null;
  }

  try {
    const response = await checkIpqsViaContract(normalizedIp);
    return response.data;
  } catch (error) {
    uiLogger.warn('IPQS backend check failed:', toErrorMessage(error));
    return null;
  }
}

export async function checkIPQuality(ip: string): Promise<IPQSResponse | null> {
  const backendAvailable = await isLocalProxyAvailable();
  if (!backendAvailable) {
    uiLogger.warn('IPQS backend is unavailable');
    return null;
  }

  return checkIPQualityViaBackend(ip);
}
