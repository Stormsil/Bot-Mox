import React from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import {
  InfoCircleOutlined,
  AppstoreOutlined,
  EyeOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
  UnorderedListOutlined,
  DesktopOutlined,
} from '@ant-design/icons';
import './ContentPanel.css';

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

// Табы для бота (новая структура)
const botTabMeta: Array<{ key: TabType; icon: React.ReactNode; label: string }> = [
  { key: 'summary', icon: <InfoCircleOutlined />, label: 'Summary' },
  { key: 'monitoring', icon: <EyeOutlined />, label: 'Monitoring' },
  { key: 'configure', icon: <SettingOutlined />, label: 'Configure' },
  { key: 'resources', icon: <AppstoreOutlined />, label: 'Resources' },
  { key: 'vmInfo', icon: <DesktopOutlined />, label: 'VM Info' },
];

const botTabs: TabsProps['items'] = botTabMeta.map((tab) => ({
  key: tab.key,
  label: (
    <span className="tab-label">
      {tab.icon}
      <span>{tab.label}</span>
    </span>
  ),
  children: null,
}));

// Табы для датацентра
const datacenterTabs: TabsProps['items'] = [
  {
    key: 'summary',
    label: (
      <span className="tab-label">
        <InfoCircleOutlined />
        <span>Summary</span>
      </span>
    ),
    children: null,
  },
];

// Табы для проекта
const projectTabs: TabsProps['items'] = [
  {
    key: 'summary',
    label: (
      <span className="tab-label">
        <InfoCircleOutlined />
        <span>Summary</span>
      </span>
    ),
    children: null,
  },
];

// Табы для метрик
const metricsTabs: TabsProps['items'] = [
  {
    key: 'summary',
    label: (
      <span className="tab-label">
        <InfoCircleOutlined />
        <span>Summary</span>
      </span>
    ),
    children: null,
  },
];

// Табы для финансов
const financeTabs: TabsProps['items'] = [
  {
    key: 'summary',
    label: (
      <span className="tab-label">
        <InfoCircleOutlined />
        <span>Summary</span>
      </span>
    ),
    children: null,
  },
  {
    key: 'transactions',
    label: (
      <span className="tab-label">
        <UnorderedListOutlined />
        <span>Transactions</span>
      </span>
    ),
    children: null,
  },
];

const tabsMap: Record<NonNullable<ContentPanelProps['type']>, TabsProps['items']> = {
  bot: botTabs,
  datacenter: datacenterTabs,
  project: projectTabs,
  metrics: metricsTabs,
  finance: financeTabs,
};

// Function to create tabs with incomplete indicators
const createBotTabsWithWarnings = (incompleteTabs: TabType[] = []): TabsProps['items'] => {
  return botTabMeta.map((tab) => {
    const isIncomplete = incompleteTabs.includes(tab.key);
    return {
      key: tab.key,
      label: (
        <span className={`tab-label ${isIncomplete ? 'tab-label-warning' : ''}`}>
          {tab.icon}
          <span>{tab.label}</span>
          {isIncomplete && <ExclamationCircleOutlined className="tab-warning-icon" />}
        </span>
      ),
      children: null,
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
    <div className={`content-panel ${className || ''}`}>
      {!hideTabs && (
        <div className="content-tabs-nav">
          <Tabs
            activeKey={activeTab}
            onChange={handleTabChange}
            items={tabs}
            type="card"
            className="content-tabs-ant"
            renderTabBar={(props, DefaultTabBar) => <DefaultTabBar {...props} />}
          />
        </div>
      )}
      <div className="content-body">{children}</div>
    </div>
  );
};
