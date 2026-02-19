import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';

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

function resolveApiBaseUrl(): string {
  if (API_BASE_URL) {
    return API_BASE_URL;
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  return 'http://localhost:3002';
}

function resolveBearerToken(): string {
  const authorization = withAuthHeaders().get('Authorization') || '';
  return authorization.replace(/^Bearer\s+/i, '').trim();
}

function resolveAuthorizationHeader(): string {
  const token = resolveBearerToken();
  if (!token) {
    throw new ApiClientError('Missing auth token for contract request', {
      status: 401,
      code: 'MISSING_AUTH_TOKEN',
    });
  }

  return `Bearer ${token}`;
}

function createRuntimeClient() {
  return createApiContractClient({
    baseUrl: resolveApiBaseUrl(),
    accessToken: resolveBearerToken(),
  });
}

function toApiClientError(path: string, status: number, body: unknown): ApiClientError {
  const envelope = body && typeof body === 'object' ? (body as { error?: unknown }) : {};
  const payload =
    envelope.error && typeof envelope.error === 'object'
      ? (envelope.error as { code?: unknown; message?: unknown; details?: unknown })
      : {};

  return new ApiClientError(String(payload.message || `Contract request failed: ${path}`), {
    status,
    code: String(payload.code || 'API_CONTRACT_ERROR'),
    details: payload.details ?? body,
  });
}

export async function listPlaybooksViaContract(): Promise<ApiSuccessEnvelope<PlaybookRecord[]>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.playbooksList({
    headers: { authorization },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/playbooks', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<PlaybookRecord[]>;
}

export async function getPlaybookViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<PlaybookRecord>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.playbooksGet({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/playbooks/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<PlaybookRecord>;
}

export async function createPlaybookViaContract(
  payload: PlaybookCreatePayload,
): Promise<ApiSuccessEnvelope<PlaybookRecord>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.playbooksCreate({
    headers: { authorization },
    body: payload,
  });

  if (response.status !== 201) {
    throw toApiClientError('/api/v1/playbooks', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<PlaybookRecord>;
}

export async function updatePlaybookViaContract(
  id: string,
  payload: PlaybookUpdatePayload,
): Promise<ApiSuccessEnvelope<PlaybookRecord>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.playbooksUpdate({
    headers: { authorization },
    params: { id },
    body: payload,
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/playbooks/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<PlaybookRecord>;
}

export async function deletePlaybookViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<{ deleted: boolean }>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.playbooksDelete({
    headers: { authorization },
    params: { id },
  });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/playbooks/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<{ deleted: boolean }>;
}

export async function validatePlaybookViaContract(
  content: string,
): Promise<ApiSuccessEnvelope<PlaybookValidationResult>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.playbooksValidate({
    headers: { authorization },
    body: { content },
  });

  if (response.status !== 200) {
    throw toApiClientError('/api/v1/playbooks/validate', response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<PlaybookValidationResult>;
}
