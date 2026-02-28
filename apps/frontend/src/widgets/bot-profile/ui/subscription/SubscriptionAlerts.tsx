import { WarningOutlined } from '@ant-design/icons';
import { Alert } from 'antd';
import type React from 'react';
import { getTypeLabel } from './helpers';
import styles from './subscription.module.css';
import type { SubscriptionWithDetails } from './types';

interface ProblemSubscriptionsAlertProps {
  subscriptions: SubscriptionWithDetails[];
}

interface SubscriptionStatusAlertProps {
  subscription: SubscriptionWithDetails;
}

export const ProblemSubscriptionsAlert: React.FC<ProblemSubscriptionsAlertProps> = ({
  subscriptions,
}) => {
  if (subscriptions.length === 0) return null;

  return (
    <Alert
      className={styles['subscription-alert']}
      message={
        <span>
          <WarningOutlined /> {subscriptions.length} subscription(s) require attention
        </span>
      }
      description={
        <ul className={styles['alert-list']}>
          {subscriptions.map((subscription) => (
            <li key={subscription.id}>
              <strong>{getTypeLabel(subscription.type)}</strong> -{' '}
              {subscription.computedStatus === 'expired'
                ? 'Expired'
                : `Expires in ${subscription.daysRemaining} days`}
            </li>
          ))}
        </ul>
      }
      type="warning"
      showIcon={false}
    />
  );
};

export const SubscriptionStatusAlert: React.FC<SubscriptionStatusAlertProps> = ({
  subscription,
}) => {
  if (!subscription.isExpired && !subscription.isExpiringSoon) return null;

  return (
    <Alert
      className={styles['item-alert']}
      message={
        <span className={styles['item-alert-message']}>
          {subscription.isExpired ? 'Subscription expired' : 'Expiring soon'}
        </span>
      }
      type={subscription.isExpired ? 'error' : 'warning'}
      showIcon
      banner
    />
  );
};
