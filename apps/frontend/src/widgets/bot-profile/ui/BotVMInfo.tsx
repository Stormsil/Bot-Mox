import { DesktopOutlined } from '@ant-design/icons';

import dayjs from 'dayjs';
import type React from 'react';
import type { Bot } from '../../../shared/types';
import {
  AppCard as Card,
  AppEmpty as Empty,
  AppFlex as Flex,
  AppSpace as Space,
  AppTypography as Typography,
} from '../../../shared/ui';
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
      <Flex vertical className={styles['bot-vm-info']}>
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
      </Flex>
    );
  }

  return (
    <Flex vertical className={styles['bot-vm-info']}>
      <Card
        className={styles['vm-card']}
        title={
          <Space>
            <DesktopOutlined />
            <span className={styles['vm-card-title']}>VM Information</span>
          </Space>
        }
      >
        <Flex vertical className={styles['vm-content']} gap={16}>
          <Flex vertical className={styles['vm-field']} gap={4}>
            <Text type="secondary" className={styles['field-label']}>
              VM Name
            </Text>
            <Text strong>{vm.name}</Text>
          </Flex>

          <Flex vertical className={styles['vm-field']} gap={4}>
            <Text type="secondary" className={styles['field-label']}>
              IP Address
            </Text>
            <Text strong className={styles['vm-ip']} copyable>
              {vm.ip}
            </Text>
          </Flex>

          <Flex vertical className={styles['vm-field']} gap={4}>
            <Text type="secondary" className={styles['field-label']}>
              Created At
            </Text>
            <Text>{formattedCreatedAt}</Text>
          </Flex>
        </Flex>
      </Card>
    </Flex>
  );
};
