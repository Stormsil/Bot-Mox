import type { TreeDataNode } from 'antd';
import {
  AppstoreOutlined,
  DatabaseOutlined,
  DesktopOutlined,
  HomeOutlined,
  CalendarOutlined,
  UserOutlined,
  DollarOutlined,
  FolderOutlined,
  SettingOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  PoweroffOutlined,
  RobotOutlined,
  GlobalOutlined,
  CreditCardOutlined,
  FileTextOutlined,
  CloudServerOutlined,
} from '@ant-design/icons';
import type { BotItem, BotStatus, StatusGroup, TreeItem } from './types';
import { isBotStatus, statusConfig } from './types';

export const groupBotsByStatus = (bots: BotItem[]): StatusGroup[] => {
  const groups: Record<BotStatus, BotItem[]> = {
    offline: [],
    prepare: [],
    leveling: [],
    profession: [],
    farming: [],
    banned: [],
  };

  bots.forEach((bot) => {
    groups[bot.status].push(bot);
  });

  return (Object.keys(groups) as BotStatus[])
    .filter((status) => groups[status].length > 0)
    .map((status) => ({
      key: status,
      title: statusConfig[status].title,
      status,
      count: groups[status].length,
      children: groups[status],
    }));
};

export const getBotIcon = (status?: BotStatus) => {
  const iconStyle = { fontSize: 12 };

  switch (status) {
    case 'offline':
      return <PoweroffOutlined style={{ ...iconStyle, color: '#8c8c8c' }} />;
    case 'prepare':
      return <ClockCircleOutlined style={{ ...iconStyle, color: '#1890ff' }} />;
    case 'leveling':
      return <PlayCircleOutlined style={{ ...iconStyle, color: '#722ed1' }} />;
    case 'profession':
      return <ToolOutlined style={{ ...iconStyle, color: '#eb2f96' }} />;
    case 'farming':
      return <PlayCircleOutlined style={{ ...iconStyle, color: '#52c41a' }} />;
    case 'banned':
      return <StopOutlined style={{ ...iconStyle, color: '#f5222d' }} />;
    default:
      return <UserOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-muted)' }} />;
  }
};

export const getIcon = (type: TreeItem['type'], status?: BotStatus, sectionKind?: TreeItem['sectionKind']) => {
  const iconStyle = { fontSize: 14 };

  switch (type) {
    case 'section': {
      switch (sectionKind) {
        case 'projects':
          return <DatabaseOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
        case 'resources':
          return <AppstoreOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
        case 'workspace':
          return <FolderOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
        default:
          return <FolderOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
      }
    }
    case 'folder':
      return <FolderOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'datacenter':
      return <HomeOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'project':
      return <DesktopOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'bot':
      return getBotIcon(status);
    case 'status_group':
      return getBotIcon(status);
    case 'finance':
      return <DollarOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'archive':
      return <FolderOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'settings':
      return <SettingOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'licenses':
      return <RobotOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'proxies':
      return <GlobalOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'subscriptions':
      return <CreditCardOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'notes':
      return <FileTextOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'workspace_calendar':
      return <CalendarOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'workspace_kanban':
      return <AppstoreOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    case 'vms':
    case 'vms_list':
    case 'vms_sites':
    case 'vms_site_proxmox':
    case 'vms_site_tinyfm':
    case 'vms_site_syncthing':
      return <CloudServerOutlined style={{ ...iconStyle, color: 'var(--boxmox-color-text-secondary)' }} />;
    default:
      return <DesktopOutlined style={iconStyle} />;
  }
};

export const convertToTreeData = (items: TreeItem[], cx: (classNames: string) => string): TreeDataNode[] =>
  items.map((item) => ({
    key: item.key,
    selectable: item.selectable ?? true,
    title: (
      <span className={cx('resource-tree-node')}>
        <span className={cx('resource-tree-icon')}>{getIcon(item.type, item.status, item.sectionKind)}</span>
        <span className={cx('resource-tree-title')}>{item.title}</span>
      </span>
    ),
    children: item.children ? convertToTreeData(item.children, cx) : undefined,
  }));

export const findNodePath = (
  items: TreeItem[],
  targetKey: string,
  path: string[] = []
): { path: string[]; node: TreeItem } | null => {
  for (const item of items) {
    const nextPath = [...path, item.key];
    if (item.key === targetKey) {
      return { path: nextPath, node: item };
    }
    if (item.children && item.children.length > 0) {
      const found = findNodePath(item.children, targetKey, nextPath);
      if (found) {
        return found;
      }
    }
  }
  return null;
};

export const collectExpandableKeys = (items: TreeItem[], keys: string[] = []): string[] => {
  items.forEach((item) => {
    if (item.children && item.children.length > 0) {
      keys.push(item.key);
      collectExpandableKeys(item.children, keys);
    }
  });
  return keys;
};

export const isProjectsBranchKey = (key: string) =>
  key === 'projects' || key.startsWith('project_') || key.startsWith('status_');

export const formatProjectLabel = (projectId: string): string =>
  projectId
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());

export const parseStatusGroupKey = (key: string): { projectId: string; status: BotStatus } | null => {
  const match = /^status_(.+)_(offline|prepare|leveling|profession|farming|banned)$/.exec(key);
  if (!match) {
    return null;
  }
  return {
    projectId: match[1],
    status: match[2] as BotStatus,
  };
};

export const getProjectStatusFromSearch = (search: string): BotStatus | null => {
  const status = new URLSearchParams(search).get('status');
  if (!status) return null;
  return isBotStatus(status) ? status : null;
};

export const getSelectedKeysForLocation = (pathname: string, search: string): string[] => {
  if (pathname === '/') return ['datacenter'];
  if (pathname.startsWith('/bot/')) return [pathname.replace('/bot/', '')];
  if (pathname.startsWith('/project/')) {
    const projectId = pathname.replace('/project/', '');
    const status = getProjectStatusFromSearch(search);
    return [status ? `status_${projectId}_${status}` : `project_${projectId}`];
  }
  if (pathname === '/finance') return ['finance'];
  if (pathname === '/settings') return ['settings'];
  if (pathname === '/notes') return ['notes'];
  if (pathname === '/workspace/calendar' || pathname === '/notes/reminders') return ['workspace_calendar'];
  if (pathname === '/workspace/kanban') return ['workspace_kanban'];
  if (pathname === '/licenses') return ['licenses'];
  if (pathname === '/proxies') return ['proxies'];
  if (pathname === '/subscriptions') return ['subscriptions'];
  if (pathname === '/vms') return ['vms'];
  if (pathname === '/vms/list') return ['vms'];
  if (pathname === '/vms/unattend-profiles') return ['vms'];
  if (pathname === '/vms/sites/proxmox' || pathname === '/vms/proxmox') return ['vms_site_proxmox'];
  if (pathname === '/vms/sites/tinyfm' || pathname === '/vms/tinyfm') return ['vms_site_tinyfm'];
  if (pathname === '/vms/sites/syncthing' || pathname === '/vms/syncthing') return ['vms_site_syncthing'];
  return [];
};
