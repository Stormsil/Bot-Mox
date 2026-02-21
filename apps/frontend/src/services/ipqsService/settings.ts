import { uiLogger } from '../../observability/uiLogger';
import { getApiKeys, getProxySettings } from '../apiKeysService';
import { getStatusFromBackend } from './backend';

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

export async function getIPQSStatus(): Promise<{
  enabled: boolean;
  configured: boolean;
  localProxyAvailable: boolean;
}> {
  const status = await getStatusFromBackend();
  if (status) {
    return {
      enabled: status.enabled,
      configured: status.configured,
      localProxyAvailable: true,
    };
  }

  try {
    const apiKeys = await getApiKeys();
    return {
      enabled: apiKeys.ipqs.enabled,
      configured: apiKeys.ipqs.api_key.length > 0,
      localProxyAvailable: false,
    };
  } catch (error) {
    uiLogger.error('Error getting IPQS status:', error);
    return { enabled: false, configured: false, localProxyAvailable: false };
  }
}

export async function getFraudScoreThreshold(): Promise<number> {
  try {
    const proxySettings = await getProxySettings();
    return proxySettings.fraud_score_threshold;
  } catch (error) {
    uiLogger.error('Error getting fraud score threshold:', error);
    return 75;
  }
}
