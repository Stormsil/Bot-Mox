import {
  type ApiSuccessEnvelope,
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
} from '../../services/apiClient';
import type {
  GenerateIsoPayloadRequest,
  GenerateIsoPayloadResponse,
  UnattendProfile,
  UnattendProfileConfig,
  VmSetupProgressEntry,
} from './types';

const PROFILES_PREFIX = '/api/v1/unattend-profiles';
const PROVISIONING_PREFIX = '/api/v1/provisioning';

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
