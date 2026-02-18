import type { StoragePolicy } from '../types';
import { apiGet, apiPut } from './apiClient';
import { uiLogger } from '../observability/uiLogger'

const STORAGE_POLICY_PATH = '/api/v1/settings/storage_policy';

export function getDefaultStoragePolicy(): StoragePolicy {
  return {
    secrets: 'local-only',
    operational: 'cloud',
    sync: {
      enabled: false,
    },
    updated_at: Date.now(),
  };
}

function normalizeStoragePolicy(raw: unknown): StoragePolicy {
  if (!raw || typeof raw !== 'object') {
    return getDefaultStoragePolicy();
  }

  const source = raw as Record<string, unknown>;
  const operationalRaw = String(source.operational || '').trim().toLowerCase();
  const syncRaw = source.sync && typeof source.sync === 'object'
    ? (source.sync as Record<string, unknown>)
    : {};

  return {
    secrets: 'local-only',
    operational: operationalRaw === 'local' ? 'local' : 'cloud',
    sync: {
      enabled: Boolean(syncRaw.enabled),
    },
    updated_at:
      typeof source.updated_at === 'number' && Number.isFinite(source.updated_at)
        ? source.updated_at
        : Date.now(),
    updated_by:
      typeof source.updated_by === 'string' && source.updated_by.trim()
        ? source.updated_by.trim()
        : undefined,
  };
}

export async function getStoragePolicy(): Promise<StoragePolicy> {
  try {
    const response = await apiGet<unknown>(STORAGE_POLICY_PATH);
    return normalizeStoragePolicy(response.data);
  } catch (error) {
    uiLogger.error('Error loading storage policy:', error);
    return getDefaultStoragePolicy();
  }
}

export async function updateStoragePolicy(policy: Partial<StoragePolicy>): Promise<void> {
  const current = await getStoragePolicy();
  const merged: StoragePolicy = {
    ...current,
    ...policy,
    secrets: 'local-only',
    sync: {
      ...current.sync,
      ...(policy.sync || {}),
    },
    updated_at: Date.now(),
  };

  await apiPut(STORAGE_POLICY_PATH, merged);
}
