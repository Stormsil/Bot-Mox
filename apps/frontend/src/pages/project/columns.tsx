import { DeleteOutlined } from '@ant-design/icons';

import type { BotStatus } from '../../shared/types';
import {
  createActionsRenderer,
  createStatusWithSecondaryRenderer,
  AppFlex as Flex,
  AppPopconfirm as Popconfirm,
  resolveStatusIntentFromColor,
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

export function createProjectColumns({
  goToBot,
  deletingBotIds,
  onDeleteAccount,
}: {
  goToBot: (botId: string, tab?: string) => void;
  deletingBotIds: Record<string, boolean>;
  onDeleteAccount: (botId: string) => void | Promise<void>;
}) {
  const renderLicenseStatus = createStatusWithSecondaryRenderer<BotRow, string>({
    getLabel: (_value, record) => record.licenseStatusLabel,
    getIntent: (_value, record) => resolveStatusIntentFromColor(record.licenseStatusColor),
    getSecondaryText: (_value, record) => formatDaysRemaining(record.licenseDaysRemaining),
    onClick: (record) => goToBot(record.id, 'license'),
    buttonClassName: `${styles.cellButton} ${styles.cellLink}`,
    secondaryClassName: styles.secondary,
    tagClassName: styles.statusTag,
  });

  const renderProxyStatus = createStatusWithSecondaryRenderer<BotRow, string>({
    getLabel: (_value, record) => record.proxyStatusLabel,
    getIntent: (_value, record) => resolveStatusIntentFromColor(record.proxyStatusColor),
    getSecondaryText: (_value, record) => formatDaysRemaining(record.proxyDaysRemaining),
    onClick: (record) => goToBot(record.id, 'proxy'),
    buttonClassName: `${styles.cellButton} ${styles.cellLink}`,
    secondaryClassName: styles.secondary,
    tagClassName: styles.statusTag,
  });

  const renderSubscriptionStatus = createStatusWithSecondaryRenderer<BotRow, string>({
    getLabel: (_value, record) => record.subscriptionStatusLabel,
    getIntent: (_value, record) => resolveStatusIntentFromColor(record.subscriptionStatusColor),
    getSecondaryText: (_value, record) => formatDaysRemaining(record.subscriptionDaysRemaining),
    onClick: (record) => goToBot(record.id, 'subscription'),
    buttonClassName: `${styles.cellButton} ${styles.cellLink}`,
    secondaryClassName: styles.secondary,
    tagClassName: styles.statusTag,
  });

  const renderActions = createActionsRenderer<BotRow>({
    renderActions: (record) => {
      const isDeleting = Boolean(deletingBotIds[record.id]);
      return (
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
      );
    },
    renderContainer: (actions) => <Flex justify="flex-start">{actions}</Flex>,
  });

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
      render: renderLicenseStatus,
    },
    {
      title: 'Proxy',
      dataIndex: 'proxyStatusLabel',
      key: 'proxyStatus',
      width: 120,
      sorter: (a: BotRow, b: BotRow) => a.proxySort - b.proxySort,
      render: renderProxyStatus,
    },
    {
      title: 'Subscribe',
      dataIndex: 'subscriptionStatusLabel',
      key: 'subscriptionStatus',
      width: 140,
      sorter: (a: BotRow, b: BotRow) => a.subscriptionSort - b.subscriptionSort,
      render: renderSubscriptionStatus,
    },
    {
      title: 'Action',
      key: 'action',
      width: 140,
      align: 'left' as const,
      render: renderActions,
    },
  ];
}
