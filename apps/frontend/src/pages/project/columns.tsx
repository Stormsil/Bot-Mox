import { DeleteOutlined } from '@ant-design/icons';

import type { BotStatus } from '../../shared/types';
import {
  AppFlex as Flex,
  AppPopconfirm as Popconfirm,
  AppTag as Tag,
  AppTooltip as Tooltip,
  AppTypography as Typography,
} from '../../shared/ui';
import { StatusBadge } from '../../shared/ui/StatusBadge';
import { TableActionButton } from '../../shared/ui/TableActionButton';
import styles from './ProjectPage.module.css';
import type { BotRow } from './types';
import { BOT_STATUS_ORDER } from './types';
import { formatDaysRemaining, formatFaction, formatServerName } from './utils';

const { Text } = Typography;

function resolveTagIntent(value: string): 'success' | 'warning' | 'error' | 'info' | 'default' {
  const normalized = value.trim().toLowerCase();
  if (normalized === 'success' || normalized === 'green') return 'success';
  if (normalized === 'warning' || normalized === 'orange' || normalized === 'gold')
    return 'warning';
  if (normalized === 'error' || normalized === 'red') return 'error';
  if (normalized === 'info' || normalized === 'blue' || normalized === 'processing') return 'info';
  return 'default';
}

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
    <button type="button" className={`${styles.cellButton} ${styles.cellLink}`} onClick={onClick}>
      <Flex vertical gap={2}>
        <Tag intent={resolveTagIntent(color)} className={styles.statusTag}>
          {label}
        </Tag>
        <Text type="secondary" className={styles.secondary}>
          {formatDaysRemaining(daysRemaining)}
        </Text>
      </Flex>
    </button>
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
  return [
    {
      title: 'ID',
      dataIndex: 'idShort',
      key: 'idShort',
      width: 90,
      sorter: (a: BotRow, b: BotRow) => a.idShort.localeCompare(b.idShort),
      render: (_: string, record: BotRow) => (
        <button
          type="button"
          className={`${styles.cellButton} ${styles.cellLink}`}
          onClick={() => goToBot(record.id, 'summary')}
        >
          <Tooltip title={record.id}>
            <Text code className={styles.id}>
              {record.idShort}
            </Text>
          </Tooltip>
        </button>
      ),
    },
    {
      title: 'Status',
      dataIndex: 'botStatus',
      key: 'botStatus',
      width: 130,
      sorter: (a: BotRow, b: BotRow) =>
        BOT_STATUS_ORDER[a.botStatus] - BOT_STATUS_ORDER[b.botStatus],
      render: (status: BotStatus, record: BotRow) => (
        <button
          type="button"
          className={`${styles.cellButton} ${styles.cellLink}`}
          onClick={() => goToBot(record.id, 'summary')}
        >
          <StatusBadge status={status} size="small" />
        </button>
      ),
    },
    {
      title: 'VM',
      dataIndex: 'vmName',
      key: 'vmName',
      width: 120,
      sorter: (a: BotRow, b: BotRow) => (a.vmName || '').localeCompare(b.vmName || ''),
      render: (value: string, record: BotRow) => (
        <button
          type="button"
          className={`${styles.cellButton} ${styles.cellLink}`}
          onClick={() => goToBot(record.id, 'vmInfo')}
        >
          <Text>{value || '-'}</Text>
        </button>
      ),
    },
    {
      title: 'Account',
      key: 'account',
      width: 220,
      sorter: (a: BotRow, b: BotRow) => (a.email || '').localeCompare(b.email || ''),
      render: (_: unknown, record: BotRow) => (
        <button
          type="button"
          className={`${styles.cellButton} ${styles.cellLink}`}
          onClick={() => goToBot(record.id, 'account')}
        >
          <Flex vertical gap={2}>
            <Text>{record.email || '-'}</Text>
            <Text type="secondary" className={styles.secondary}>
              {record.password || '-'}
            </Text>
          </Flex>
        </button>
      ),
    },
    {
      title: 'Character',
      key: 'character',
      width: 200,
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
          <button
            type="button"
            className={`${styles.cellButton} ${styles.cellLink}`}
            onClick={() => goToBot(record.id, 'character')}
          >
            <Flex vertical gap={2}>
              <Text strong>
                {record.characterName}
                {typeof record.level === 'number' ? ` (${record.level})` : ''}
              </Text>
              <Text type="secondary" className={styles.secondary}>
                {secondary}
              </Text>
            </Flex>
          </button>
        );
      },
    },
    {
      title: 'License',
      dataIndex: 'licenseStatusLabel',
      key: 'licenseStatus',
      width: 120,
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
      render: (_: unknown, record: BotRow) => {
        const isDeleting = Boolean(deletingBotIds[record.id]);
        return (
          <Flex justify="flex-start">
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
          </Flex>
        );
      },
    },
  ];
}
