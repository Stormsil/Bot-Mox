import { WarningOutlined } from '@ant-design/icons';
import { Alert } from 'antd';
import dayjs from 'dayjs';
import type React from 'react';
import type { SubscriptionWithDetails } from '../../types';
import styles from './SubscriptionsPage.module.css';

interface ExpiringSubscriptionsAlertProps {
  subscriptions: SubscriptionWithDetails[];
}

export const ExpiringSubscriptionsAlert: React.FC<ExpiringSubscriptionsAlertProps> = ({
  subscriptions,
}) => {
  if (subscriptions.length === 0) {
    return null;
  }

  return (
    <Alert
      className={styles.expiringAlert}
      message={`${subscriptions.length} subscription(s) expiring soon`}
      description={
        <ul className={styles.expiringList}>
          {subscriptions.slice(0, 5).map((sub) => (
            <li key={sub.id}>
              <strong>{sub.botName || sub.bot_id}</strong> - {sub.type.toUpperCase()} expires in{' '}
              {sub.daysRemaining} days ({dayjs(sub.expires_at).format('DD.MM.YYYY')})
            </li>
          ))}
          {subscriptions.length > 5 && <li>...and {subscriptions.length - 5} more</li>}
        </ul>
      }
      type="warning"
      showIcon
      icon={<WarningOutlined style={{ color: '#faad14' }} />}
    />
  );
};
