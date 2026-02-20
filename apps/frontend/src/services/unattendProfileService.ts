import { type ApiSuccessEnvelope, apiDelete, apiGet, apiPost, apiPut } from './apiClient';
import { migrateProfileConfig } from './unattendProfile/migration';
import {
  DEFAULT_PROFILE_CONFIG,
  type GenerateIsoPayloadRequest,
  type GenerateIsoPayloadResponse,
  type UnattendProfile,
  type UnattendProfileConfig,
  type VmSetupProgressEntry,
} from './unattendProfile/types';

const PROFILES_PREFIX = '/api/v1/unattend-profiles';
const PROVISIONING_PREFIX = '/api/v1/provisioning';

export { DEFAULT_PROFILE_CONFIG, migrateProfileConfig };

export type {
  GenerateIsoPayloadRequest,
  GenerateIsoPayloadResponse,
  KeyboardLayoutPair,
  UnattendCapabilityRemovalConfig,
  UnattendComputerNameConfig,
  UnattendCustomScript,
  UnattendDesktopIcons,
  UnattendLocaleConfig,
  UnattendProfile,
  UnattendProfileConfig,
  UnattendSoftwareRemovalConfig,
  UnattendUserConfig,
  UnattendVisualEffects,
  UnattendWindowsSettings,
  VmSetupProgressEntry,
} from './unattendProfile/types';

export async function listUnattendProfiles(): Promise<ApiSuccessEnvelope<UnattendProfile[]>> {
  return apiGet<UnattendProfile[]>(PROFILES_PREFIX);
}

export async function createUnattendProfile(payload: {
  name: string;
  is_default?: boolean;
  config: UnattendProfileConfig;
}): Promise<ApiSuccessEnvelope<UnattendProfile>> {
  return apiPost<UnattendProfile>(PROFILES_PREFIX, payload);
}

export async function updateUnattendProfile(
  id: string,
  payload: {
    name?: string;
    is_default?: boolean;
    config?: UnattendProfileConfig;
  },
): Promise<ApiSuccessEnvelope<UnattendProfile>> {
  return apiPut<UnattendProfile>(`${PROFILES_PREFIX}/${id}`, payload);
}

export async function deleteUnattendProfile(id: string): Promise<void> {
  await apiDelete(`${PROFILES_PREFIX}/${id}`);
}

export async function generateIsoPayload(
  request: GenerateIsoPayloadRequest,
): Promise<ApiSuccessEnvelope<GenerateIsoPayloadResponse>> {
  return apiPost<GenerateIsoPayloadResponse>(
    `${PROVISIONING_PREFIX}/generate-iso-payload`,
    request,
  );
}

export async function getVmSetupProgress(
  vmUuid: string,
): Promise<ApiSuccessEnvelope<VmSetupProgressEntry[]>> {
  return apiGet<VmSetupProgressEntry[]>(`${PROVISIONING_PREFIX}/progress/${vmUuid}`);
}
