import React, { useState, useEffect, useCallback } from 'react';
import { Tree, Button, Spin } from 'antd';
import type { TreeDataNode, TreeProps } from 'antd';
import {
  DatabaseOutlined,
  DesktopOutlined,
  UserOutlined,
  AreaChartOutlined,
  DollarOutlined,
  FolderOutlined,
  SettingOutlined,
  ExclamationCircleOutlined,
  PlayCircleOutlined,
  StopOutlined,
  ClockCircleOutlined,
  ToolOutlined,
  PoweroffOutlined,
  DownOutlined,
  RightOutlined,
  KeyOutlined,
  GlobalOutlined,
  CreditCardOutlined,
  FileTextOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { ref, onValue, off } from 'firebase/database';
import { database } from '../../utils/firebase';
import './ResourceTree.css';

// Новые типы статусов бота
export type BotStatus = 'offline' | 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';

// Интерфейс для бота из Firebase
interface BotData {
  id: string;
  project_id: 'wow_tbc' | 'wow_midnight';
  status: BotStatus;
  character: {
    name: string;
    level: number;
    race: string;
    class: string;
  };
  vm?: {
    name: string;
  };
}

// Интерфейс для бота в дереве
interface BotItem {
  id: string;
  key: string;
  title: string;
  status: BotStatus;
}

// Интерфейс для группы статусов
interface StatusGroup {
  key: string;
  title: string;
  status: BotStatus;
  count: number;
  children: BotItem[];
}

// Интерфейс для элемента дерева
interface TreeItem {
  key: string;
  title: string;
  type: 'datacenter' | 'project' | 'bot' | 'metrics' | 'finance' | 'archive' | 'system' | 'logs' | 'settings' | 'status_group' | 'licenses' | 'proxies' | 'subscriptions' | 'notes';
  status?: BotStatus;
  children?: TreeItem[];
}

// Конфигурация статусов без эмодзи
const statusConfig: Record<BotStatus, { title: string; color: string }> = {
  offline: { title: 'Offline', color: '#8c8c8c' },
  prepare: { title: 'Prepare', color: '#1890ff' },
  leveling: { title: 'Leveling', color: '#722ed1' },
  profession: { title: 'Profession', color: '#eb2f96' },
  farming: { title: 'Farming', color: '#52c41a' },
  banned: { title: 'Banned', color: '#f5222d' },
};

// Группировка ботов по статусам
const groupBotsByStatus = (bots: BotItem[]): StatusGroup[] => {
  const groups: Record<BotStatus, BotItem[]> = {
    offline: [],
    prepare: [],
    leveling: [],
    profession: [],
    farming: [],
    banned: [],
  };

  bots.forEach(bot => {
    groups[bot.status].push(bot);
  });

  return (Object.keys(groups) as BotStatus[])
    .filter(status => groups[status].length > 0)
    .map(status => ({
      key: status,
      title: statusConfig[status].title,
      status,
      count: groups[status].length,
      children: groups[status],
    }));
};

// Получение иконки по типу
const getIcon = (type: TreeItem['type'], status?: BotStatus) => {
  const iconStyle = { fontSize: 14 };

  switch (type) {
    case 'datacenter':
      return <DatabaseOutlined style={{ ...iconStyle, color: 'var(--proxmox-accent)' }} />;
    case 'project':
      return <DesktopOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    case 'bot':
      return getBotIcon(status);
    case 'status_group':
      return getBotIcon(status);
    case 'metrics':
      return <AreaChartOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    case 'finance':
      return <DollarOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    case 'archive':
      return <FolderOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    case 'system':
    case 'settings':
      return <SettingOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    case 'logs':
      return <ExclamationCircleOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    case 'licenses':
      return <KeyOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    case 'proxies':
      return <GlobalOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    case 'subscriptions':
      return <CreditCardOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    case 'notes':
      return <FileTextOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-secondary)' }} />;
    default:
      return <DesktopOutlined style={iconStyle} />;
  }
};

// Получение иконки статуса бота
const getBotIcon = (status?: BotStatus) => {
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
      return <UserOutlined style={{ ...iconStyle, color: 'var(--proxmox-text-muted)' }} />;
  }
};

// Преобразование данных в формат TreeDataNode
const convertToTreeData = (items: TreeItem[]): TreeDataNode[] => {
  return items.map((item) => ({
    key: item.key,
    title: (
      <span className="resource-tree-node">
        <span className="resource-tree-icon">{getIcon(item.type, item.status)}</span>
        <span className="resource-tree-title">{item.title}</span>
      </span>
    ),
    children: item.children ? convertToTreeData(item.children) : undefined,
  }));
};

