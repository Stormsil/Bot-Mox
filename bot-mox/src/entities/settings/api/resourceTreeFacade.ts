import type { BotStatus } from '../../../types';
import { readSettingsPath, writeSettingsPath } from './settingsPathClient';

const RESOURCE_TREE_SETTINGS_PATH = 'ui/resource_tree';

const ALLOWED_STATUSES: BotStatus[] = [
  'offline',
  'prepare',
  'leveling',
  'profession',
  'farming',
  'banned',
];

export interface ResourceTreeSettingsPayload {
  expandedKeys: string[];
  visibleStatuses: BotStatus[];
  showFilters: boolean;
  updated_at?: number;
}

interface ResourceTreeSettingsResponse {
  expandedKeys?: unknown;
  visibleStatuses?: unknown;
  showFilters?: unknown;
  updated_at?: unknown;
}

function normalizeVisibleStatuses(input: unknown): BotStatus[] {
  if (!Array.isArray(input)) return [];
  return input.filter((status): status is BotStatus =>
    ALLOWED_STATUSES.includes(status as BotStatus),
  );
}

function normalizeExpandedKeys(input: unknown): string[] {
  if (!Array.isArray(input)) return [];
  return input.map((item) => String(item || '').trim()).filter(Boolean);
}

export async function fetchResourceTreeSettings(): Promise<ResourceTreeSettingsPayload | null> {
  const source = await readSettingsPath<ResourceTreeSettingsResponse>(RESOURCE_TREE_SETTINGS_PATH);

  if (!source || typeof source !== 'object') {
    return null;
  }

  const normalized: ResourceTreeSettingsPayload = {
    expandedKeys: normalizeExpandedKeys(source.expandedKeys),
    visibleStatuses: normalizeVisibleStatuses(source.visibleStatuses),
    showFilters: typeof source.showFilters === 'boolean' ? source.showFilters : true,
  };

  if (typeof source.updated_at === 'number') {
    normalized.updated_at = source.updated_at;
  }

  return normalized;
}

export async function saveResourceTreeSettings(
  payload: ResourceTreeSettingsPayload,
): Promise<void> {
  await writeSettingsPath(RESOURCE_TREE_SETTINGS_PATH, payload);
}
