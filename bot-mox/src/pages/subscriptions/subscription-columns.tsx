import React from 'react';
import { DeleteOutlined, EditOutlined, RobotOutlined } from '@ant-design/icons';
import type { TableColumnsType } from 'antd';
import { Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import { TableActionButton, TableActionGroup } from '../../components/ui/TableActionButton';
import type { SubscriptionWithDetails } from '../../types';
import { getSubscriptionStatusColor, getSubscriptionStatusText } from './subscription-status';

const { Text } = Typography;

interface BuildSubscriptionColumnsParams {
  onEdit: (subscription: SubscriptionWithDetails) => void;
  onDelete: (subscription: SubscriptionWithDetails) => void;
  cellClassName?: string;
  headerClassName?: string;
}

export const buildSubscriptionColumns = ({
  onEdit,
  onDelete,
  cellClassName,
  headerClassName,
}: BuildSubscriptionColumnsParams): TableColumnsType<SubscriptionWithDetails> => [
  {
    title: 'Status',
    dataIndex: 'computedStatus',
    key: 'computedStatus',
    width: 140,
    ...(cellClassName ? { className: cellClassName } : {}),
    ...(headerClassName ? { onHeaderCell: () => ({ className: headerClassName }) } : {}),
    render: (status: SubscriptionWithDetails['computedStatus'], record) => (
      <Tag
        color={getSubscriptionStatusColor(status)}
        style={{ fontSize: '11px', borderRadius: 2, textTransform: 'uppercase' }}
      >
        {getSubscriptionStatusText(status)}
        {status === 'expiring_soon' && ` (${record.daysRemaining} days)`}
      </Tag>
    ),
  },
  {
    title: 'Bot',
    key: 'bot',
    width: 200,
    ...(cellClassName ? { className: cellClassName } : {}),
    ...(headerClassName ? { onHeaderCell: () => ({ className: headerClassName }) } : {}),
    render: (_value: unknown, record) => (
      <Space direction="vertical" size={0}>
        <Text style={{ fontSize: '12px', fontWeight: 500 }}>
          <RobotOutlined style={{ marginRight: 4, color: 'var(--boxmox-color-brand-primary)' }} />
          {record.bot_id}
        </Text>
        <Text type="secondary" style={{ fontSize: '11px' }}>
          {record.botCharacter || record.botName}
          {record.botVmName && ` (${record.botVmName})`}
        </Text>
      </Space>
    ),
  },
  {
    title: 'Expires',
    dataIndex: 'expires_at',
    key: 'expires_at',
    width: 130,
    ...(cellClassName ? { className: cellClassName } : {}),
    ...(headerClassName ? { onHeaderCell: () => ({ className: headerClassName }) } : {}),
    render: (expiresAt: number, record) => (
      <Text
        style={{
          color: record.isExpired ? '#ff4d4f' : record.isExpiringSoon ? '#faad14' : undefined,
          fontSize: '12px',
        }}
      >
        {dayjs(expiresAt).format('DD.MM.YYYY')}
      </Text>
    ),
  },
  {
    title: 'Created',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 100,
    ...(cellClassName ? { className: cellClassName } : {}),
    ...(headerClassName ? { onHeaderCell: () => ({ className: headerClassName }) } : {}),
    render: (createdAt: number) => <Text style={{ fontSize: '12px' }}>{dayjs(createdAt).format('DD.MM.YYYY')}</Text>,
  },
  {
    title: 'Days Left',
    key: 'days_left',
    width: 100,
    ...(cellClassName ? { className: cellClassName } : {}),
    ...(headerClassName ? { onHeaderCell: () => ({ className: headerClassName }) } : {}),
    render: (_value: unknown, record) => {
      if (record.isExpired) {
        return (
          <Text style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 600 }}>
            0
          </Text>
        );
      }

      let color = '#52c41a';
      if (record.daysRemaining <= 3) {
        color = '#ff4d4f';
      } else if (record.daysRemaining <= 7) {
        color = '#faad14';
      }

      return (
        <Text
          style={{
            color,
            fontSize: '14px',
            fontWeight: 600,
          }}
        >
          {record.daysRemaining}
        </Text>
      );
    },
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 100,
    ...(cellClassName ? { className: cellClassName } : {}),
    ...(headerClassName ? { onHeaderCell: () => ({ className: headerClassName }) } : {}),
    render: (_value: unknown, record) => (
      <TableActionGroup>
        <TableActionButton icon={<EditOutlined />} onClick={() => onEdit(record)} tooltip="Edit" />
        <TableActionButton danger icon={<DeleteOutlined />} onClick={() => onDelete(record)} tooltip="Delete" />
      </TableActionGroup>
    ),
  },
];
