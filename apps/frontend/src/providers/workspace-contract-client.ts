import type { ApiSuccessEnvelope } from '../shared/api/apiClient';
import {
  createContractRuntimeClient,
  resolveContractAuthorizationHeader,
  toContractApiClientError,
} from '../shared/api/contracts/runtimeClient';

interface WorkspaceListQuery {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}

type WorkspaceKind = 'notes' | 'calendar' | 'kanban';

async function listWorkspaceViaContract(
  kind: WorkspaceKind,
  query: WorkspaceListQuery,
): Promise<ApiSuccessEnvelope<Record<string, unknown>[]>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
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
    throw toContractApiClientError(`/api/v1/workspace/${kind}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>[]>;
}

async function getWorkspaceViaContract(
  kind: WorkspaceKind,
  id: string,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
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
    throw toContractApiClientError(
      `/api/v1/workspace/${kind}/${id}`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

async function createWorkspaceViaContract(
  kind: WorkspaceKind,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
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
    throw toContractApiClientError(`/api/v1/workspace/${kind}`, response.status, response.body);
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

async function patchWorkspaceViaContract(
  kind: WorkspaceKind,
  id: string,
  payload: Record<string, unknown>,
): Promise<ApiSuccessEnvelope<Record<string, unknown>>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
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
    throw toContractApiClientError(
      `/api/v1/workspace/${kind}/${id}`,
      response.status,
      response.body,
    );
  }

  return response.body as ApiSuccessEnvelope<Record<string, unknown>>;
}

async function deleteWorkspaceViaContract(
  kind: WorkspaceKind,
  id: string,
): Promise<ApiSuccessEnvelope<{ id: string; deleted: boolean }>> {
  const client = createContractRuntimeClient();
  const authorization = resolveContractAuthorizationHeader();
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
    throw toContractApiClientError(
      `/api/v1/workspace/${kind}/${id}`,
      response.status,
      response.body,
    );
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
