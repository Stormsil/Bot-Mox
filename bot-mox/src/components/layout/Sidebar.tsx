import React from 'react';
import { Layout, Menu } from 'antd';
import {
  DashboardOutlined,
  RobotOutlined,
  FolderOutlined,
  DollarOutlined,
  ContainerOutlined,
  FileTextOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import './Sidebar.css';

const { Sider } = Layout;

const menuItems = [
  {
    key: '/',
    icon: <DashboardOutlined />,
    label: 'Dashboard',
  },
  {
    key: '/bots',
    icon: <RobotOutlined />,
    label: 'Боты',
  },
  {
    key: '/projects',
    icon: <FolderOutlined />,
    label: 'Проекты',
  },
  {
    key: '/finance',
    icon: <DollarOutlined />,
    label: 'Финансы',
  },
  {
    key: '/archive',
    icon: <ContainerOutlined />,
    label: 'Архив',
  },
  {
    key: '/logs',
    icon: <FileTextOutlined />,
    label: 'Логи',
  },
  {
    key: '/settings',
    icon: <SettingOutlined />,
    label: 'Настройки',
  },
];

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleClick = (key: string) => {
    navigate(key);
  };

  return (
    <Sider
      className="proxmox-sidebar"
      width={260}
      collapsed={false}
    >
      <Menu
        mode="inline"
        selectedKeys={[location.pathname]}
        items={menuItems}
        className="proxmox-menu"
        onClick={({ key }) => handleClick(key)}
      />
    </Sider>
  );
};
