import {
  ContainerOutlined,
  DashboardOutlined,
  DollarOutlined,
  FileTextOutlined,
  FolderOutlined,
  RobotOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { Layout, Menu } from 'antd';
import type React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './Sidebar.module.css';

function cx(classNames: string): string {
  return classNames
    .split(' ')
    .filter(Boolean)
    .map((name) => styles[name] || name)
    .join(' ');
}

const { Sider } = Layout;

const iconStyle = { fontSize: 16 };

function menuLabel(text: string, icon: React.ReactNode, selected: boolean) {
  return (
    <div className={cx(`menu-item ${selected ? 'menu-item-selected' : ''}`)}>
      <span className={cx('menu-item-icon')} aria-hidden="true">
        {icon}
      </span>
      <span className={cx('menu-item-text')}>{text}</span>
    </div>
  );
}

export const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  const handleClick = (key: string) => {
    navigate(key);
  };

  const selectedKey = location.pathname;
  const menuItems = [
    {
      key: '/',
      label: menuLabel('Dashboard', <DashboardOutlined style={iconStyle} />, selectedKey === '/'),
    },
    {
      key: '/bots',
      label: menuLabel('Боты', <RobotOutlined style={iconStyle} />, selectedKey === '/bots'),
    },
    {
      key: '/projects',
      label: menuLabel(
        'Проекты',
        <FolderOutlined style={iconStyle} />,
        selectedKey === '/projects',
      ),
    },
    {
      key: '/finance',
      label: menuLabel('Финансы', <DollarOutlined style={iconStyle} />, selectedKey === '/finance'),
    },
    {
      key: '/archive',
      label: menuLabel(
        'Архив',
        <ContainerOutlined style={iconStyle} />,
        selectedKey === '/archive',
      ),
    },
    {
      key: '/logs',
      label: menuLabel('Логи', <FileTextOutlined style={iconStyle} />, selectedKey === '/logs'),
    },
    {
      key: '/settings',
      label: menuLabel(
        'Настройки',
        <SettingOutlined style={iconStyle} />,
        selectedKey === '/settings',
      ),
    },
  ];

  return (
    <Sider className={cx('proxmox-sidebar')} width={260} collapsed={false}>
      <Menu
        mode="inline"
        selectedKeys={[selectedKey]}
        items={menuItems}
        className={cx('proxmox-menu')}
        onClick={({ key }) => handleClick(key)}
      />
    </Sider>
  );
};
