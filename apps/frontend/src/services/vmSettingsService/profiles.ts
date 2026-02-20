import type { VMConfigProfile, VMHardwareConfig } from '../../types';
import { apiPatch, apiPut } from '../apiClient';
import { DEFAULT_SETTINGS, VM_PROFILES_PATH } from './constants';
import { normalizeApiPath, readSettingsPath } from './paths';

interface VmProfilePayload {
  name: string;
  created_at: number;
  updated_at: number;
  hardware: VMHardwareConfig;
}

export function profilesMapToArray(data: unknown): VMConfigProfile[] {
  if (!data || typeof data !== 'object') return [];
  return Object.entries(data as Record<string, VmProfilePayload>)
    .filter(([, profile]) => Boolean(profile))
    .map(([id, profile]) => ({
      id,
      name: profile?.name || 'Unnamed profile',
      created_at: Number(profile?.created_at || Date.now()),
      updated_at: Number(profile?.updated_at || Date.now()),
      hardware: profile?.hardware || DEFAULT_SETTINGS.hardware,
    }))
    .sort((a, b) => b.updated_at - a.updated_at);
}

export async function saveVMConfigProfileRecord(
  name: string,
  hardware: VMHardwareConfig,
  profileId?: string,
): Promise<string> {
  const trimmedName = name.trim();
  if (!trimmedName) throw new Error('Profile name is required');

  const now = Date.now();
  const payload = {
    name: trimmedName,
    updated_at: now,
    hardware,
  };

  if (profileId) {
    let createdAt = now;
    try {
      const existing = await readSettingsPath<VmProfilePayload>(`${VM_PROFILES_PATH}/${profileId}`);
      createdAt = Number(existing?.created_at || now);
    } catch {
      createdAt = now;
    }

    await apiPatch(normalizeApiPath(`${VM_PROFILES_PATH}/${profileId}`), {
      ...payload,
      created_at: createdAt,
    });
    return profileId;
  }

  const generatedId = `vm_profile_${now}_${Math.random().toString(36).slice(2, 8)}`;
  await apiPut(normalizeApiPath(`${VM_PROFILES_PATH}/${generatedId}`), {
    ...payload,
    created_at: now,
  });
  return generatedId;
}

export async function deleteVMConfigProfileRecord(profileId: string): Promise<void> {
  if (!profileId) return;
  await apiPatch(normalizeApiPath(VM_PROFILES_PATH), {
    [profileId]: null,
  });
}
