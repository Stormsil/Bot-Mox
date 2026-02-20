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
import { buildBotContext, buildBreadcrumbs } from './header/breadcrumbs';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

const { Header: AntHeader } = Layout;
const { Text } = Typography;

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

  const botContext = useMemo(
    () => buildBotContext(activeBotId, botBreadcrumbQuery.data, Boolean(botBreadcrumbQuery.error)),
    [activeBotId, botBreadcrumbQuery.data, botBreadcrumbQuery.error],
  );

  const breadcrumbs = useMemo(
    () => buildBreadcrumbs(location.pathname, location.search, botContext),
    [location.pathname, location.search, botContext],
  );

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
