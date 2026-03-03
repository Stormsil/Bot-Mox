import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { AlertProps } from 'antd';
import { normalizeResourceStatusVocabulary } from '../../../../entities/resources/model/statusVocabulary';
import type { Proxy as ProxyResource } from '../../../../entities/resources/model/types';
import type { ProxyInfo } from './types';

export const withProxyComputedState = (proxy: ProxyResource): ProxyInfo => {
  const normalizedStatus = normalizeResourceStatusVocabulary(proxy);
  const isExpired =
    normalizedStatus.computedStatus === 'expired' || normalizedStatus.statusToken === 'expired';

  return {
    ...proxy,
    daysRemaining: isExpired ? 0 : (normalizedStatus.daysRemaining ?? 0),
    isExpired,
    isExpiringSoon: normalizedStatus.isExpiringSoon,
  };
};

export const getProxyStatusIcon = (proxy: ProxyInfo) => {
  if (proxy.isExpired)
    return <ExclamationCircleOutlined style={{ color: 'var(--botmox-color-status-danger)' }} />;
  if (proxy.isExpiringSoon)
    return <ClockCircleOutlined style={{ color: 'var(--botmox-color-status-warning)' }} />;
  if (proxy.status === 'banned')
    return <WarningOutlined style={{ color: 'var(--botmox-color-status-danger)' }} />;
  return <CheckCircleOutlined style={{ color: 'var(--botmox-color-status-success)' }} />;
};

export const getProxyStatusColor = (proxy: ProxyInfo): AlertProps['type'] => {
  if (proxy.isExpired) return 'error';
  if (proxy.isExpiringSoon) return 'warning';
  if (proxy.status === 'banned') return 'error';
  return 'success';
};

export const getProxyStatusText = (proxy: ProxyInfo) => {
  if (proxy.isExpired) return 'Expired';
  if (proxy.isExpiringSoon) return `Expiring in ${proxy.daysRemaining} days`;
  if (proxy.status === 'banned') return 'Banned';
  return 'Active';
};

export interface ProxyAlertState {
  message: string;
  description: string;
  type: AlertProps['type'];
}

export const getProxyAlertState = (proxy: ProxyInfo): ProxyAlertState | null => {
  if (proxy.isExpired) {
    return {
      message: 'Proxy Expired',
      description: 'This proxy has expired. The bot may lose connection. Please renew the proxy.',
      type: 'error',
    };
  }

  if (proxy.status === 'banned') {
    return {
      message: 'Proxy Banned',
      description:
        'This proxy has been banned. The bot may not function properly. Please assign a new proxy.',
      type: 'error',
    };
  }

  if (proxy.isExpiringSoon) {
    return {
      message: 'Proxy Expiring Soon',
      description: `This proxy will expire in ${proxy.daysRemaining} day(s). Please renew soon to avoid connection issues.`,
      type: 'warning',
    };
  }

  return null;
};

export const getLocalFraudScoreColor = (score: number) => {
  if (score <= 20) return 'var(--botmox-color-status-success)';
  if (score <= 50) return 'var(--botmox-color-status-warning)';
  return 'var(--botmox-color-status-danger)';
};

export const getLocalFraudScoreStatus = (score: number) => {
  if (score <= 20) return 'Low Risk';
  if (score <= 50) return 'Medium Risk';
  return 'High Risk';
};
