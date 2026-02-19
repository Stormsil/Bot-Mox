import {
  ArrowLeftOutlined,
  BulbOutlined,
  DownOutlined,
  LogoutOutlined,
  MoonOutlined,
  SettingOutlined,
  UserOutlined,
} from '@ant-design/icons';
import { useGetIdentity, useLogout } from '@refinedev/core';
import { Avatar, Dropdown, Layout, Space, Switch, Tooltip, Typography } from 'antd';
import React, { useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useBotByIdQuery } from '../../entities/bot/api/useBotQueries';
import { useThemeRuntime } from '../../theme/themeRuntime';
import styles from './Header.module.css';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

const { Header: AntHeader } = Layout;
const { Text } = Typography;

interface BreadcrumbItem {
  label: string;
  to?: string;
}

interface BotBreadcrumbData {
  project_id?: string;
  status?: string;
  last_seen?: number;
  name?: string;
  character?: {
    name?: string;
  };
  vm?: {
    name?: string;
  };
}

interface BotBreadcrumbContext {
  botId: string;
  projectId?: string;
  projectLabel?: string;
  statusLabel?: string;
  label?: string;
}

const projectLabelMap: Record<string, string> = {
  wow_tbc: 'WoW TBC',
  wow_midnight: 'WoW Midnight',
};

const statusLabelMap: Record<string, string> = {
  offline: 'Offline',
  prepare: 'Prepare',
  leveling: 'Leveling',
  profession: 'Profession',
  farming: 'Farming',
  banned: 'Banned',
};

const tabLabelMap: Record<string, string> = {
  summary: 'Summary',
  monitoring: 'Monitoring',
  configure: 'Configure',
  resources: 'Resources',
  vmInfo: 'VM Info',
  transactions: 'Transactions',
  gold_price: 'Gold Price',
};

const subTabLabelMap: Record<string, string> = {
  schedule: 'Schedule',
  account: 'Account',
  character: 'Character',
  person: 'Person',
  license: 'License',
  proxy: 'Proxy',
  subscription: 'Subscription',
};

const OFFLINE_THRESHOLD_MS = 5 * 60 * 1000;

const formatStatusLabel = (status?: string) => {
  if (!status) return undefined;
  return statusLabelMap[status] || `${status.charAt(0).toUpperCase()}${status.slice(1)}`;
};

const computeBotStatus = (bot: BotBreadcrumbData): string | undefined => {
  if (bot.status === 'banned') return 'banned';
  if (typeof bot.last_seen === 'number' && Date.now() - bot.last_seen > OFFLINE_THRESHOLD_MS) {
    return 'offline';
  }
  return bot.status;
};

