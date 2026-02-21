import { listWorkspaceNotesViaContract } from '../../providers/workspace-contract-client';
import type { NoteDb } from '../notes/types';

const FETCH_LIMIT = 200;

export async function fetchAllNotesRaw(options?: {
  q?: string;
  sort?: string;
  order?: 'asc' | 'desc';
}): Promise<NoteDb[]> {
  const items: NoteDb[] = [];
  let page = 1;
  let guard = 0;

  while (guard < 1000) {
    guard += 1;

    const response = await listWorkspaceNotesViaContract({
      page,
      limit: FETCH_LIMIT,
      sort: options?.sort,
      order: options?.order,
      q: options?.q,
    });

    const pageItems = Array.isArray(response.data) ? response.data : [];
    items.push(...(pageItems as unknown as NoteDb[]));

    const totalRaw = Number(response.meta?.total ?? Number.NaN);
    const total = Number.isFinite(totalRaw) ? totalRaw : undefined;
    if (pageItems.length < FETCH_LIMIT) break;
    if (total !== undefined && items.length >= total) break;

    page += 1;
  }

  return items;
}

export function normalizeApiErrorMessage(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallback);
}
