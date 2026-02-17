import React from 'react';
import { Segmented } from 'antd';
import {
  InfoCircleOutlined,
  AppstoreOutlined,
  EyeOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
  UnorderedListOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import styles from './ContentPanel.module.css';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

export type TabType = 'summary' | 'monitoring' | 'configure' | 'resources' | 'vmInfo' | 'transactions' | 'gold_price';

interface ContentPanelProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  children?: React.ReactNode;
  type?: 'bot' | 'datacenter' | 'project' | 'metrics' | 'finance';
  incompleteTabs?: TabType[];
  className?: string;
  hideTabs?: boolean;
}

type TabOption = { value: TabType; label: React.ReactNode };

// Табы для бота (новая структура)
const botTabMeta: Array<{ key: TabType; icon: React.ReactNode; label: string }> = [
  { key: 'summary', icon: <InfoCircleOutlined className={cx('tab-label-icon')} />, label: 'Summary' },
  { key: 'monitoring', icon: <EyeOutlined className={cx('tab-label-icon')} />, label: 'Monitoring' },
  { key: 'configure', icon: <SettingOutlined className={cx('tab-label-icon')} />, label: 'Configure' },
  { key: 'resources', icon: <AppstoreOutlined className={cx('tab-label-icon')} />, label: 'Resources' },
  { key: 'vmInfo', icon: <DesktopOutlined className={cx('tab-label-icon')} />, label: 'VM Info' },
];

const botTabs: TabOption[] = botTabMeta.map((tab) => ({
  value: tab.key,
  label: (
    <span className={cx('tab-label')}>
      {tab.icon}
      <span>{tab.label}</span>
    </span>
  ),
}));

// Табы для датацентра
const datacenterTabs: TabOption[] = [
  {
    value: 'summary',
    label: (
      <span className={cx('tab-label')}>
        <InfoCircleOutlined className={cx('tab-label-icon')} />
        <span>Summary</span>
      </span>
    ),
  },
];

// Табы для проекта
const projectTabs: TabOption[] = [
  {
    value: 'summary',
    label: (
      <span className={cx('tab-label')}>
        <InfoCircleOutlined className={cx('tab-label-icon')} />
        <span>Summary</span>
      </span>
    ),
  },
];

// Табы для метрик
const metricsTabs: TabOption[] = [
  {
    value: 'summary',
    label: (
      <span className={cx('tab-label')}>
        <InfoCircleOutlined className={cx('tab-label-icon')} />
        <span>Summary</span>
      </span>
    ),
  },
];

// Табы для финансов
const financeTabs: TabOption[] = [
  {
    value: 'summary',
    label: (
      <span className={cx('tab-label')}>
        <InfoCircleOutlined className={cx('tab-label-icon')} />
        <span>Summary</span>
      </span>
    ),
  },
  {
    value: 'transactions',
    label: (
      <span className={cx('tab-label')}>
        <UnorderedListOutlined className={cx('tab-label-icon')} />
        <span>Transactions</span>
      </span>
    ),
  },
];

const tabsMap: Record<NonNullable<ContentPanelProps['type']>, TabOption[]> = {
  bot: botTabs,
  datacenter: datacenterTabs,
  project: projectTabs,
  metrics: metricsTabs,
  finance: financeTabs,
};

// Function to create tabs with incomplete indicators
const createBotTabsWithWarnings = (incompleteTabs: TabType[] = []): TabOption[] => {
  return botTabMeta.map((tab) => {
    const isIncomplete = incompleteTabs.includes(tab.key);
    return {
      value: tab.key,
      label: (
        <span className={cx(`tab-label ${isIncomplete ? 'tab-label-warning' : ''}`)}>
          {tab.icon}
          <span>{tab.label}</span>
          {isIncomplete && <ExclamationCircleOutlined className={cx('tab-warning-icon')} />}
        </span>
      ),
    };
  });
};

export const ContentPanel: React.FC<ContentPanelProps> = ({
  activeTab = 'summary',
  onTabChange,
  children,
  type = 'datacenter',
  incompleteTabs = [],
  className,
  hideTabs = false,
}) => {
  const baseTabs = tabsMap[type] || datacenterTabs;
  const tabs = type === 'bot' && incompleteTabs.length > 0
    ? createBotTabsWithWarnings(incompleteTabs)
    : baseTabs;

  const handleTabChange = (key: string) => {
    onTabChange?.(key as TabType);
  };

  return (
    <div className={`${cx('content-panel')} ${className || ''}`}>
      {!hideTabs && (
        <div className={cx('content-tabs-nav')}>
          <Segmented
            className={cx('content-tabs-control')}
            size="small"
            block
            value={activeTab}
            onChange={(value) => handleTabChange(String(value))}
            options={tabs}
          />
        </div>
      )}
      <div className={cx('content-body')}>{children}</div>
    </div>
  );
};
