import { WarningOutlined } from '@ant-design/icons';

import type React from 'react';
import { AppAlert as Alert } from '../../../../shared/ui';
import { getProxyAlertState } from './helpers';
import styles from './proxy.module.css';
import type { ProxyInfo } from './types';

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
