import {
  getBotStatusIntent,
  getSemanticIntentColorToken,
  type SemanticStatusIntent,
} from '../../../shared/lib/statusSemantic';

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

export const ROOT_SECTION_KEYS = ['resources', 'workspace'] as const;

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
    | 'billing'
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
    | 'vms_unattend_profiles';
  sectionKind?: 'projects' | 'resources' | 'workspace';
  status?: BotStatus;
  selectable?: boolean;
  children?: TreeItem[];
}

export const statusConfig: Record<BotStatus, { title: string; intent: SemanticStatusIntent }> = {
  offline: { title: 'Offline', intent: getBotStatusIntent('offline') },
  prepare: { title: 'Prepare', intent: getBotStatusIntent('prepare') },
  leveling: { title: 'Leveling', intent: getBotStatusIntent('leveling') },
  profession: { title: 'Profession', intent: getBotStatusIntent('profession') },
  farming: { title: 'Farming', intent: getBotStatusIntent('farming') },
  banned: { title: 'Banned', intent: getBotStatusIntent('banned') },
};

export const getBotStatusColorToken = (status: BotStatus): string =>
  getSemanticIntentColorToken(statusConfig[status].intent);

export function isBotStatus(value: unknown): value is BotStatus {
  return typeof value === 'string' && Object.hasOwn(statusConfig, value);
}

export function sanitizeBotStatuses(value: unknown): BotStatus[] {
  if (!Array.isArray(value)) {
    return DEFAULT_VISIBLE_STATUSES;
  }
  const filtered = value.filter((status): status is BotStatus => isBotStatus(status));
  return filtered.length > 0 ? filtered : DEFAULT_VISIBLE_STATUSES;
}
