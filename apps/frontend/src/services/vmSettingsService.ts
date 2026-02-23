import { uiLogger } from '../observability/uiLogger';
import type { VMConfigProfile, VMGeneratorSettings, VMHardwareConfig } from '../types';
import { apiPatch } from './apiClient';
import { DEFAULT_SETTINGS, SETTINGS_PATH, VM_PROFILES_PATH } from './vmSettingsService/constants';
import { mergeSettings, stripPasswords } from './vmSettingsService/normalization';
import { normalizeApiPath, readSettingsPath } from './vmSettingsService/paths';
import {
  deleteVMConfigProfileRecord,
  profilesMapToArray,
  saveVMConfigProfileRecord,
} from './vmSettingsService/profiles';

export async function getVMSettings(): Promise<VMGeneratorSettings> {
  try {
    const data = await readSettingsPath<Partial<VMGeneratorSettings>>(SETTINGS_PATH);
    return mergeSettings(data);
  } catch (error) {
    uiLogger.error('Error loading VM settings:', error);
    return DEFAULT_SETTINGS;
  }
}

/**
 * Strip deprecated plaintext password fields before persisting to the backend.
 * Passwords are managed through the secrets vault (secret bindings) instead.
 */
export async function updateVMSettings(settings: Partial<VMGeneratorSettings>): Promise<void> {
  await apiPatch(normalizeApiPath(SETTINGS_PATH), settings);
}

export async function getVMConfigProfiles(): Promise<VMConfigProfile[]> {
  try {
    const data = await readSettingsPath<unknown>(VM_PROFILES_PATH);
    return profilesMapToArray(data);
  } catch (error) {
    uiLogger.error('Error loading VM config profiles:', error);
    return [];
  }
}

export async function saveVMConfigProfile(
  name: string,
  hardware: VMHardwareConfig,
  profileId?: string,
): Promise<string> {
  return saveVMConfigProfileRecord(name, hardware, profileId);
}

export async function deleteVMConfigProfile(profileId: string): Promise<void> {
  await deleteVMConfigProfileRecord(profileId);
}

export { DEFAULT_SETTINGS };
export { stripPasswords };
