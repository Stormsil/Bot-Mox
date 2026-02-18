import React from 'react';
import { Popconfirm, Tag, Tooltip, Typography } from 'antd';
import { DeleteOutlined } from '@ant-design/icons';
import { StatusBadge } from '../../components/ui/StatusBadge';
import { TableActionButton } from '../../components/ui/TableActionButton';
import type { BotStatus } from '../../types';
import type { BotRow } from './types';
import { BOT_STATUS_ORDER } from './types';
import { formatDaysRemaining, formatFaction, formatServerName } from './utils';
import styles from './ProjectPage.module.css';

const { Text } = Typography;

function renderStatusWithDays({
  label,
  color,
  daysRemaining,
  onClick,
}: {
  label: string;
  color: string;
  daysRemaining: number | undefined;
  onClick: () => void;
}) {
  return (
    <div className={`${styles.cellStack} ${styles.cellLink}`} onClick={onClick}>
      <Tag color={color} className={styles.statusTag}>{label}</Tag>
      <Text type="secondary" className={styles.secondary}>
        {formatDaysRemaining(daysRemaining)}
      </Text>
    </div>
  );
}

export function createProjectColumns({
  goToBot,
  deletingBotIds,
  onDeleteAccount,
}: {
  goToBot: (botId: string, tab?: string) => void;
  deletingBotIds: Record<string, boolean>;
  onDeleteAccount: (botId: string) => void | Promise<void>;
}) {
  const cellClassName = styles.tableCell;
  const headerCellProps = { className: styles.tableHeaderCell };

  return [
    {
      title: 'ID',
      dataIndex: 'idShort',
      key: 'idShort',
      width: 90,
      className: cellClassName,
      onHeaderCell: () => headerCellProps,
      sorter: (a: BotRow, b: BotRow) => a.idShort.localeCompare(b.idShort),
      render: (_: string, record: BotRow) => (
        <div className={styles.cellLink} onClick={() => goToBot(record.id, 'summary')}>
          <Tooltip title={record.id}>
            <Text className={styles.id}>{record.idShort}</Text>
          </Tooltip>
        </div>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'botStatus',
      key: 'botStatus',
      width: 130,
      className: cellClassName,
      onHeaderCell: () => headerCellProps,
      sorter: (a: BotRow, b: BotRow) => BOT_STATUS_ORDER[a.botStatus] - BOT_STATUS_ORDER[b.botStatus],
      render: (status: BotStatus, record: BotRow) => (
        <div className={styles.cellLink} onClick={() => goToBot(record.id, 'summary')}>
          <StatusBadge status={status} size="small" />
        </div>
      ),
    },
    {
      title: 'VM',
      dataIndex: 'vmName',
      key: 'vmName',
      width: 120,
      className: cellClassName,
      onHeaderCell: () => headerCellProps,
      sorter: (a: BotRow, b: BotRow) => (a.vmName || '').localeCompare(b.vmName || ''),
      render: (value: string, record: BotRow) => (
        <div className={styles.cellLink} onClick={() => goToBot(record.id, 'vmInfo')}>
          <Text>{value || '-'}</Text>
        </div>
      ),
    },
    {
      title: 'Account',
      key: 'account',
      width: 220,
      className: cellClassName,
      onHeaderCell: () => headerCellProps,
      sorter: (a: BotRow, b: BotRow) => (a.email || '').localeCompare(b.email || ''),
      render: (_: unknown, record: BotRow) => (
        <div className={`${styles.cellStack} ${styles.cellLink}`} onClick={() => goToBot(record.id, 'account')}>
          <Text>{record.email || '-'}</Text>
          <Text type="secondary" className={styles.secondary}>
            {record.password || '-'}
          </Text>
        </div>
      ),
    },
    {
      title: 'Character',
      key: 'character',
      width: 200,
      className: cellClassName,
      onHeaderCell: () => headerCellProps,
      sorter: (a: BotRow, b: BotRow) => a.characterName.localeCompare(b.characterName),
      render: (_: unknown, record: BotRow) => {
        const factionLabel = formatFaction(record.faction);
        const serverLabel = formatServerName(record.server);
        const secondary = factionLabel
          ? serverLabel === '-' || !serverLabel
            ? factionLabel
            : `${serverLabel} • ${factionLabel}`
          : serverLabel;

        return (
          <div className={`${styles.cellStack} ${styles.cellLink}`} onClick={() => goToBot(record.id, 'character')}>
            <Text strong>
              {record.characterName}
              {typeof record.level === 'number' ? ` (${record.level})` : ''}
            </Text>
            <Text type="secondary" className={styles.secondary}>
              {secondary}
            </Text>
          </div>
        );
      },
    },
    {
      title: 'License',
      dataIndex: 'licenseStatusLabel',
      key: 'licenseStatus',
      width: 120,
      className: cellClassName,
      onHeaderCell: () => headerCellProps,
      sorter: (a: BotRow, b: BotRow) => a.licenseSort - b.licenseSort,
      render: (_: string, record: BotRow) =>
        renderStatusWithDays({
          label: record.licenseStatusLabel,
          color: record.licenseStatusColor,
          daysRemaining: record.licenseDaysRemaining,
          onClick: () => goToBot(record.id, 'license'),
        }),
    },
    {
      title: 'Proxy',
      dataIndex: 'proxyStatusLabel',
      key: 'proxyStatus',
      width: 120,
      className: cellClassName,
      onHeaderCell: () => headerCellProps,
      sorter: (a: BotRow, b: BotRow) => a.proxySort - b.proxySort,
      render: (_: string, record: BotRow) =>
        renderStatusWithDays({
          label: record.proxyStatusLabel,
          color: record.proxyStatusColor,
          daysRemaining: record.proxyDaysRemaining,
          onClick: () => goToBot(record.id, 'proxy'),
        }),
    },
    {
      title: 'Subscribe',
      dataIndex: 'subscriptionStatusLabel',
      key: 'subscriptionStatus',
      width: 140,
      className: cellClassName,
      onHeaderCell: () => headerCellProps,
      sorter: (a: BotRow, b: BotRow) => a.subscriptionSort - b.subscriptionSort,
      render: (_: string, record: BotRow) =>
        renderStatusWithDays({
          label: record.subscriptionStatusLabel,
          color: record.subscriptionStatusColor,
          daysRemaining: record.subscriptionDaysRemaining,
          onClick: () => goToBot(record.id, 'subscription'),
        }),
    },
    {
      title: 'Action',
      key: 'action',
      width: 140,
      align: 'left' as const,
      className: cellClassName,
      onHeaderCell: () => headerCellProps,
      render: (_: unknown, record: BotRow) => {
        const isDeleting = Boolean(deletingBotIds[record.id]);
        return (
          <div className={styles.rowActions}>
            <Popconfirm
              title="Delete account?"
              description={`This will remove ${record.idShort} from database.`}
              okText="Delete"
              cancelText="Cancel"
              okButtonProps={{ danger: true }}
              onConfirm={() => onDeleteAccount(record.id)}
            >
              <TableActionButton
                danger
                icon={<DeleteOutlined />}
                className={styles.deleteButton}
                loading={isDeleting}
                onClick={(event) => event.stopPropagation()}
                tooltip="Delete account"
              >
                Delete
              </TableActionButton>
            </Popconfirm>
          </div>
        );
      },
    },
  ];
}
