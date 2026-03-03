import {
  CopyOutlined,
  DeleteOutlined,
  EditOutlined,
  RobotOutlined,
  SyncOutlined,
} from '@ant-design/icons';
import { DeleteButton, EditButton } from '@refinedev/antd';

import type { ColumnsType } from 'antd/es/table';
import dayjs from 'dayjs';
import type React from 'react';
import { getFraudScoreColor } from '../../entities/resources/api/ipqsFacade';
import type { Proxy as ProxyResource } from '../../entities/resources/model/types';
import {
  AppButton as Button,
  AppProgress as Progress,
  AppTag as Tag,
  AppTypography as Typography,
} from '../../shared/ui';
import { TableActionButton, TableActionGroup } from '../../shared/ui/TableActionButton';
import styles from './ProxiesPage.module.css';

const { Text } = Typography;
type TagIntent = 'success' | 'warning' | 'error' | 'info' | 'default';

const headerTitle = (text: string) => (
  <span
    style={{ textTransform: 'uppercase', letterSpacing: '0.5px', fontSize: 11, fontWeight: 600 }}
  >
    {text}
  </span>
);

const tagStyle: React.CSSProperties = {
  borderRadius: 2,
  fontSize: 10,
  fontWeight: 500,
  padding: '0 6px',
  textTransform: 'uppercase',
  margin: 0,
};

export interface ProxyWithBot extends ProxyResource {
  botName?: string;
  botCharacter?: string;
  botVMName?: string;
}

interface BuildProxyColumnsParams {
  checkingProxyId: string | null;
  isExpired: (expiresAt: number) => boolean;
  isExpiringSoon: (expiresAt: number) => boolean;
  copyProxyString: (proxy: ProxyResource, event?: React.MouseEvent) => void;
  handleRecheckIPQS: (proxy: ProxyWithBot) => void;
  onEdit: (proxyId: string) => void;
}

