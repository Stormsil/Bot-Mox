import React from 'react';
import { Tabs } from 'antd';
import type { TabsProps } from 'antd';
import {
  InfoCircleOutlined,
  UserOutlined,
  FileTextOutlined,
  CalendarOutlined,
  MailOutlined,
  IdcardOutlined,
  KeyOutlined,
  GlobalOutlined,
  CreditCardOutlined,
  ExclamationCircleOutlined,
  SyncOutlined,
  UnorderedListOutlined,
} from '@ant-design/icons';
import './ContentPanel.css';

export type TabType = 'summary' | 'schedule' | 'character' | 'lifeStages' | 'account' | 'person' | 'logs' | 'license' | 'proxy' | 'subscription' | 'transactions';

interface ContentPanelProps {
  activeTab?: TabType;
  onTabChange?: (tab: TabType) => void;
  children?: React.ReactNode;
  type?: 'bot' | 'datacenter' | 'project' | 'metrics' | 'finance';
  incompleteTabs?: TabType[];
}

// Табы для бота (новая структура)
const botTabs: TabsProps['items'] = [
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
    key: 'schedule',
    label: (
      <span className="tab-label">
        <CalendarOutlined />
        <span>Schedule</span>
      </span>
    ),
    children: null,
  },
  {
    key: 'lifeStages',
    label: (
      <span className="tab-label">
        <SyncOutlined />
        <span>Life Stages</span>
      </span>
    ),
    children: null,
  },
  {
    key: 'character',
    label: (
      <span className="tab-label">
        <UserOutlined />
        <span>Character</span>
      </span>
    ),
    children: null,
  },
  {
    key: 'account',
    label: (
      <span className="tab-label">
        <MailOutlined />
        <span>Account</span>
      </span>
    ),
    children: null,
  },
  {
    key: 'person',
    label: (
      <span className="tab-label">
        <IdcardOutlined />
        <span>Person</span>
      </span>
    ),
    children: null,
  },
  {
    key: 'logs',
    label: (
      <span className="tab-label">
        <FileTextOutlined />
        <span>Logs</span>
      </span>
    ),
    children: null,
  },
  {
    key: 'license',
    label: (
      <span className="tab-label">
        <KeyOutlined />
        <span>License</span>
      </span>
    ),
    children: null,
  },
  {
    key: 'proxy',
    label: (
      <span className="tab-label">
        <GlobalOutlined />
        <span>Proxy</span>
      </span>
    ),
    children: null,
  },
  {
    key: 'subscription',
    label: (
      <span className="tab-label">
        <CreditCardOutlined />
        <span>Subscription</span>
      </span>
    ),
    children: null,
  },
];

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

// Icon mapping for tabs
const tabIcons: Record<TabType, React.ReactNode> = {
  summary: <InfoCircleOutlined />,
  schedule: <CalendarOutlined />,
  lifeStages: <SyncOutlined />,
  character: <UserOutlined />,
  account: <MailOutlined />,
  person: <IdcardOutlined />,
  logs: <FileTextOutlined />,
  license: <KeyOutlined />,
  proxy: <GlobalOutlined />,
  subscription: <CreditCardOutlined />,
  transactions: <UnorderedListOutlined />,
};

// Tab labels mapping
const tabLabels: Record<TabType, string> = {
  summary: 'Summary',
  schedule: 'Schedule',
  lifeStages: 'Стадии жизни',
  character: 'Character',
  account: 'Account',
  person: 'Person',
  logs: 'Logs',
  license: 'License',
  proxy: 'Proxy',
  subscription: 'Subscription',
  transactions: 'Transactions',
};

// Function to create tabs with incomplete indicators
const createBotTabsWithWarnings = (incompleteTabs: TabType[] = []): TabsProps['items'] => {
  return (Object.keys(tabIcons) as TabType[]).map(key => {
    const isIncomplete = incompleteTabs.includes(key);
    return {
      key,
      label: (
        <span className={`tab-label ${isIncomplete ? 'tab-label-warning' : ''}`}>
          {tabIcons[key]}
          <span>{tabLabels[key]}</span>
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
}) => {
  const baseTabs = tabsMap[type] || datacenterTabs;
  const tabs = type === 'bot' && incompleteTabs.length > 0
    ? createBotTabsWithWarnings(incompleteTabs)
    : baseTabs;

  const handleTabChange = (key: string) => {
    onTabChange?.(key as TabType);
  };

  return (
    <div className="content-panel">
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
      <div className="content-body">{children}</div>
    </div>
  );
};
