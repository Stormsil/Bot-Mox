import React from 'react';
import { EditOutlined, DeleteOutlined } from '@ant-design/icons';
import { List, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { TableActionButton } from '../../ui/TableActionButton';
import { getDaysLeftColor, getStatusColor, getStatusIcon, getStatusText } from './helpers';
import { SubscriptionStatusAlert } from './SubscriptionAlerts';
import type { SubscriptionWithDetails } from './types';
import styles from './subscription.module.css';

const { Text } = Typography;

interface SubscriptionListItemProps {
  subscription: SubscriptionWithDetails;
  onEdit: (subscription: SubscriptionWithDetails) => void;
  onDelete: (subscription: SubscriptionWithDetails) => void;
}

export const SubscriptionListItem: React.FC<SubscriptionListItemProps> = ({
  subscription,
  onEdit,
  onDelete,
}) => (
  <List.Item
    className={styles['subscription-item']}
    actions={[
      <TableActionButton
        key="edit"
        icon={<EditOutlined />}
        onClick={() => onEdit(subscription)}
        tooltip="Edit"
      />,
      <TableActionButton
        key="delete"
        danger
        icon={<DeleteOutlined />}
        onClick={() => onDelete(subscription)}
        tooltip="Delete"
      />,
    ]}
  >
    <div className={styles['subscription-item-content']}>
      <div className={styles['subscription-header']}>
        <div className={styles['subscription-type']}>
          <Tag
            color={getStatusColor(subscription.computedStatus)}
            icon={getStatusIcon(subscription.computedStatus)}
          >
            {getStatusText(subscription)}
          </Tag>
        </div>
        {subscription.type === 'wow' && subscription.auto_renew && (
          <Tag color="success" style={{ fontSize: '10px' }}>
            Auto-renewal
          </Tag>
        )}
      </div>

      {subscription.type === 'wow' && subscription.account_email && (
        <div className="subscription-account" style={{ marginTop: 8 }}>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            Account: {subscription.account_email}
          </Text>
        </div>
      )}

      {subscription.notes && (
        <div className="subscription-notes" style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {subscription.notes}
          </Text>
        </div>
      )}

      <div className={styles['subscription-details']}>
        <div className={styles['detail-row']}>
          <Text type="secondary">Expires:</Text>
          <Text
            strong
            style={{
              fontSize: '12px',
              color: subscription.isExpired
                ? '#ff4d4f'
                : subscription.isExpiringSoon
                  ? '#faad14'
                  : undefined,
            }}
          >
            {dayjs(subscription.expires_at).format('DD.MM.YYYY')}
          </Text>
        </div>
        <div className={styles['detail-row']}>
          <Text type="secondary">Created:</Text>
          <Text style={{ fontSize: '12px' }}>{dayjs(subscription.created_at).format('DD.MM.YYYY')}</Text>
        </div>
        <div className={styles['detail-row']}>
          <Text type="secondary">Days Left:</Text>
          <Text
            strong
            style={{
              fontSize: '12px',
              color: getDaysLeftColor(subscription),
            }}
          >
            {subscription.isExpired ? 0 : subscription.daysRemaining}
          </Text>
        </div>
      </div>

      <SubscriptionStatusAlert subscription={subscription} />
    </div>
  </List.Item>
);
