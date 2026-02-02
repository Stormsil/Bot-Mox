import React from 'react';
import { Layout, Space, Avatar, Dropdown, Typography } from 'antd';
import { UserOutlined, DownOutlined, SettingOutlined, LogoutOutlined, DatabaseOutlined } from '@ant-design/icons';
import { useGetIdentity, useLogout } from '@refinedev/core';
import './Header.css';

const { Header: AntHeader } = Layout;
const { Text } = Typography;

export const Header: React.FC = () => {
  const { data: user } = useGetIdentity();
  const { mutate: logout } = useLogout();

  const menuItems = [
    {
      key: 'settings',
      icon: <SettingOutlined />,
      label: 'Настройки',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: 'Выйти',
      onClick: () => logout(),
    },
  ];

  return (
    <AntHeader className="proxmox-header">
      <div className="header-left">
        <div className="proxmox-logo">
          <DatabaseOutlined className="logo-icon" />
          <span className="logo-text">Bot-Mox</span>
          <span className="logo-version">v1.0</span>
        </div>
      </div>

      <div className="header-right">
        <Space size="large">
          <Dropdown menu={{ items: menuItems }} placement="bottomRight">
            <Space className="user-menu">
              <Avatar
                size="small"
                icon={<UserOutlined />}
                style={{ backgroundColor: 'var(--proxmox-accent)' }}
              />
              <Text className="user-email">
                {user?.email || 'admin@botmox.local'}
              </Text>
              <DownOutlined className="dropdown-icon" />
            </Space>
          </Dropdown>
        </Space>
      </div>
    </AntHeader>
  );
};
