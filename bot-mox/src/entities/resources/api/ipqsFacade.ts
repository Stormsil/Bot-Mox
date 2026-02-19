import { uiLogger } from '../../../observability/uiLogger';
import {
  checkIpqsViaContract,
  getIpqsStatusViaContract,
} from '../../../providers/ipqs-contract-client';
import type { IPQSResponse, Proxy as ProxyResource } from '../../../types';
import { getApiKeys, getProxySettings } from '../../settings/api/settingsFacade';

interface BackendStatusPayload {
  enabled?: unknown;
  configured?: unknown;
  supabaseSettingsConnected?: unknown;
}

interface BackendStatus {
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

async function getStatusFromBackend(): Promise<BackendStatus | null> {
  try {
    const response = await getIpqsStatusViaContract();
    return normalizeBackendStatus((response.data || {}) as BackendStatusPayload);
  } catch (error) {
    uiLogger.warn('Failed to fetch IPQS status from backend:', error);
    return null;
  }
}

async function isLocalProxyAvailable(): Promise<boolean> {
  const status = await getStatusFromBackend();
  return Boolean(status);
}

export async function checkIPQuality(ip: string): Promise<IPQSResponse | null> {
  const normalizedIp = String(ip || '').trim();
  if (!normalizedIp) {
    return null;
  }

  const backendAvailable = await isLocalProxyAvailable();
  if (!backendAvailable) {
    uiLogger.warn('IPQS backend is unavailable');
    return null;
  }

  try {
    const response = await checkIpqsViaContract(normalizedIp);
    return response.data;
  } catch (error) {
    uiLogger.warn('IPQS backend check failed:', error);
    return null;
  }
}

export async function isProxySuspicious(fraudScore: number): Promise<boolean> {
  try {
    const proxySettings = await getProxySettings();
    return fraudScore > proxySettings.fraud_score_threshold;
  } catch (error) {
    uiLogger.error('Error checking proxy suspicion:', error);
    return fraudScore > 75;
  }
}

export async function isAutoCheckEnabled(): Promise<boolean> {
  try {
    const [apiKeys, proxySettings] = await Promise.all([getApiKeys(), getProxySettings()]);
    return (
      apiKeys.ipqs.enabled && apiKeys.ipqs.api_key.length > 0 && proxySettings.auto_check_on_add
    );
  } catch (error) {
    uiLogger.error('Error checking auto check status:', error);
    return false;
  }
}

export async function isIPQSCheckEnabled(): Promise<boolean> {
  const status = await getStatusFromBackend();
  if (status) {
    return status.enabled && status.configured;
  }

  try {
    const apiKeys = await getApiKeys();
    return apiKeys.ipqs.enabled && apiKeys.ipqs.api_key.length > 0;
  } catch (error) {
    uiLogger.error('Error checking IPQS status:', error);
    return false;
  }
}

export function updateProxyWithIPQSData(
  proxy: Partial<ProxyResource>,
  ipqsData: IPQSResponse,
): Partial<ProxyResource> {
  const updates: Partial<ProxyResource> = {
    ...proxy,
    fraud_score: ipqsData.fraud_score,
    country: ipqsData.country_code || proxy.country || 'Unknown',
    country_code: ipqsData.country_code || '',
    city: ipqsData.city || '',
    region: ipqsData.region || '',
    zip_code: ipqsData.zip_code || '',
    isp: ipqsData.isp || '',
    organization: ipqsData.organization || '',
    timezone: ipqsData.timezone || '',
    latitude: ipqsData.latitude ?? 0,
    longitude: ipqsData.longitude ?? 0,
    vpn: ipqsData.vpn || false,
    proxy: ipqsData.proxy || false,
    tor: ipqsData.tor || false,
    bot_status: ipqsData.bot_status || false,
    last_checked: Date.now(),
    updated_at: Date.now(),
  };

  Object.keys(updates).forEach((key) => {
    if (updates[key as keyof ProxyResource] === undefined) {
      delete updates[key as keyof ProxyResource];
    }
  });

  return updates;
}

export function getFraudScoreColor(score: number): string {
  if (score <= 20) return '#52c41a';
  if (score <= 50) return '#faad14';
  if (score <= 75) return '#ff7a45';
  return '#ff4d4f';
}

export function getFraudScoreLabel(score: number): string {
  if (score <= 20) return 'Low Risk';
  if (score <= 50) return 'Medium Risk';
  if (score <= 75) return 'High Risk';
  return 'Critical Risk';
}

export type { IPQSResponse, ProxyResource as Proxy };
