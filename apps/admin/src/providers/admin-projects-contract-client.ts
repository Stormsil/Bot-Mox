import { createAdminProjectsContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';

function resolveApiBaseUrl(): string {
  if (API_BASE_URL) return API_BASE_URL;
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
  return createAdminProjectsContractClient({
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

type AdminRuntimeClient = ReturnType<typeof createRuntimeClient>;
type AdminCreateReleaseInput = Parameters<
  AdminRuntimeClient['adminProjectsCreateRelease']
>[0]['body'];
type AdminReleaseListQuery = NonNullable<
  Parameters<AdminRuntimeClient['adminProjectsListReleases']>[0]['query']
>;
type AdminRolloutInput = Parameters<AdminRuntimeClient['adminProjectsRollout']>[0]['body'];
type AdminStagedRolloutInput = Parameters<
  AdminRuntimeClient['adminProjectsRolloutStaged']
>[0]['body'];
type AdminRollbackInput = Parameters<AdminRuntimeClient['adminProjectsRollback']>[0]['body'];
type AdminRolloutStatusQuery = NonNullable<
  Parameters<AdminRuntimeClient['adminProjectsRolloutStatus']>[0]['query']
>;

type AdminReleaseRow = ApiSuccessEnvelope<unknown>['data'];
type AdminReleaseListResponse = ApiSuccessEnvelope<unknown>['data'];
type AdminRolloutResponse = ApiSuccessEnvelope<unknown>['data'];
type AdminStagedRolloutResponse = ApiSuccessEnvelope<unknown>['data'];
type AdminRollbackResponse = ApiSuccessEnvelope<unknown>['data'];
type AdminRolloutStatusRow = ApiSuccessEnvelope<unknown>['data'];
type AdminRolloutStatusListResponse = ApiSuccessEnvelope<unknown>['data'];

export async function createAdminProjectRelease(
  payload: AdminCreateReleaseInput,
): Promise<ApiSuccessEnvelope<AdminReleaseRow>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.adminProjectsCreateRelease({
    headers: { authorization },
    body: payload,
  });
  if (response.status !== 200) {
    throw toApiClientError(
      '/api/v1/admin/projects/catalog/releases',
      response.status,
      response.body,
    );
  }
  return response.body as ApiSuccessEnvelope<AdminReleaseRow>;
}

export async function listAdminProjectReleases(
  query: AdminReleaseListQuery,
): Promise<ApiSuccessEnvelope<AdminReleaseListResponse | AdminReleaseRow[]>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.adminProjectsListReleases({
    headers: { authorization },
    query,
  });
  if (response.status !== 200) {
    throw toApiClientError(
      '/api/v1/admin/projects/catalog/releases',
      response.status,
      response.body,
    );
  }
  return response.body as ApiSuccessEnvelope<AdminReleaseListResponse | AdminReleaseRow[]>;
}

export async function rolloutAdminProjects(
  payload: AdminRolloutInput,
): Promise<ApiSuccessEnvelope<AdminRolloutResponse>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.adminProjectsRollout({
    headers: { authorization },
    body: payload,
  });
  if (response.status !== 200) {
    throw toApiClientError('/api/v1/admin/projects/rollout', response.status, response.body);
  }
  return response.body as ApiSuccessEnvelope<AdminRolloutResponse>;
}

export async function stagedRolloutAdminProjects(
  payload: AdminStagedRolloutInput,
): Promise<ApiSuccessEnvelope<AdminStagedRolloutResponse>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.adminProjectsRolloutStaged({
    headers: { authorization },
    body: payload,
  });
  if (response.status !== 200) {
    throw toApiClientError('/api/v1/admin/projects/rollout/staged', response.status, response.body);
  }
  return response.body as ApiSuccessEnvelope<AdminStagedRolloutResponse>;
}

export async function rollbackAdminProjects(
  payload: AdminRollbackInput,
): Promise<ApiSuccessEnvelope<AdminRollbackResponse>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.adminProjectsRollback({
    headers: { authorization },
    body: payload,
  });
  if (response.status !== 200) {
    throw toApiClientError('/api/v1/admin/projects/rollback', response.status, response.body);
  }
  return response.body as ApiSuccessEnvelope<AdminRollbackResponse>;
}

export async function listAdminProjectRolloutStatus(
  query: AdminRolloutStatusQuery,
): Promise<ApiSuccessEnvelope<AdminRolloutStatusListResponse | AdminRolloutStatusRow[]>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response = await client.adminProjectsRolloutStatus({
    headers: { authorization },
    query,
  });
  if (response.status !== 200) {
    throw toApiClientError('/api/v1/admin/projects/rollout/status', response.status, response.body);
  }
  return response.body as ApiSuccessEnvelope<
    AdminRolloutStatusListResponse | AdminRolloutStatusRow[]
  >;
}
