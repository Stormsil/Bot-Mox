import React from 'react';
import { Card, Typography, Empty, Space } from 'antd';
import { DesktopOutlined } from '@ant-design/icons';
import type { Bot } from '../../types';
import dayjs from 'dayjs';
import './BotVMInfo.css';

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
      <div className="bot-vm-info">
        <Card className="vm-card">
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
    <div className="bot-vm-info">
      <Card
        className="vm-card"
        title={
          <Space>
            <DesktopOutlined />
            <span>VM Information</span>
          </Space>
        }
      >
        <div className="vm-content">
          <div className="vm-field">
            <Text type="secondary" className="field-label">VM Name</Text>
            <Text strong>{vm.name}</Text>
          </div>

          <div className="vm-field">
            <Text type="secondary" className="field-label">IP Address</Text>
            <Text strong className="vm-ip" copyable>
              {vm.ip}
            </Text>
          </div>

          <div className="vm-field">
            <Text type="secondary" className="field-label">Created At</Text>
            <Text>{formattedCreatedAt}</Text>
          </div>
        </div>
      </Card>
    </div>
  );
};
