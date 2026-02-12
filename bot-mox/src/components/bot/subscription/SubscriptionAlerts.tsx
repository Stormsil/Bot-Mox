import React from 'react';
import { Alert } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { SubscriptionWithDetails } from './types';
import { getTypeLabel } from './helpers';

interface ProblemSubscriptionsAlertProps {
  subscriptions: SubscriptionWithDetails[];
}

interface SubscriptionStatusAlertProps {
  subscription: SubscriptionWithDetails;
}

export const ProblemSubscriptionsAlert: React.FC<ProblemSubscriptionsAlertProps> = ({ subscriptions }) => {
  if (subscriptions.length === 0) return null;

  return (
    <Alert
      className="subscription-alert"
      message={
        <span>
          <WarningOutlined /> {subscriptions.length} subscription(s) require attention
        </span>
      }
      description={
        <ul className="alert-list">
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

export const SubscriptionStatusAlert: React.FC<SubscriptionStatusAlertProps> = ({ subscription }) => {
  if (!subscription.isExpired && !subscription.isExpiringSoon) return null;

  return (
    <Alert
      className="item-alert"
      message={subscription.isExpired ? 'Subscription expired' : 'Expiring soon'}
      type={subscription.isExpired ? 'error' : 'warning'}
      showIcon
      banner
    />
  );
};
