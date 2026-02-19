import {
  createPlaybookViaContract,
  deletePlaybookViaContract,
  getPlaybookViaContract,
  listPlaybooksViaContract,
  updatePlaybookViaContract,
  validatePlaybookViaContract,
} from '../providers/playbook-contract-client';
import type { ApiSuccessEnvelope } from './apiClient';

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
  return listPlaybooksViaContract() as Promise<ApiSuccessEnvelope<Playbook[]>>;
}

export async function getPlaybook(id: string): Promise<ApiSuccessEnvelope<Playbook>> {
  return getPlaybookViaContract(id) as Promise<ApiSuccessEnvelope<Playbook>>;
}

export async function createPlaybook(payload: {
  name: string;
  is_default?: boolean;
  content: string;
}): Promise<ApiSuccessEnvelope<Playbook>> {
  return createPlaybookViaContract(payload) as Promise<ApiSuccessEnvelope<Playbook>>;
}

export async function updatePlaybook(
  id: string,
  payload: {
    name?: string;
    is_default?: boolean;
    content?: string;
  },
): Promise<ApiSuccessEnvelope<Playbook>> {
  return updatePlaybookViaContract(id, payload) as Promise<ApiSuccessEnvelope<Playbook>>;
}

export async function deletePlaybook(id: string): Promise<void> {
  await deletePlaybookViaContract(id);
}

export async function validatePlaybook(
  content: string,
): Promise<ApiSuccessEnvelope<PlaybookValidationResult>> {
  return validatePlaybookViaContract(content) as Promise<
    ApiSuccessEnvelope<PlaybookValidationResult>
  >;
}
