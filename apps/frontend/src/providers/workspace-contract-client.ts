import { createApiContractClient } from '@botmox/api-contract';
import { API_BASE_URL } from '../config/env';
import { ApiClientError, type ApiSuccessEnvelope } from '../services/apiClient';
import { withAuthHeaders } from '../services/authFetch';

interface WorkspaceListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

type WorkspaceKind = 'notes' | 'calendar' | 'kanban';

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

async function listWorkspaceViaContract(
  kind: WorkspaceKind,
  query: WorkspaceListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response =
    kind === 'notes'
      ? await client.workspaceNotesList({
          headers: { authorization },
          query,
        })
      : kind === 'calendar'
        ? await client.workspaceCalendarList({
            headers: { authorization },
            query,
          })
        : await client.workspaceKanbanList({
            headers: { authorization },
            query,
          });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/workspace/${kind}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>[]>;
}

async function getWorkspaceViaContract(
  kind: WorkspaceKind,
  id: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response =
    kind === 'notes'
      ? await client.workspaceNotesGet({
          headers: { authorization },
          params: { id },
        })
      : kind === 'calendar'
        ? await client.workspaceCalendarGet({
            headers: { authorization },
            params: { id },
          })
        : await client.workspaceKanbanGet({
            headers: { authorization },
            params: { id },
          });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/workspace/${kind}/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

async function createWorkspaceViaContract(
  kind: WorkspaceKind,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response =
    kind === 'notes'
      ? await client.workspaceNotesCreate({
          headers: { authorization },
          body: payload,
        })
      : kind === 'calendar'
        ? await client.workspaceCalendarCreate({
            headers: { authorization },
            body: payload,
          })
        : await client.workspaceKanbanCreate({
            headers: { authorization },
            body: payload,
          });

  if (response.status !== 201) {
    throw toApiClientError(`/api/v1/workspace/${kind}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

async function patchWorkspaceViaContract(
  kind: WorkspaceKind,
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response =
    kind === 'notes'
      ? await client.workspaceNotesPatch({
          headers: { authorization },
          params: { id },
          body: payload,
        })
      : kind === 'calendar'
        ? await client.workspaceCalendarPatch({
            headers: { authorization },
            params: { id },
            body: payload,
          })
        : await client.workspaceKanbanPatch({
            headers: { authorization },
            params: { id },
            body: payload,
          });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/workspace/${kind}/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

async function deleteWorkspaceViaContract(
  kind: WorkspaceKind,
  id: string,
): Promise<ApiSuccessEnvelope<{ id: string; deleted: boolean }>> {
  const client = createRuntimeClient();
  const authorization = resolveAuthorizationHeader();
  const response =
    kind === 'notes'
      ? await client.workspaceNotesDelete({
          headers: { authorization },
          params: { id },
        })
      : kind === 'calendar'
        ? await client.workspaceCalendarDelete({
            headers: { authorization },
            params: { id },
          })
        : await client.workspaceKanbanDelete({
            headers: { authorization },
            params: { id },
          });

  if (response.status !== 200) {
    throw toApiClientError(`/api/v1/workspace/${kind}/${id}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<{ id: string; deleted: boolean }>;
}

export async function listWorkspaceCalendarViaContract(
  query: WorkspaceListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  return listWorkspaceViaContract('calendar', query);
}

export async function listWorkspaceNotesViaContract(
  query: WorkspaceListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  return listWorkspaceViaContract('notes', query);
}

export async function getWorkspaceNoteViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return getWorkspaceViaContract('notes', id);
}

export async function createWorkspaceNoteViaContract(
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return createWorkspaceViaContract('notes', payload);
}

export async function patchWorkspaceNoteViaContract(
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return patchWorkspaceViaContract('notes', id, payload);
}

export async function deleteWorkspaceNoteViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<{ id: string; deleted: boolean }>> {
  return deleteWorkspaceViaContract('notes', id);
}

export async function getWorkspaceCalendarViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return getWorkspaceViaContract('calendar', id);
}

export async function createWorkspaceCalendarViaContract(
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return createWorkspaceViaContract('calendar', payload);
}

export async function patchWorkspaceCalendarViaContract(
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return patchWorkspaceViaContract('calendar', id, payload);
}

export async function deleteWorkspaceCalendarViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<{ id: string; deleted: boolean }>> {
  return deleteWorkspaceViaContract('calendar', id);
}

export async function listWorkspaceKanbanViaContract(
  query: WorkspaceListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  return listWorkspaceViaContract('kanban', query);
}

export async function getWorkspaceKanbanViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return getWorkspaceViaContract('kanban', id);
}

export async function createWorkspaceKanbanViaContract(
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return createWorkspaceViaContract('kanban', payload);
}

export async function patchWorkspaceKanbanViaContract(
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  return patchWorkspaceViaContract('kanban', id, payload);
}

export async function deleteWorkspaceKanbanViaContract(
  id: string,
): Promise<ApiSuccessEnvelope<{ id: string; deleted: boolean }>> {
  return deleteWorkspaceViaContract('kanban', id);
}
