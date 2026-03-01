import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  PlusCircleOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { DeleteButton, EditButton } from '@refinedev/antd';
import type { TableColumnsType } from 'antd';
import { Button, Popover, Space, Tag, Typography } from 'antd';
import dayjs from 'dayjs';
import type { LicenseWithBots } from '../../../entities/resources/model/types';
import { TableActionButton, TableActionGroup } from '../../../shared/ui/TableActionButton';
import styles from '../LicensesPage.module.css';
import { isExpired, isExpiringSoon, ONE_DAY_MS } from './helpers';
import type { LicenseColumnsHandlers } from './types';

const { Text } = Typography;

interface BuildLicenseColumnsOptions {
  currentTime: number;
  handlers: LicenseColumnsHandlers;
}

const renderBotsPopover = (
  record: LicenseWithBots,
  onRemoveBot: LicenseColumnsHandlers['onRemoveBot'],
) => (
  <div style={{ maxWidth: 300, maxHeight: 400, overflow: 'auto' }}>
    <Space direction="vertical" size="small" style={{ width: '100%' }}>
      {record.botDetails?.map((bot, index) => (
        <div
          key={bot.id}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}
        >
          <div style={{ flex: 1 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <RobotOutlined style={{ color: 'var(--boxmox-color-brand-primary)' }} />
              <Text style={{ fontSize: '12px', fontWeight: 500 }}>{bot.name}</Text>
            </div>
            <Text type="secondary" style={{ fontSize: '11px', paddingLeft: 24 }}>
              {bot.id.substring(0, 8)}...
              {bot.vmName && ` (${bot.vmName})`}
            </Text>
          </div>
          <TableActionButton
            danger
            onClick={() => void onRemoveBot(record, index)}
            buttonSize="small"
            tooltip="Remove bot"
          >
            ×
          </TableActionButton>
        </div>
      ))}
    </Space>
  </div>
);

export const buildLicenseColumns = ({
  currentTime,
  handlers,
}: BuildLicenseColumnsOptions): TableColumnsType<LicenseWithBots> => [
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status',
    width: 120,
    render: (status: string, record) => {
      let color = 'default';

      if (isExpired(record.expires_at, currentTime)) {
        color = 'error';
      } else if (isExpiringSoon(record.expires_at, currentTime)) {
        color = 'warning';
      } else if (status === 'active') {
        color = 'success';
      } else if (status === 'revoked') {
        color = 'red';
      }

      return (
        <Tag bordered={false} color={color} className={styles.statusTag}>
          {(isExpired(record.expires_at, currentTime) ? 'expired' : status).toUpperCase()}
        </Tag>
      );
    },
  },
  {
    title: 'License Key',
    dataIndex: 'key',
    key: 'key',
    render: (key: string, record) => (
      <Space direction="vertical" size={0}>
        <Text code copyable={{ text: key, icon: <CopyOutlined /> }} className={styles.licenseKey}>
          {key}
        </Text>
        {record.type && (
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {record.type}
          </Text>
        )}
      </Space>
    ),
  },
  {
    title: 'Bot',
    key: 'bot',
    width: 400,
    render: (_value, record) => {
      const botCount = record.botDetails?.length || 0;

      if (botCount === 0) {
        return (
          <Button
            size="small"
            type="dashed"
            icon={<PlusCircleOutlined />}
            onClick={() => handlers.onAddBot(record)}
          >
            Add Bot
          </Button>
        );
      }

      if (botCount === 1) {
        const bot = record.botDetails?.[0];
        if (!bot) {
          return null;
        }
        return (
          <Space align="start">
            <Space direction="vertical" size={0}>
              <Space size={4}>
                <RobotOutlined
                  style={{ marginRight: 4, color: 'var(--boxmox-color-brand-primary)' }}
                />
                <Text code>{bot.id}</Text>
              </Space>
              <Text type="secondary" style={{ fontSize: '11px' }}>
                {bot.characterName || bot.name}
                {bot.vmName && ` (${bot.vmName})`}
              </Text>
            </Space>
            <Space>
              <TableActionButton
                danger
                onClick={() => void handlers.onRemoveBot(record, 0)}
                tooltip="Remove bot"
              >
                ×
              </TableActionButton>
              <Button
                size="small"
                type="dashed"
                icon={<PlusCircleOutlined />}
                onClick={() => handlers.onAddBot(record)}
              />
            </Space>
          </Space>
        );
      }

      const firstBot = record.botDetails?.[0];
      if (!firstBot) {
        return null;
      }
      return (
        <Space direction="vertical" size={0}>
          <Space>
            <Popover
              content={renderBotsPopover(record, handlers.onRemoveBot)}
              title={`${botCount} Linked Bots`}
              trigger="click"
              placement="right"
            >
              <Button size="small" type="primary" icon={<RobotOutlined />}>
                {botCount} bots
              </Button>
            </Popover>
            <Button
              size="small"
              type="dashed"
              icon={<PlusCircleOutlined />}
              onClick={() => handlers.onAddBot(record)}
            />
          </Space>
          <Text type="secondary" style={{ fontSize: '11px' }}>
            {firstBot.characterName || firstBot.name}
            {firstBot.vmName && ` (${firstBot.vmName})`}
          </Text>
        </Space>
      );
    },
  },
  {
    title: 'Expires',
    dataIndex: 'expires_at',
    key: 'expires_at',
    width: 120,
    render: (expiresAt: number) => {
      const expired = isExpired(expiresAt, currentTime);
      const expiringSoon = isExpiringSoon(expiresAt, currentTime);
      return (
        <Text style={{ color: expired ? '#ff4d4f' : expiringSoon ? '#faad14' : undefined }}>
          {dayjs(expiresAt).format('DD.MM.YYYY')}
        </Text>
      );
    },
  },
  {
    title: 'Created',
    dataIndex: 'created_at',
    key: 'created_at',
    width: 120,
    render: (createdAt: number) => dayjs(createdAt).format('DD.MM.YYYY'),
  },
  {
    title: 'Days Left',
    key: 'days_left',
    width: 100,
    render: (_value, record) => {
      const expired = isExpired(record.expires_at, currentTime);
      const daysLeft = Math.ceil((record.expires_at - currentTime) / ONE_DAY_MS);

      if (expired) {
        return <Text style={{ color: '#ff4d4f', fontSize: '14px', fontWeight: 600 }}>0</Text>;
      }

      let color = '#52c41a';
      if (daysLeft <= 3) {
        color = '#ff4d4f';
      } else if (daysLeft <= 7) {
        color = '#faad14';
      }

      return <Text style={{ color, fontSize: '14px', fontWeight: 600 }}>{daysLeft}</Text>;
    },
  },
  {
    title: 'Actions',
    key: 'actions',
    width: 150,
    render: (_value, record) => (
      <TableActionGroup>
        <EditButton
          hideText
          size="small"
          shape="circle"
          icon={<EditOutlined />}
          resource="licenses"
          recordItemId={record.id}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            handlers.onEdit(record);
          }}
        />
        <TableActionButton
          icon={<CopyOutlined />}
          onClick={() => handlers.onCopyKey(record.key)}
          tooltip="Copy Key"
        />
        <DeleteButton
          hideText
          size="small"
          shape="circle"
          icon={<DeleteOutlined />}
          resource="licenses"
          recordItemId={record.id}
          confirmTitle="Delete License?"
          confirmOkText="Delete"
          confirmCancelText="Cancel"
          successNotification={() => ({
            message: 'License deleted',
            type: 'success',
          })}
          errorNotification={() => ({
            message: 'Failed to delete license',
            type: 'error',
          })}
        />
      </TableActionGroup>
    ),
  },
];
