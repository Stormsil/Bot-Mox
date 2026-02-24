import {
  ApiClientError,
  type ApiSuccessEnvelope,
  apiDelete,
  apiGet,
  apiPost,
  apiPut,
} from '../../shared/api/apiClient';
import type {
  GenerateIsoPayloadRequest,
  GenerateIsoPayloadResponse,
  UnattendProfile,
  UnattendProfileConfig,
  VmSetupProgressEntry,
} from './types';

const PROFILES_PREFIX = '/api/v1/unattend-profiles';
const PROVISIONING_PREFIX = '/api/v1/provisioning';

function isExpectedProvisioningReadDegradedError(error: unknown): error is ApiClientError {
  if (!(error instanceof ApiClientError)) {
    return false;
  }
  const code = String(error.code || '').trim();
  return (
    error.status === 502 || code === 'AGENTS_STORAGE_UNAVAILABLE' || code === 'VM_OPS_UNAVAILABLE'
  );
}

export async function listUnattendProfiles(): Promise<ApiSuccessEnvelope<UnattendProfile[]>> {
  try {
    return await apiGet<UnattendProfile[]>(PROFILES_PREFIX);
  } catch (error) {
    if (isExpectedProvisioningReadDegradedError(error)) {
      return { success: true, data: [] };
    }
    throw error;
  }
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
  try {
    return await apiGet<VmSetupProgressEntry[]>(`${PROVISIONING_PREFIX}/progress/${vmUuid}`);
  } catch (error) {
    if (isExpectedProvisioningReadDegradedError(error)) {
      return { success: true, data: [] };
    }
    throw error;
  }
}