export const Header: React.FC = () => {
  const { themeMode, setThemeMode } = useThemeRuntime();
  const { data: user } = useGetIdentity();
  const { mutate: logout } = useLogout();
  const isDark = themeMode === 'dark';
  const location = useLocation();
  const navigate = useNavigate();
  const activeBotId = useMemo(() => {
    const path = location.pathname;
    return path.startsWith('/bot/') ? path.replace('/bot/', '') : '';
  }, [location.pathname]);
  const botBreadcrumbQuery = useBotByIdQuery(activeBotId);

  const menuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Settings',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Sign out',
      onClick: () => logout(),
    },
  ];

  useEffect(() => {
    if (botBreadcrumbQuery.error) {
      console.error('Error loading bot breadcrumb:', botBreadcrumbQuery.error);
    }
  }, [botBreadcrumbQuery.error]);

  const botContext = useMemo<BotBreadcrumbContext | null>(() => {
    if (!activeBotId) {
      return null;
    }

    const fallback: BotBreadcrumbContext = {
      botId: activeBotId,
      label: `Bot ${activeBotId.slice(0, 8)}`,
    };

    if (botBreadcrumbQuery.error) {
      return fallback;
    }

    const bot = botBreadcrumbQuery.data;
    if (!bot) {
      return fallback;
    }

    const projectId = bot.project_id;
    const projectLabel = projectId ? projectLabelMap[projectId] || projectId : undefined;
    const status = computeBotStatus(bot);
    const statusLabel = formatStatusLabel(status);
    const displayName = bot.character?.name || bot.name || bot.vm?.name || 'Bot';
    const vmName = bot.vm?.name || 'VM';
    const label = `${displayName} (${vmName})_${activeBotId.slice(0, 8)}`;

    return {
      botId: activeBotId,
      projectId,
      projectLabel,
      statusLabel,
      label,
    };
  }, [activeBotId, botBreadcrumbQuery.data, botBreadcrumbQuery.error]);

  const breadcrumbs = useMemo<BreadcrumbItem[]>(() => {
    const path = location.pathname;
    const searchParams = new URLSearchParams(location.search);
    const tabKey = searchParams.get('tab') || undefined;
    const subTabKey = searchParams.get('subtab') || undefined;
    let tabLabel = tabKey ? tabLabelMap[tabKey] || undefined : undefined;
    let subTabLabel = subTabKey ? subTabLabelMap[subTabKey] || subTabKey : undefined;

    if (!tabLabel && tabKey && subTabLabelMap[tabKey]) {
      subTabLabel = subTabLabelMap[tabKey];
      if (['schedule', 'account', 'character', 'person'].includes(tabKey)) {
        tabLabel = tabLabelMap.configure;
      } else if (['license', 'proxy', 'subscription'].includes(tabKey)) {
        tabLabel = tabLabelMap.resources;
      }
    }

    if (!tabLabel && tabKey === 'lifeStages') {
      tabLabel = tabLabelMap.monitoring;
    }
    if (path === '/') {
      return [{ label: 'Overview' }];
    }
    if (path.startsWith('/project/')) {
      const projectId = path.replace('/project/', '');
      const projectStatus = formatStatusLabel(searchParams.get('status') || undefined);
      return [
        { label: 'Projects', to: '/' },
        { label: projectLabelMap[projectId] || projectId },
        ...(projectStatus ? [{ label: projectStatus }] : []),
      ];
    }
    if (path.startsWith('/bot/')) {
      const botId = path.replace('/bot/', '');
      const botLabel = botContext?.label || `Bot ${botId.slice(0, 8)}`;
      const projectCrumb = botContext?.projectId
        ? {
            label: botContext.projectLabel || botContext.projectId,
            to: `/project/${botContext.projectId}`,
          }
        : null;
      const statusCrumb = botContext?.statusLabel ? { label: botContext.statusLabel } : null;
      return [
        { label: 'Projects', to: '/' },
        ...(projectCrumb ? [projectCrumb] : []),
        ...(statusCrumb ? [statusCrumb] : []),
        { label: botLabel },
        ...(tabLabel ? [{ label: tabLabel }] : []),
        ...(subTabLabel ? [{ label: subTabLabel }] : []),
      ];
    }
    if (path.startsWith('/licenses')) {
      return [{ label: 'Resources' }, { label: 'Licenses' }];
    }
    if (path.startsWith('/proxies')) {
      return [{ label: 'Resources' }, { label: 'Proxies' }];
    }
    if (path.startsWith('/subscriptions')) {
      return [{ label: 'Resources' }, { label: 'Subscriptions' }];
    }
    if (path.startsWith('/vms/list')) {
      return [{ label: 'Resources' }, { label: 'Virtual Machines' }, { label: 'VM List' }];
    }
    if (path.startsWith('/vms/sites/proxmox') || path.startsWith('/vms/proxmox')) {
      return [
        { label: 'Resources' },
        { label: 'Virtual Machines' },
        { label: 'Sites' },
        { label: 'Proxmox' },
      ];
    }
    if (path.startsWith('/vms/sites/tinyfm') || path.startsWith('/vms/tinyfm')) {
      return [
        { label: 'Resources' },
        { label: 'Virtual Machines' },
        { label: 'Sites' },
        { label: 'TinyFileManager' },
      ];
    }
    if (path.startsWith('/vms/sites/syncthing') || path.startsWith('/vms/syncthing')) {
      return [
        { label: 'Resources' },
        { label: 'Virtual Machines' },
        { label: 'Sites' },
        { label: 'SyncThing' },
      ];
    }
    if (path.startsWith('/vms/sites')) {
      return [{ label: 'Resources' }, { label: 'Virtual Machines' }, { label: 'Sites' }];
    }
    if (path.startsWith('/vms')) {
      return [{ label: 'Resources' }, { label: 'Virtual Machines' }, { label: 'VM Generator' }];
    }
    if (path.startsWith('/notes/reminders')) {
      return [{ label: 'Workspace' }, { label: 'Calendar & Reminders' }];
    }
    if (path.startsWith('/notes')) {
      return [{ label: 'Workspace' }, { label: 'Notes' }];
    }
    if (path.startsWith('/finance')) {
      return [{ label: 'Finance' }];
    }
    if (path.startsWith('/settings')) {
      return [{ label: 'Settings' }];
    }
    if (path.startsWith('/archive')) {
      return [
        { label: 'Projects', to: '/' },
        { label: 'Archive', to: '/archive/banned' },
        { label: 'Banned History' },
      ];
    }
    return [{ label: 'Overview' }];
  }, [location.pathname, location.search, botContext]);

  return (
    <AntHeader className={cx('proxmox-header')}>
      <div className={cx('header-left')}>
        <div className={cx('header-path')}>
          <button
            type="button"
            className={cx('path-back')}
            onClick={() => navigate(-1)}
            aria-label="Back"
            title="Back"
          >
            <ArrowLeftOutlined />
          </button>
          <div className={cx('path-breadcrumbs')}>
            {breadcrumbs.map((crumb, index) => {
              const isLast = index === breadcrumbs.length - 1;
              const isClickable = Boolean(crumb.to) && !isLast;
              return (
                <React.Fragment key={`${crumb.label}-${index}`}>
                  {isClickable ? (
                    <button
                      type="button"
                      className={cx('path-crumb')}
                      onClick={() => {
                        if (crumb.to) {
                          navigate(crumb.to);
                        }
                      }}
                    >
                      {crumb.label}
                    </button>
                  ) : (
                    <span className={cx(`path-crumb ${isLast ? 'current' : 'muted'}`)}>
                      {crumb.label}
                    </span>
                  )}
                  {!isLast && <span className={cx('path-sep')}>/</span>}
                </React.Fragment>
              );
            })}
          </div>
        </div>
      </div>

      <div className={cx('header-right')}>
        <Space size="large">
          <Tooltip title={isDark ? 'Dark theme' : 'Light theme'}>
            <Switch
              checked={isDark}
              onChange={(checked) => setThemeMode(checked ? 'dark' : 'light')}
              checkedChildren={<MoonOutlined />}
              unCheckedChildren={<BulbOutlined />}
              style={{
                background: isDark
                  ? 'var(--boxmox-color-brand-primary)'
                  : 'var(--boxmox-color-header-hover)',
              }}
            />
          </Tooltip>
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Space className={cx('user-menu')}>
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{ backgroundColor: 'var(--boxmox-color-brand-primary)' }}
              />
              <Text className={cx('user-email')}>{user?.email || 'admin@botmox.local'}</Text>
              <DownOutlined className={cx('dropdown-icon')} />
            </Space>
          </Dropdown>
        </Space>
      </div>
    </AntHeader>
  );
};
