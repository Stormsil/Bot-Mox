import React from 'react';
import { Button, Progress, Space, Tag, Typography } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import { CopyOutlined, DeleteOutlined, EditOutlined, RobotOutlined, SyncOutlined } from '@ant-design/icons';
import dayjs from 'dayjs';
import type { Proxy } from '../../types';
import { getFraudScoreColor } from '../../services/ipqsService';
import { TableActionButton, TableActionGroup } from '../../components/ui/TableActionButton';

const { Text } = Typography;

export interface ProxyWithBot extends Proxy {
  botName?: string;
  botCharacter?: string;
  botVMName?: string;
}

interface BuildProxyColumnsParams {
  checkingProxyId: string | null;
  isExpired: (expiresAt: number) => boolean;
  isExpiringSoon: (expiresAt: number) => boolean;
  copyProxyString: (proxy: Proxy, event?: React.MouseEvent) => void;
  handleRecheckIPQS: (proxy: ProxyWithBot) => void;
  openEditModal: (proxy?: ProxyWithBot) => void;
  handleDelete: (proxy: ProxyWithBot) => void;
}

export function buildProxyColumns({
  checkingProxyId,
  isExpired,
  isExpiringSoon,
  copyProxyString,
  handleRecheckIPQS,
  openEditModal,
  handleDelete,
}: BuildProxyColumnsParams): ColumnsType<ProxyWithBot> {
  return [
    {
      title: 'Status',
      dataIndex: 'status',
      key: 'status',
      width: 85,
      render: (status: string, record: ProxyWithBot) => {
        let color = 'default';
        let text = status;

        if (isExpired(record.expires_at)) {
          color = 'error';
          text = 'EXPIRED';
        } else if (isExpiringSoon(record.expires_at)) {
          color = 'warning';
        } else if (status === 'active') {
          color = 'success';
        } else if (status === 'banned') {
          color = 'red';
        }

        return (
          <Tag color={color}>
            {text.toUpperCase()}
          </Tag>
        );
      },
    },
    {
      title: 'Proxy',
      key: 'proxy',
      render: (_: unknown, record: ProxyWithBot) => (
        <Space direction="vertical" size={2}>
          <Button
            type="text"
            size="small"
            className="proxy-copy-btn"
            onClick={(e) => copyProxyString(record, e)}
            icon={<CopyOutlined />}
          >
            <Text strong>
              {record.ip}:{record.port}
            </Text>
          </Button>
          <Text type="secondary" className="proxy-credentials">
            {record.login}:{record.password}
          </Text>
        </Space>
      ),
    },
    {
      title: 'Location',
      key: 'location',
      width: 100,
      render: (_: unknown, record: ProxyWithBot) => {
        const countryCode = (record.country_code || record.country || '').toString().trim().toUpperCase();

        return (
          <Space direction="vertical" size={0}>
            <Space size={4}>
              <Text strong>{countryCode}</Text>
            </Space>
            <Space size={4}>
              {record.vpn && <Tag color="orange" style={{ fontSize: 9, margin: 0 }}>VPN</Tag>}
              {record.proxy && <Tag color="blue" style={{ fontSize: 9, margin: 0 }}>PROXY</Tag>}
              {record.tor && <Tag color="red" style={{ fontSize: 9, margin: 0 }}>TOR</Tag>}
            </Space>
          </Space>
        );
      },
    },
    {
      title: 'Fraud Score',
      dataIndex: 'fraud_score',
      key: 'fraud_score',
      width: 110,
      render: (score: number | undefined, record: ProxyWithBot) => {
        const hasBeenChecked = record.last_checked && record.last_checked > 0;
        const actualScore = typeof score === 'number' ? score : 0;

        if (!hasBeenChecked) {
          return (
            <Tag color="default" style={{ fontSize: 10, margin: 0 }}>
              Unknown
            </Tag>
          );
        }

        return (
          <div style={{ display: 'flex', alignItems: 'center', height: '100%' }}>
            <Space direction="vertical" size={2} style={{ width: '100%', alignItems: 'center' }}>
              <div className="fraud-score-cell">
                <Progress
                  percent={actualScore}
                  size="small"
                  strokeColor={getFraudScoreColor(actualScore)}
                  trailColor="var(--boxmox-color-surface-muted)"
                  format={(percent) => (
                    <span style={{
                      color: getFraudScoreColor(actualScore),
                      fontSize: 11,
                      fontWeight: 600,
                    }}>
                      {percent}
                    </span>
                  )}
                />
              </div>
              <Space size={4}>
                {record.vpn && <Tag color="orange" style={{ fontSize: 9, margin: 0 }}>VPN</Tag>}
                {record.proxy && <Tag color="blue" style={{ fontSize: 9, margin: 0 }}>PROXY</Tag>}
                {record.tor && <Tag color="red" style={{ fontSize: 9, margin: 0 }}>TOR</Tag>}
              </Space>
            </Space>
          </div>
        );
      },
    },
    {
      title: 'Bot',
      key: 'bot',
      width: 280,
      render: (_: unknown, record: ProxyWithBot) => (
        <div style={{ textAlign: 'left' }}>
          <Text style={{ fontSize: '12px', fontWeight: 500, display: 'block' }}>
            <RobotOutlined style={{ marginRight: 4, color: 'var(--boxmox-color-brand-primary)' }} />
            {record.bot_id}
          </Text>
          <Text type="secondary" style={{ fontSize: '11px', display: 'block' }}>
            {record.botCharacter || record.botName}
            {record.botVMName && ` (${record.botVMName})`}
          </Text>
        </div>
      ),
    },
    {
      title: 'Expires',
      dataIndex: 'expires_at',
      key: 'expires_at',
      width: 100,
      render: (expiresAt: number) => {
        const expired = isExpired(expiresAt);
        const expiringSoon = isExpiringSoon(expiresAt);

        return (
          <Text
            style={{
              color: expired ? '#ff4d4f' : expiringSoon ? '#faad14' : undefined,
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
      title: 'Days Left',
      key: 'days_left',
      width: 60,
      render: (_: unknown, record: ProxyWithBot) => {
        const expired = isExpired(record.expires_at);
        const expiringSoon = isExpiringSoon(record.expires_at);
        const daysLeft = Math.ceil((record.expires_at - Date.now()) / (1000 * 60 * 60 * 24));

        return (
          <Text
            style={{
              color: expired ? '#ff4d4f' : expiringSoon ? '#faad14' : '#52c41a',
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
      title: 'Actions',
      key: 'actions',
      width: 130,
      render: (_: unknown, record: ProxyWithBot) => (
        <TableActionGroup>
          <TableActionButton
            icon={<SyncOutlined spin={checkingProxyId === record.id} />}
            onClick={() => handleRecheckIPQS(record)}
            disabled={checkingProxyId === record.id}
            tooltip="Recheck IPQS"
          />
          <TableActionButton icon={<EditOutlined />} onClick={() => openEditModal(record)} tooltip="Edit" />
          <TableActionButton icon={<CopyOutlined />} onClick={() => copyProxyString(record)} tooltip="Copy" />
          <TableActionButton danger icon={<DeleteOutlined />} onClick={() => handleDelete(record)} tooltip="Delete" />
        </TableActionGroup>
      ),
    },
  ];
}
