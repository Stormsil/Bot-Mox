import { apiGet, apiPatch, apiPut, createPollingSubscription } from './apiClient';
import { uiLogger } from '../observability/uiLogger'

export const PROJECT_SETTINGS_PATH = 'settings/projects';

export interface ProjectSettings {
  id: string;
  name: string;
  game?: string;
  expansion?: string;
  max_level?: number;
  currency?: string;
  currency_symbol?: string;
  server_region?: string;
  professions?: string[];
  referenceData?: unknown;
  created_at?: number;
  updated_at?: number;
  [key: string]: unknown;
}

const DEFAULT_PROJECTS: Record<string, ProjectSettings> = {
  wow_tbc: {
    id: 'wow_tbc',
    name: 'WoW TBC',
    game: 'World of Warcraft',
    expansion: 'The Burning Crusade',
    max_level: 70,
    currency: 'gold',
    currency_symbol: 'g',
    server_region: 'Europe',
    professions: [],
  },
  wow_midnight: {
    id: 'wow_midnight',
    name: 'WoW Midnight',
    game: 'World of Warcraft',
    expansion: 'Midnight',
    max_level: 80,
    currency: 'gold',
    currency_symbol: 'g',
    server_region: 'Europe',
    professions: [],
  },
};

const normalizeProjects = (raw: unknown): Record<string, ProjectSettings> => {
  if (!raw || typeof raw !== 'object') {
    return DEFAULT_PROJECTS;
  }

  const source = raw as Record<string, unknown>;
  const normalized: Record<string, ProjectSettings> = {};

  for (const [projectId, value] of Object.entries(source)) {
    const item = (value ?? {}) as Record<string, unknown>;
    normalized[projectId] = {
      id: typeof item.id === 'string' ? item.id : projectId,
      name: typeof item.name === 'string' && item.name.trim() ? item.name : projectId,
      game: typeof item.game === 'string' ? item.game : undefined,
      expansion: typeof item.expansion === 'string' ? item.expansion : undefined,
      max_level: typeof item.max_level === 'number' ? item.max_level : undefined,
      currency: typeof item.currency === 'string' ? item.currency : undefined,
      currency_symbol: typeof item.currency_symbol === 'string' ? item.currency_symbol : undefined,
      server_region: typeof item.server_region === 'string' ? item.server_region : undefined,
      professions: Array.isArray(item.professions)
        ? item.professions.filter((entry): entry is string => typeof entry === 'string')
        : undefined,
      referenceData: item.referenceData,
      created_at: typeof item.created_at === 'number' ? item.created_at : undefined,
      updated_at: typeof item.updated_at === 'number' ? item.updated_at : undefined,
      ...item,
    };
  }

  return Object.keys(normalized).length > 0 ? normalized : DEFAULT_PROJECTS;
};

export const getProjectSettings = async (): Promise<Record<string, ProjectSettings>> => {
  try {
    const response = await apiGet<unknown>('/api/v1/settings/projects');
    return normalizeProjects(response.data);
  } catch (error) {
    uiLogger.error('Error loading project settings:', error);
    return DEFAULT_PROJECTS;
  }
};

export const subscribeToProjectSettings = (
  callback: (projects: Record<string, ProjectSettings>) => void,
  onError?: (error: Error) => void
): (() => void) => {
  return createPollingSubscription(getProjectSettings, callback, onError, {
    key: 'settings:projects',
    intervalMs: 8000,
    immediate: true,
  });
};

export const upsertProjectSettings = async (
  projectId: string,
  payload: Partial<ProjectSettings>
): Promise<void> => {
  const id = projectId.trim();
  if (!id) {
    throw new Error('Project id is required');
  }

  const existingProjects = await getProjectSettings();
  const existing = existingProjects[id];
  const now = Date.now();

  const updates: ProjectSettings = {
    ...existing,
    ...payload,
    id,
    name: payload.name?.trim() || existing?.name || id,
    updated_at: now,
    created_at: existing?.created_at ?? now,
  } as ProjectSettings;

  await apiPut(`/api/v1/settings/projects/${encodeURIComponent(id)}`, updates);
};

export const deleteProjectSettings = async (projectId: string): Promise<void> => {
  const id = projectId.trim();
  if (!id) return;

  await apiPatch('/api/v1/settings/projects', {
    [id]: null,
  });
};
