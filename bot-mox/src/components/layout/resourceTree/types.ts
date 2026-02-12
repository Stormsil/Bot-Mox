export type BotStatus = 'offline' | 'prepare' | 'leveling' | 'profession' | 'farming' | 'banned';

export const SHOW_FILTERS_KEY = 'resourceTreeShowFilters';
export const RESOURCE_TREE_WIDTH_KEY = 'resourceTreeWidth';
export const RESOURCE_TREE_COLLAPSED_KEY = 'resourceTreeCollapsed';
export const DEFAULT_TREE_WIDTH = 280;
export const MIN_TREE_WIDTH = 220;
export const MAX_TREE_WIDTH = 460;
export const COLLAPSED_TREE_WIDTH = 48;

export const DEFAULT_VISIBLE_STATUSES: BotStatus[] = [
  'offline',
  'prepare',
  'leveling',
  'profession',
  'farming',
  'banned',
];

export const ROOT_SECTION_KEYS = [
  'resources',
  'workspace',
] as const;

export interface BotItem {
  id: string;
  key: string;
  title: string;
  status: BotStatus;
}

export interface StatusGroup {
  key: string;
  title: string;
  status: BotStatus;
  count: number;
  children: BotItem[];
}

export interface TreeItem {
  key: string;
  title: string;
  type:
    | 'section'
    | 'folder'
    | 'datacenter'
    | 'project'
    | 'bot'
    | 'finance'
    | 'archive'
    | 'settings'
    | 'status_group'
    | 'licenses'
    | 'proxies'
    | 'subscriptions'
    | 'notes'
    | 'workspace_calendar'
    | 'workspace_kanban'
    | 'vms'
    | 'vms_list'
    | 'vms_sites'
    | 'vms_site_proxmox'
    | 'vms_site_tinyfm'
    | 'vms_site_syncthing';
  sectionKind?: 'projects' | 'resources' | 'workspace';
  status?: BotStatus;
  selectable?: boolean;
  children?: TreeItem[];
}

export const statusConfig: Record<BotStatus, { title: string; color: string }> = {
  offline: { title: 'Offline', color: '#8c8c8c' },
  prepare: { title: 'Prepare', color: '#1890ff' },
  leveling: { title: 'Leveling', color: '#722ed1' },
  profession: { title: 'Profession', color: '#eb2f96' },
  farming: { title: 'Farming', color: '#52c41a' },
  banned: { title: 'Banned', color: '#f5222d' },
};

export function isBotStatus(value: unknown): value is BotStatus {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(statusConfig, value);
}

export function sanitizeBotStatuses(value: unknown): BotStatus[] {
  if (!Array.isArray(value)) {
    return DEFAULT_VISIBLE_STATUSES;
  }
  const filtered = value.filter((status): status is BotStatus => isBotStatus(status));
  return filtered.length > 0 ? filtered : DEFAULT_VISIBLE_STATUSES;
}
