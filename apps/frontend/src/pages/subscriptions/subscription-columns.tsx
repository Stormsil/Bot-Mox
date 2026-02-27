import { DeleteOutlined, EditOutlined, RobotOutlined } from '@ant-design/icons';
import { DeleteButton, EditButton } from '@refinedev/antd';
import type { TableColumnsType } from 'antd';
import { Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { SubscriptionWithDetails } from '../../entities/resources/model/types';
import { getSubscriptionStatusColor, getSubscriptionStatusText } from './subscription-status';

const { Text } = Typography;

interface BuildSubscriptionColumnsParams {
  onEdit: (subscriptionId: string) => void;
}

export const buildSubscriptionColumns = ({
  onEdit,
}: BuildSubscriptionColumnsParams): TableColumnsType<SubscriptionWithDetails> => [
  {
    title: 'Status',
    dataIndex: 'computedStatus',
    key: 'computedStatus',
    width: 140,
    render: (status: SubscriptionWithDetails['computedStatus'], record) => (
      <Tag
        bordered={false}
        color={getSubscriptionStatusColor(status)}
        style={{ fontSize: '11px', textTransform: 'uppercase' }}
      >
        {`${getSubscriptionStatusText(status)}${status === 'expiring_soon' ? ` (${record.daysRemaining} days)` : ''}`.toUpperCase()}
      </Tag>
    ),
  },
  {
    title: 'Bot',
    key: 'bot',
    width: 200,
    render: (_value: unknown, record) => (
      <Space direction="vertical" size={0}>
        <Space size={4}>
          <RobotOutlined style={{ marginRight: 4, color: 'var(--boxmox-color-brand-primary)' }} />
          <Text code>{record.bot_id}</Text>
        </Space>
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
    render: (createdAt: number) => (
      <Text style={{ fontSize: '12px' }}>{dayjs(createdAt).format('DD.MM.YYYY')}</Text>
    ),
  },
  {
    title: 'Days Left',
    key: 'days_left',
    width: 100,
    render: (_value: unknown, record) => {
      if (record.isExpired) {
        return <Text style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 600 }}>0</Text>;
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
    render: (_value: unknown, record) => (
      <Space size={6}>
        <EditButton
          hideText
          size="small"
          shape="circle"
          icon={<EditOutlined />}
          resource="subscriptions"
          recordItemId={record.id}
          onClick={(event) => {
            event.preventDefault();
            onEdit(record.id);
          }}
        />
        <DeleteButton
          hideText
          size="small"
          shape="circle"
          icon={<DeleteOutlined />}
          resource="subscriptions"
          recordItemId={record.id}
          confirmTitle="Delete Subscription?"
          confirmOkText="Delete"
          confirmCancelText="Cancel"
          successNotification={() => ({
            message: 'Subscription deleted',
            type: 'success',
          })}
          errorNotification={() => ({
            message: 'Failed to delete subscription',
            type: 'error',
          })}
        />
      </Space>
    ),
  },
];