export function buildProxyColumns({
  checkingProxyId,
  isExpired,
  isExpiringSoon,
  copyProxyString,
  handleRecheckIPQS,
  onEdit,
}: BuildProxyColumnsParams): ColumnsType<ProxyWithBot> {
  return [
    {
      title: headerTitle('Status'),
      dataIndex: 'status',
      key: 'status',
      width: 85,
      render: (status: string, record: ProxyWithBot) => {
        let intent: TagIntent = 'default';
        let text = status;

        if (isExpired(record.expires_at)) {
          intent = 'error';
          text = 'EXPIRED';
        } else if (isExpiringSoon(record.expires_at)) {
          intent = 'warning';
        } else if (status === 'active') {
          intent = 'success';
        } else if (status === 'banned') {
          intent = 'error';
        }

        return (
          <Tag bordered={false} intent={intent} style={tagStyle}>
            {text.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: headerTitle(''),
      key: 'proxy',
      render: (_: unknown, record: ProxyWithBot) => (
        <div className={styles.proxyCell}>
          <Button
            type="text"
            size="small"
            className={styles.proxyCopyBtn}
            onClick={(e) => copyProxyString(record, e)}
            icon={<CopyOutlined />}
          >
            <Text code className={styles.proxyCopyText}>
              {record.ip}:{record.port}
            </Text>
          </Button>
          <Text code type="secondary" className={styles.proxyCredentials}>
            {record.login}:{record.password}
          </Text>
        </div>
      ),
    },
    {
      title: headerTitle('Location'),
      key: 'location',
      width: 100,
      render: (_: unknown, record: ProxyWithBot) => {
        const countryCode = (record.country_code || record.country || '')
          .toString()
          .trim()
          .toUpperCase();

        return (
          <div className={styles.locationCell}>
            <Text strong>{countryCode}</Text>
            <div className={styles.inlineTags}>
              {record.vpn && (
                <Tag bordered={false} intent="warning" style={{ ...tagStyle, fontSize: 9 }}>
                  VPN
                </Tag>
              )}
              {record.proxy && (
                <Tag bordered={false} intent="info" style={{ ...tagStyle, fontSize: 9 }}>
                  PROXY
                </Tag>
              )}
              {record.tor && (
                <Tag bordered={false} intent="error" style={{ ...tagStyle, fontSize: 9 }}>
                  TOR
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: headerTitle('Fraud Score'),
      dataIndex: 'fraud_score',
      key: 'fraud_score',
      width: 110,
      render: (score: number | undefined, record: ProxyWithBot) => {
        const hasBeenChecked = record.last_checked && record.last_checked > 0;
        const actualScore = typeof score === 'number' ? score : 0;

        if (!hasBeenChecked) {
          return (
            <Tag bordered={false} intent="default" style={tagStyle}>
              UNKNOWN
            </Tag>
          );
        }

        return (
          <div className={styles.fraudCell}>
            <div className={styles.fraudScoreCell}>
              <Progress
                percent={actualScore}
                size="small"
                strokeColor={getFraudScoreColor(actualScore)}
                trailColor="var(--botmox-color-surface-muted)"
                strokeLinecap="round"
                format={(percent) => (
                  <span
                    style={{
                      color: getFraudScoreColor(actualScore),
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    {percent}
                  </span>
                )}
              />
            </div>
            <div className={styles.inlineTags}>
              {record.vpn && (
                <Tag bordered={false} intent="warning" style={{ ...tagStyle, fontSize: 9 }}>
                  VPN
                </Tag>
              )}
              {record.proxy && (
                <Tag bordered={false} intent="info" style={{ ...tagStyle, fontSize: 9 }}>
                  PROXY
                </Tag>
              )}
              {record.tor && (
                <Tag bordered={false} intent="error" style={{ ...tagStyle, fontSize: 9 }}>
                  TOR
                </Tag>
              )}
            </div>
          </div>
        );
      },
    },
    {
      title: headerTitle('Bot'),
      key: 'bot',
      width: 280,
      render: (_: unknown, record: ProxyWithBot) => (
        <div style={{ textAlign: 'left' }}>
          <Typography.Paragraph style={{ marginBottom: 0 }}>
            <RobotOutlined style={{ marginRight: 4, color: 'var(--botmox-color-brand-primary)' }} />
            <Text code>{record.bot_id}</Text>
          </Typography.Paragraph>
          <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
            {record.botCharacter || record.botName}
            {record.botVMName && ` (${record.botVMName})`}
          </Text>
        </div>
      ),
    },
    {
      title: headerTitle('Expires'),
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 100,
      render: (expiresAt: number) => {
        const expired = isExpired(expiresAt);
        const expiringSoon = isExpiringSoon(expiresAt);

        return (
          <Text
            style={{
              color: expired
                ? 'var(--botmox-color-status-danger)'
                : expiringSoon
                  ? 'var(--botmox-color-status-warning)'
                  : undefined,
              fontSize: 12,
              lineHeight: 1.4,
            }}
          >
            {dayjs(expiresAt).format('DD.MM.YYYY')}
          </Text>
        );
      },
    },
    {
      title: headerTitle('Days Left'),
      key: 'days_left',
      width: 60,
      render: (_: unknown, record: ProxyWithBot) => {
        const expired = isExpired(record.expires_at);
        const expiringSoon = isExpiringSoon(record.expires_at);
        const daysLeft = Math.ceil((record.expires_at - Date.now()) / (1000 * 60 * 60 * 24));

        return (
          <Text
            style={{
              color: expired
                ? 'var(--botmox-color-status-danger)'
                : expiringSoon
                  ? 'var(--botmox-color-status-warning)'
                  : 'var(--botmox-color-status-success)',
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {expired ? '0' : daysLeft}
          </Text>
        );
      },
    },
    {
      title: headerTitle('Actions'),
      key: 'actions',
      width: 130,
      render: (_: unknown, record: ProxyWithBot) => (
        <div className={styles.actionsCell}>
          <TableActionGroup>
            <TableActionButton
              icon={<SyncOutlined spin={checkingProxyId === record.id} />}
              onClick={() => handleRecheckIPQS(record)}
              disabled={checkingProxyId === record.id}
              tooltip="Recheck IPQS"
            />
            <EditButton
              hideText
              size="small"
              shape="circle"
              icon={<EditOutlined />}
              resource="proxies"
              recordItemId={record.id}
              onClick={(event) => {
                event.preventDefault();
                onEdit(String(record.id));
              }}
            />
            <TableActionButton
              icon={<CopyOutlined />}
              onClick={() => copyProxyString(record)}
              tooltip="Copy"
            />
            <DeleteButton
              hideText
              size="small"
              shape="circle"
              icon={<DeleteOutlined />}
              resource="proxies"
              recordItemId={record.id}
              confirmTitle="Delete Proxy?"
              confirmOkText="Delete"
              confirmCancelText="Cancel"
              successNotification={() => ({
                message: 'Proxy deleted',
                type: 'success',
              })}
              errorNotification={() => ({
                message: 'Failed to delete proxy',
                type: 'error',
              })}
            />
          </TableActionGroup>
        </div>
      ),
    },
  ];
}
