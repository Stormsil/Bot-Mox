import {
  CheckCircleOutlined,
  ClockCircleOutlined,
  ExclamationCircleOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import type { AlertProps } from 'antd';
import type { Proxy as ProxyResource } from '../../../types';
import type { ProxyInfo } from './types';

export const withProxyComputedState = (proxy: ProxyResource): ProxyInfo => {
  const daysRemaining = Math.ceil((proxy.expires_at - Date.now()) / (1000 * 60 * 60 * 24));
  return {
    ...proxy,
    daysRemaining,
    isExpired: Date.now() > proxy.expires_at,
    isExpiringSoon: daysRemaining <= 7 && daysRemaining > 0,
  };
};

export const getProxyStatusIcon = (proxy: ProxyInfo) => {
  if (proxy.isExpired) return <ExclamationCircleOutlined style={{ color: '#ff4d4f' }} />;
  if (proxy.isExpiringSoon) return <ClockCircleOutlined style={{ color: '#faad14' }} />;
  if (proxy.status === 'banned') return <WarningOutlined style={{ color: '#ff4d4f' }} />;
  return <CheckCircleOutlined style={{ color: '#52c41a' }} />;
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
  if (score <= 20) return '#52c41a';
  if (score <= 50) return '#faad14';
  return '#ff4d4f';
};

export const getLocalFraudScoreStatus = (score: number) => {
  if (score <= 20) return 'Low Risk';
  if (score <= 50) return 'Medium Risk';
  return 'High Risk';
};
