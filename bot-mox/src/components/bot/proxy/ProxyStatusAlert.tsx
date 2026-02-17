import React from 'react';
import { Alert } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { getProxyAlertState } from './helpers';
import type { ProxyInfo } from './types';
import styles from './proxy.module.css';

interface ProxyStatusAlertProps {
  proxy: ProxyInfo;
}

export const ProxyStatusAlert: React.FC<ProxyStatusAlertProps> = ({ proxy }) => {
  const alertState = getProxyAlertState(proxy);
  if (!alertState) {
    return null;
  }

  return (
    <Alert
      className={styles['proxy-alert']}
      message={alertState.message}
      description={alertState.description}
      type={alertState.type}
      showIcon
      icon={<WarningOutlined />}
    />
  );
};
