import type { IPQSResponse } from '../types';
import { checkIPQuality, isLocalProxyAvailable, LOCAL_PROXY_URL } from './ipqsService/backend';
import { updateProxyWithIPQSData } from './ipqsService/mapper';
import {
  formatFraudScore,
  getFraudScoreColor,
  getFraudScoreLabel,
} from './ipqsService/presentation';
import {
  getFraudScoreThreshold,
  getIPQSStatus,
  isAutoCheckEnabled,
  isIPQSCheckEnabled,
  isProxySuspicious,
} from './ipqsService/settings';

export {
  checkIPQuality,
  formatFraudScore,
  getFraudScoreColor,
  getFraudScoreLabel,
  getFraudScoreThreshold,
  getIPQSStatus,
  isAutoCheckEnabled,
  isIPQSCheckEnabled,
  isProxySuspicious,
  updateProxyWithIPQSData,
};

export async function checkProxyWithValidation(ip: string): Promise<{
  data: IPQSResponse | null;
  isSuspicious: boolean;
  error?: string;
  localProxyUsed: boolean;
}> {
  try {
    const localProxyUsed = await isLocalProxyAvailable();
    const enabled = await isIPQSCheckEnabled();
    if (!enabled) {
      return {
        data: null,
        isSuspicious: false,
        error: 'IPQS check is disabled or API key not configured',
        localProxyUsed,
      };
    }

    const data = await checkIPQuality(ip);
    if (!data) {
      return {
        data: null,
        isSuspicious: false,
        error: 'Failed to check IP quality',
        localProxyUsed,
      };
    }

    const suspicious = await isProxySuspicious(data.fraud_score);
    return { data, isSuspicious: suspicious, localProxyUsed };
  } catch (error) {
    return {
      data: null,
      isSuspicious: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      localProxyUsed: false,
    };
  }
}

export async function checkLocalProxyStatus(): Promise<{ available: boolean; message: string }> {
  const available = await isLocalProxyAvailable();

  if (available) {
    return {
      available: true,
      message: `Backend API is available on ${LOCAL_PROXY_URL}`,
    };
  }

  return {
    available: false,
    message: 'Backend API is unavailable. Start it with: pnpm run dev:backend',
  };
}
