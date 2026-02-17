import React from 'react';
import { Card, Typography, Empty, Space } from 'antd';
import { DesktopOutlined } from '@ant-design/icons';
import type { Bot } from '../../types';
import dayjs from 'dayjs';
import styles from './BotVMInfo.module.css';

const { Text } = Typography;

// VM данные
export interface VMData {
  name: string;
  ip: string;
  created_at: string;
}

// Расширенный интерфейс бота с полем vm
export interface ExtendedBot extends Bot {
  vm?: VMData;
}

interface BotVMInfoProps {
  bot: ExtendedBot;
}

const formatVmCreatedAt = (createdAt?: string): string => {
  if (!createdAt) return '—';

  const direct = dayjs(createdAt);
  if (direct.isValid()) {
    return direct.format('YYYY-MM-DD HH:mm');
  }

  const numeric = Number(createdAt);
  if (Number.isFinite(numeric)) {
    const numericDate = dayjs(numeric);
    if (numericDate.isValid()) {
      return numericDate.format('YYYY-MM-DD HH:mm');
    }
  }

  return '—';
};

export const BotVMInfo: React.FC<BotVMInfoProps> = ({ bot }) => {
  const vm = bot.vm;
  const formattedCreatedAt = formatVmCreatedAt(vm?.created_at);

  if (!vm) {
    return (
      <div className={styles['bot-vm-info']}>
        <Card className={styles['vm-card']}>
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={
              <span>
                <Text type="secondary">No VM assigned to this bot</Text>
              </span>
            }
          />
        </Card>
      </div>
    );
  }

  return (
    <div className={styles['bot-vm-info']}>
      <Card
        className={styles['vm-card']}
        styles={{
          header: {
            background: 'var(--boxmox-color-surface-muted)',
            borderBottom: '1px solid var(--boxmox-color-border-default)',
          },
          title: {
            color: 'var(--boxmox-color-text-primary)',
          },
        }}
        title={
          <Space>
            <DesktopOutlined />
            <span>VM Information</span>
          </Space>
        }
      >
        <div className={styles['vm-content']}>
          <div className={styles['vm-field']}>
            <Text type="secondary" className={styles['field-label']}>VM Name</Text>
            <Text strong>{vm.name}</Text>
          </div>

          <div className={styles['vm-field']}>
            <Text type="secondary" className={styles['field-label']}>IP Address</Text>
            <Text strong className={styles['vm-ip']} copyable>
              {vm.ip}
            </Text>
          </div>

          <div className={styles['vm-field']}>
            <Text type="secondary" className={styles['field-label']}>Created At</Text>
            <Text>{formattedCreatedAt}</Text>
          </div>
        </div>
      </Card>
    </div>
  );
};
