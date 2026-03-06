import { DeleteOutlined, EditOutlined, RobotOutlined } from '@ant-design/icons';
import { DeleteButton, EditButton } from '@refinedev/antd';
import type { TableColumnsType } from 'antd';

import type { SubscriptionWithDetails } from '../../entities/resources/model/types';
import {
  getExpiryIntent,
  getRemainingDaysIntent,
  getSemanticIntentColorToken,
  getSubscriptionStatusIntent,
} from '../../shared/lib/statusSemantic';
import {
  createActionsRenderer,
  createDateTextRenderer,
  createStatusTagRenderer,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../shared/ui';
import { getSubscriptionStatusText } from './subscription-status';

const { Text } = Typography;

interface BuildSubscriptionColumnsParams {
  onEdit: (subscriptionId: string) => void;
}

export const buildSubscriptionColumns = ({
  onEdit,
}: BuildSubscriptionColumnsParams): TableColumnsType<SubscriptionWithDetails> => {
  const renderStatus = createStatusTagRenderer<
    SubscriptionWithDetails,
    SubscriptionWithDetails['computedStatus']
  >({
    getIntent: (status) => getSubscriptionStatusIntent(status),
    getLabel: (status, record) =>
      `${getSubscriptionStatusText(status)}${status === 'expiring_soon' ? ` (${record.daysRemaining} days)` : ''}`,
    style: { fontSize: '11px', textTransform: 'uppercase' },
  });

  const renderExpiresDate = createDateTextRenderer<SubscriptionWithDetails, number>({
    getIntent: (_value, record) => getExpiryIntent(record.isExpired, record.isExpiringSoon),
    fontSize: '12px',
  });

  const renderCreatedDate = createDateTextRenderer<SubscriptionWithDetails, number>({
    fontSize: '12px',
  });

  const renderActions = createActionsRenderer<SubscriptionWithDetails>({
    renderActions: (record) => (
      <>
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
      </>
    ),
    renderContainer: (actions) => <Space size={6}>{actions}</Space>,
  });

  return [
    {
      title: 'Status',
      dataIndex: 'computedStatus',
      key: 'computedStatus',
      width: 140,
      render: renderStatus,
    },
    {
      title: 'Bot',
      key: 'bot',
      width: 200,
      render: (_value: unknown, record) => (
        <Space direction="vertical" size={0}>
          <Space size={4}>
            <RobotOutlined style={{ marginRight: 4, color: 'var(--botmox-color-brand-primary)' }} />
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
      render: renderExpiresDate,
    },
    {
      title: 'Created',
      dataIndex: 'created_at',
      key: 'created_at',
      width: 100,
      render: renderCreatedDate,
    },
    {
      title: 'Days Left',
      key: 'days_left',
      width: 100,
      render: (_value: unknown, record) => {
        if (record.isExpired) {
          return (
            <Text
              style={{
                color: getSemanticIntentColorToken('error'),
                fontSize: '14px',
                fontWeight: 600,
              }}
            >
              0
            </Text>
          );
        }

        const color = getSemanticIntentColorToken(getRemainingDaysIntent(record.daysRemaining));

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
      render: renderActions,
    },
  ];
};
