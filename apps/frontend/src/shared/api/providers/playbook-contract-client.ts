import { ApiClientError, type ApiSuccessEnvelope } from '../apiClient';
import {
  createContractRuntimeClient,
  resolveContractAuthorizationHeader,
  toContractApiClientError,
} from '../contracts/runtimeClient';

type PlaybookRecord = {
  id: string;
  tenant_id?: string;
  user_id?: string;
  name: string;
  is_default?: boolean;
  content: string;
  created_at?: string;
  updated_at?: string;
} & Record<string, unknown>;

type PlaybookCreatePayload = {
  name: string;
  is_default?: boolean;
  content: string;
};

type PlaybookUpdatePayload = {
  name?: string;
  is_default?: boolean;
  content?: string;
};

type PlaybookValidationIssue = {
  path?: string;
  message: string;
};

type PlaybookValidationWarning = {
  message: string;
};

type PlaybookValidationResult = {
  valid: boolean;
  errors: PlaybookValidationIssue[];
  warnings: PlaybookValidationWarning[];
};

function isExpectedPlaybookReadDegradedError(error: unknown): error is ApiClientError {
  if (!(error instanceof ApiClientError)) {
    return false;
  }
  const code = String(error.code || '').trim();
  return (
    error.status === 502 || code === 'AGENTS_STORAGE_UNAVAILABLE' || code === 'VM_OPS_UNAVAILABLE'
  );
}

export async function listPlaybooksViaContract(): Promise<ApiSuccessEnvelope<PlaybookRecord[]>> {
  try {
    const client = createContractRuntimeClient();
    const authorization = resolveContractAuthorizationHeader();
    const response = await client.playbooksList({
      headers: { authorization },
    });

    if (response.status !== 200) {
      throw toContractApiClientError('/api/v1/playbooks', response.status, response.body);
    }

    return response.body as ApiSuccessEnvelope<PlaybookRecord[]>;
  } catch (error) {
    if (isExpectedPlaybookReadDegradedError(error)) {
      return { success: true, data: [] };
    }
    throw error;
  }
}

export async function getPlaybookViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<PlaybookRecord>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.playbooksGet({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toContractApiClientError(`/api/v1/playbooks/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<PlaybookRecord>;
}

export async function createPlaybookViaContract(
  payload: PlaybookCreatePayload,
): Promise<ApiSuccessEnvelope<PlaybookRecord>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.playbooksCreate({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 201) {
    throw toContractApiClientError('/api/v1/playbooks', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<PlaybookRecord>;
}

export async function updatePlaybookViaContract(
  id: string,
  payload: PlaybookUpdatePayload,
): Promise<ApiSuccessEnvelope<PlaybookRecord>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.playbooksUpdate({
    headers: { authorization },
    params: { id },
    body: payload,
  });

  if (response.status !== 200) {
    throw toContractApiClientError(`/api/v1/playbooks/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<PlaybookRecord>;
}

export async function deletePlaybookViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<{ deleted: boolean }>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.playbooksDelete({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toContractApiClientError(`/api/v1/playbooks/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<{ deleted: boolean }>;
}

export async function validatePlaybookViaContract(
  content: string,
): Promise<ApiSuccessEnvelope<PlaybookValidationResult>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
  const response = await client.playbooksValidate({
    headers: { authorization },
    body: { content },
  });

  if (response.status !== 200) {
    throw toContractApiClientError('/api/v1/playbooks/validate', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<PlaybookValidationResult>;
}
