import { apiGet, apiPost, apiPut, apiDelete, type ApiSuccessEnvelope } from './apiClient';

const PREFIX = '/api/v1/playbooks';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface Playbook {
  id: string;
  tenant_id: string;
  user_id: string;
  name: string;
  is_default: boolean;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface PlaybookValidationResult {
  valid: boolean;
  errors: Array<{ path?: string; message: string }>;
  warnings: Array<{ message: string }>;
}

// ---------------------------------------------------------------------------
// API calls
// ---------------------------------------------------------------------------

export async function listPlaybooks(): Promise<ApiSuccessEnvelope<Playbook[]>> {
  return apiGet<Playbook[]>(PREFIX);
}

export async function getPlaybook(id: string): Promise<ApiSuccessEnvelope<Playbook>> {
  return apiGet<Playbook>(`${PREFIX}/${id}`);
}

export async function createPlaybook(payload: {
  name: string;
  is_default?: boolean;
  content: string;
}): Promise<ApiSuccessEnvelope<Playbook>> {
  return apiPost<Playbook>(PREFIX, payload);
}

export async function updatePlaybook(
  id: string,
  payload: {
    name?: string;
    is_default?: boolean;
    content?: string;
  },
): Promise<ApiSuccessEnvelope<Playbook>> {
  return apiPut<Playbook>(`${PREFIX}/${id}`, payload);
}

export async function deletePlaybook(id: string): Promise<void> {
  await apiDelete(`${PREFIX}/${id}`);
}

export async function validatePlaybook(
  content: string,
): Promise<ApiSuccessEnvelope<PlaybookValidationResult>> {
  return apiPost<PlaybookValidationResult>(`${PREFIX}/validate`, { content });
}
