import { DeleteOutlined, EditOutlined } from '@ant-design/icons';

import dayjs from 'dayjs';
import type React from 'react';
import {
  AppFlex as Flex,
  AppList as List,
  AppSpace as Space,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../../../shared/ui';
import { TableActionButton } from '../../../../shared/ui/TableActionButton';
import { getDaysLeftColor, getStatusColor, getStatusIcon, getStatusText } from './helpers';
import { SubscriptionStatusAlert } from './SubscriptionAlerts';
import styles from './subscription.module.css';
import type { SubscriptionWithDetails } from './types';

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
    <Flex vertical gap={8} className={styles['subscription-item-content']}>
      <Flex justify="space-between" align="center">
        <Space size={8}>
          <Tag
            color={getStatusColor(subscription.computedStatus)}
            icon={getStatusIcon(subscription.computedStatus)}
          >
            {getStatusText(subscription)}
          </Tag>
        </Space>
        {subscription.type === 'wow' && subscription.auto_renew && (
          <Tag color="success" style={{ fontSize: '10px' }}>
            Auto-renewal
          </Tag>
        )}
      </Flex>

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

      <Space size={16}>
        <Flex align="center" gap={6} className={styles['detail-row']}>
          <Text type="secondary">Expires:</Text>
          <Text
            strong
            style={{
              fontSize: '12px',
              color: subscription.isExpired
                ? 'var(--boxmox-color-status-danger)'
                : subscription.isExpiringSoon
                  ? 'var(--boxmox-color-status-warning)'
                  : undefined,
            }}
          >
            {dayjs(subscription.expires_at).format('DD.MM.YYYY')}
          </Text>
        </Flex>
        <Flex align="center" gap={6} className={styles['detail-row']}>
          <Text type="secondary">Created:</Text>
          <Text style={{ fontSize: '12px' }}>
            {dayjs(subscription.created_at).format('DD.MM.YYYY')}
          </Text>
        </Flex>
        <Flex align="center" gap={6} className={styles['detail-row']}>
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
        </Flex>
      </Space>

      <SubscriptionStatusAlert subscription={subscription} />
    </Flex>
  </List.Item>
);