export const ResourceTree: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [expandedKeys, setExpandedKeys] = useState<React.Key[]>([]);
  const [selectedKeys, setSelectedKeys] = useState<React.Key[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [bots, setBots] = useState<Record<string, BotData>>({});
  const [loading, setLoading] = useState(true);
  
  // Фильтры статусов
  const [visibleStatuses, setVisibleStatuses] = useState<BotStatus[]>(() => {
    const saved = localStorage.getItem('resourceTreeFilters');
    if (saved) {
      return JSON.parse(saved);
    }
    // По умолчанию все кроме banned и offline
    return ['prepare', 'leveling', 'profession', 'farming'];
  });

  // Загрузка ботов из Firebase с realtime обновлениями
  useEffect(() => {
    setLoading(true);
    const botsRef = ref(database, 'bots');

    const handleValue = (snapshot: any) => {
      const data = snapshot.val();
      if (data) {
        setBots(data);
      } else {
        setBots({});
      }
      setLoading(false);
    };

    const handleError = (error: Error) => {
      console.error('Error loading bots:', error);
      setLoading(false);
    };

    onValue(botsRef, handleValue, handleError);

    return () => {
      off(botsRef, 'value', handleValue);
    };
  }, []);

  // Преобразование ботов из Firebase в формат дерева
  const getBotsForProject = useCallback((projectId: string): BotItem[] => {
    return Object.entries(bots)
      .filter(([_, bot]: [string, BotData]) => bot.project_id === projectId)
      .map(([id, bot]: [string, BotData]) => ({
        id,
        key: id,
        title: `${bot.character.name} (${bot.vm?.name || 'No VM'}) - ${id.substring(0, 8)}`,
        status: bot.status,
      }));
  }, [bots]);

  // Формирование данных дерева
  const buildTreeData = useCallback((visibleStatuses: BotStatus[]): TreeItem[] => {
    const tbcBots = getBotsForProject('wow_tbc');
    const midnightBots = getBotsForProject('wow_midnight');
    
    const tbcGroups = groupBotsByStatus(tbcBots).filter(g => visibleStatuses.includes(g.status));
    const midnightGroups = groupBotsByStatus(midnightBots).filter(g => visibleStatuses.includes(g.status));

    const buildProjectChildren = (groups: StatusGroup[], projectId: string): TreeItem[] => {
      return groups.map(group => ({
        key: `status_${projectId}_${group.key}`,
        title: `${group.title} (${group.count})`,
        type: 'status_group' as const,
        status: group.status,
        children: group.children.map(bot => ({
          key: bot.key,
          title: bot.title,
          type: 'bot' as const,
          status: bot.status,
        })),
      }));
    };

    return [
      {
        key: 'datacenter',
        title: 'Bot-Mox Datacenter',
        type: 'datacenter',
        children: [
          {
            key: 'project_wow_tbc',
            title: `WoW TBC (${tbcBots.length})`,
            type: 'project',
            children: buildProjectChildren(tbcGroups, 'wow_tbc'),
          },
          {
            key: 'project_wow_midnight',
            title: `WoW Midnight (${midnightBots.length})`,
            type: 'project',
            children: buildProjectChildren(midnightGroups, 'wow_midnight'),
          },
          {
            key: 'finance',
            title: 'Finance',
            type: 'finance',
          },
          {
            key: 'notes',
            title: 'Notes',
            type: 'notes',
          },
          {
            key: 'licenses',
            title: 'Licenses',
            type: 'licenses',
          },
          {
            key: 'proxies',
            title: 'Proxies',
            type: 'proxies',
          },
          {
            key: 'subscriptions',
            title: 'Subscriptions',
            type: 'subscriptions',
          },
          {
            key: 'settings',
            title: 'Settings',
            type: 'settings',
          },
          {
            key: 'archive',
            title: 'Archive',
            type: 'archive',
            children: [
              { key: 'archive_banned', title: 'Banned History', type: 'archive' },
            ],
          },
        ],
      },
    ];
  }, [getBotsForProject]);

  // Сохранение фильтров
  useEffect(() => {
    localStorage.setItem('resourceTreeFilters', JSON.stringify(visibleStatuses));
  }, [visibleStatuses]);

  // Загрузка состояния из localStorage
  useEffect(() => {
    const savedExpanded = localStorage.getItem('resourceTreeExpanded');
    if (savedExpanded) {
      setExpandedKeys(JSON.parse(savedExpanded));
    } else {
      // При первом запуске раскрываем все, кроме группы banned
      // Собираем все ключи для раскрытия
      const allKeysToExpand: string[] = ['datacenter', 'project_wow_tbc', 'project_wow_midnight'];
      
      // Добавляем все статус-группы, кроме banned
      const tbcGroups = groupBotsByStatus(getBotsForProject('wow_tbc'))
        .filter(g => g.status !== 'banned');
      const midnightGroups = groupBotsByStatus(getBotsForProject('wow_midnight'))
        .filter(g => g.status !== 'banned');
      
      tbcGroups.forEach(g => allKeysToExpand.push(`status_wow_tbc_${g.status}`));
      midnightGroups.forEach(g => allKeysToExpand.push(`status_wow_midnight_${g.status}`));
      
      setExpandedKeys(allKeysToExpand);
    }
  }, [bots]); // Добавляем bots в зависимости, чтобы обновлялось при загрузке данных

  // Сохранение состояния в localStorage
  useEffect(() => {
    localStorage.setItem('resourceTreeExpanded', JSON.stringify(expandedKeys));
  }, [expandedKeys]);

  // Обновление выбранного ключа при изменении URL
  useEffect(() => {
    const path = location.pathname;
    if (path === '/') {
      setSelectedKeys(['datacenter']);
    } else if (path.startsWith('/bot/')) {
      const botId = path.replace('/bot/', '');
      setSelectedKeys([botId]);
    } else if (path.startsWith('/project/')) {
      const projectId = path.replace('/project/', '');
      setSelectedKeys([projectId]);
    } else if (path === '/finance') {
      setSelectedKeys(['finance']);
    } else if (path === '/settings') {
      setSelectedKeys(['settings']);
    } else if (path === '/notes') {
      setSelectedKeys(['notes']);
    } else if (path === '/archive/banned') {
      setSelectedKeys(['archive_banned']);
    } else if (path === '/licenses') {
      setSelectedKeys(['licenses']);
    } else if (path === '/proxies') {
      setSelectedKeys(['proxies']);
    } else if (path === '/subscriptions') {
      setSelectedKeys(['subscriptions']);
    }
  }, [location.pathname]);

  const onExpand: TreeProps['onExpand'] = (expandedKeysValue) => {
    setExpandedKeys(expandedKeysValue);
  };

  const onSelect: TreeProps['onSelect'] = (selectedKeysValue, info) => {
    const key = info.node.key as string;
    setSelectedKeys(selectedKeysValue);

    // Навигация в зависимости от типа элемента
    if (key === 'datacenter') {
      navigate('/');
    } else if (key.startsWith('bot_') || (bots[key])) {
      navigate(`/bot/${key}`);
    } else if (key.startsWith('project_')) {
      const projectId = key.replace('project_', '');
      navigate(`/project/${projectId}`);
    } else if (key === 'finance') {
      navigate('/finance');
    } else if (key === 'settings') {
      navigate('/settings');
    } else if (key === 'notes') {
      navigate('/notes');
    } else if (key === 'archive_banned') {
      navigate('/archive/banned');
    } else if (key === 'licenses') {
      navigate('/licenses');
    } else if (key === 'proxies') {
      navigate('/proxies');
    } else if (key === 'subscriptions') {
      navigate('/subscriptions');
    }
  };

  const toggleStatus = (status: BotStatus) => {
    setVisibleStatuses(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    );
  };

  const treeData = buildTreeData(visibleStatuses);
  const treeDataNodes = convertToTreeData(treeData);

  if (loading) {
    return (
      <div className="resource-tree-container">
        <div className="resource-tree-loading">
          <Spin size="small" />
          <span>Loading bots...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="resource-tree-container">
      <div className="resource-tree-header">
        <span className="resource-tree-header-title">Resource Tree</span>
      </div>
      
      {/* Компактная панель фильтров */}
      <div className="resource-tree-filters-compact">
        <Button 
          type="text" 
          size="small"
          className="filters-toggle-btn"
          onClick={() => setShowFilters(!showFilters)}
          icon={showFilters ? <DownOutlined /> : <RightOutlined />}
        >
          Filters
        </Button>
        
        {showFilters && (
          <div className="filters-panel">
            {(Object.keys(statusConfig) as BotStatus[]).map(status => (
              <button
                key={status}
                className={`filter-chip ${visibleStatuses.includes(status) ? 'active' : ''}`}
                onClick={() => toggleStatus(status)}
                style={{ '--status-color': statusConfig[status].color } as React.CSSProperties}
              >
                <span className="filter-chip-indicator" />
                <span className="filter-chip-label">{statusConfig[status].title}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <Tree
        className="resource-tree"
        treeData={treeDataNodes}
        expandedKeys={expandedKeys}
        selectedKeys={selectedKeys}
        onExpand={onExpand}
        onSelect={onSelect}
        showLine={{ showLeafIcon: false }}
        showIcon={false}
        blockNode
      />
    </div>
  );
};
