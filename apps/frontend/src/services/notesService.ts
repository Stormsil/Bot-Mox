/**
 * @fileoverview Notes service over canonical API (/api/v1/workspace/notes)
 * Версия 2: markdown content + backward compatibility для legacy blocks.
 */

import { uiLogger } from '../observability/uiLogger';
import {
  createWorkspaceNoteViaContract,
  deleteWorkspaceNoteViaContract,
  getWorkspaceNoteViaContract,
  listWorkspaceNotesViaContract,
  patchWorkspaceNoteViaContract,
} from '../providers/workspace-contract-client';
import { ApiClientError } from './apiClient';
import {
  createCheckboxBlock,
  createEmptyNote,
  createListBlock,
  createTextBlock,
  generateBlockId,
  generateListItemId,
  generateNoteId,
} from './notes/factories';
import { convertDbToNote } from './notes/mappers';
import {
  filterNotesByBot,
  filterNotesByProject,
  getPinnedNotesFromCollection,
  listNoteIndexes,
  searchNotesInCollection,
} from './notes/query';
import { createNotesPollingSubscription } from './notes/subscriptions';
import type {
  CreateNoteData,
  Note,
  NoteBlock,
  NoteDb,
  NoteIndex,
  NotesFilter,
  NotesSort,
  Unsubscribe,
  UpdateNoteData,
} from './notes/types';

export type {
  CheckboxBlock,
  CreateNoteData,
  ListBlock,
  Note,
  NoteBlock,
  NoteDb,
  NoteIndex,
  NotesFilter,
  NotesSort,
  TextBlock,
  Unsubscribe,
  UpdateNoteData,
} from './notes/types';

// ============================================
// Constants
// ============================================

const DEFAULT_POLL_INTERVAL_MS = 3000;
const FETCH_LIMIT = 200;

// ============================================
// API Helpers
// ============================================

async function fetchAllNotesRaw(options?: {
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

    const totalRaw = Number(response.meta?.total ?? NaN);
    const total = Number.isFinite(totalRaw) ? totalRaw : undefined;
    if (pageItems.length < FETCH_LIMIT) break;
    if (total !== undefined && items.length >= total) break;

    page += 1;
  }

  return items;
}

function normalizeApiErrorMessage(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallback);
}

// ============================================
// CRUD Operations
// ============================================

export async function createNote(data: CreateNoteData, userId?: string): Promise<Note> {
  try {
    const now = Date.now();
    const payload: Omit<NoteDb, 'id'> = {
      title: String(data.title || '').trim() || 'New Note',
      content: '',
      tags: (data.tags || []).filter((tag): tag is string => Boolean(tag)),
      bot_id: data.bot_id ?? null,
      project_id: data.project_id ?? null,
      is_pinned: false,
      created_at: now,
      updated_at: now,
      ...(userId ? { created_by: userId } : {}),
    };

    const response = await createWorkspaceNoteViaContract(payload as Record<string, unknown>);
    return convertDbToNote(response.data as unknown as NoteDb);
  } catch (error) {
    uiLogger.error('Error creating note:', error);
    throw normalizeApiErrorMessage(error, 'Failed to create note');
  }
}

export async function getNote(id: string): Promise<Note | null> {
  try {
    const response = await getWorkspaceNoteViaContract(String(id));
    return convertDbToNote(response.data as unknown as NoteDb);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    uiLogger.error(`Error getting note ${id}:`, error);
    throw normalizeApiErrorMessage(error, 'Failed to get note');
  }
}

export async function updateNote(id: string, data: UpdateNoteData): Promise<void> {
  try {
    const payload: Record<string, unknown> = {};

    if (data.title !== undefined) payload.title = data.title;
    if (data.content !== undefined) payload.content = data.content;
    if (data.tags !== undefined) payload.tags = data.tags;
    if (data.is_pinned !== undefined) payload.is_pinned = data.is_pinned;

    if (data.blocks !== undefined) {
      const blocksObj: Record<string, NoteBlock> = {};
      data.blocks.forEach((block) => {
        blocksObj[block.id] = {
          ...block,
          updated_at: Date.now(),
        };
      });
      payload.blocks = blocksObj;
    }

    if (Object.keys(payload).length === 0) return;
    await patchWorkspaceNoteViaContract(String(id), payload);
  } catch (error) {
    uiLogger.error(`Error updating note ${id}:`, error);
    throw normalizeApiErrorMessage(error, 'Failed to update note');
  }
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await deleteWorkspaceNoteViaContract(String(id));
  } catch (error) {
    uiLogger.error(`Error deleting note ${id}:`, error);
    throw normalizeApiErrorMessage(error, 'Failed to delete note');
  }
}

export async function getAllNotes(): Promise<Note[]> {
  try {
    const raw = await fetchAllNotesRaw({ sort: 'updated_at', order: 'desc' });
    return raw.map(convertDbToNote).sort((a, b) => b.updated_at - a.updated_at);
  } catch (error) {
    uiLogger.error('Error getting all notes:', error);
    throw normalizeApiErrorMessage(error, 'Failed to get notes');
  }
}

// ============================================
// Filtering & Search
// ============================================

export async function getNotesByBot(botId: string): Promise<Note[]> {
  try {
    return filterNotesByBot(await getAllNotes(), botId);
  } catch (error) {
    uiLogger.error(`Error getting notes by bot ${botId}:`, error);
    throw normalizeApiErrorMessage(error, 'Failed to get notes by bot');
  }
}

export async function getNotesByProject(projectId: string): Promise<Note[]> {
  try {
    return filterNotesByProject(await getAllNotes(), projectId);
  } catch (error) {
    uiLogger.error(`Error getting notes by project ${projectId}:`, error);
    throw normalizeApiErrorMessage(error, 'Failed to get notes by project');
  }
}

export async function searchNotes(query: string): Promise<Note[]> {
  try {
    return searchNotesInCollection(await getAllNotes(), query);
  } catch (error) {
    uiLogger.error(`Error searching notes with query "${query}":`, error);
    throw normalizeApiErrorMessage(error, 'Failed to search notes');
  }
}

export async function getPinnedNotes(): Promise<Note[]> {
  try {
    return getPinnedNotesFromCollection(await getAllNotes());
  } catch (error) {
    uiLogger.error('Error getting pinned notes:', error);
    throw normalizeApiErrorMessage(error, 'Failed to get pinned notes');
  }
}

export async function listNotes(filter?: NotesFilter, sort?: NotesSort): Promise<NoteIndex[]> {
  try {
    return listNoteIndexes(await getAllNotes(), filter, sort);
  } catch (error) {
    uiLogger.error('Error listing notes:', error);
    throw normalizeApiErrorMessage(error, 'Failed to list notes');
  }
}

// ============================================
// Realtime Subscriptions (polling)
// ============================================

export function subscribeToNote(id: string, callback: (note: Note | null) => void): Unsubscribe {
  return createNotesPollingSubscription({
    key: `notes:${id}`,
    intervalMs: 2000,
    load: async () => getNote(id),
    callback,
    fallbackValue: null,
    errorMessage: `Error subscribing to note ${id}:`,
  });
}

export function subscribeToAllNotes(callback: (notes: Note[]) => void): Unsubscribe {
  return createNotesPollingSubscription({
    key: 'notes:all',
    intervalMs: DEFAULT_POLL_INTERVAL_MS,
    load: async () => getAllNotes(),
    callback,
    fallbackValue: [],
    errorMessage: 'Error subscribing to all notes:',
  });
}

export function subscribeToNotesByBot(
  botId: string,
  callback: (notes: Note[]) => void,
): Unsubscribe {
  return createNotesPollingSubscription({
    key: `notes:bot:${botId}`,
    intervalMs: DEFAULT_POLL_INTERVAL_MS,
    load: async () => getNotesByBot(botId),
    callback,
    fallbackValue: [],
    errorMessage: `Error subscribing to notes by bot ${botId}:`,
  });
}

export function subscribeToNotesIndex(callback: (notes: NoteIndex[]) => void): Unsubscribe {
  return createNotesPollingSubscription({
    key: 'notes:index',
    intervalMs: DEFAULT_POLL_INTERVAL_MS,
    load: async () => listNotes(),
    callback,
    fallbackValue: [],
    errorMessage: 'Error subscribing to notes index:',
  });
}

// ============================================
// Utilities
// ============================================

// ============================================
// Default Export
// ============================================

export const notesService = {
  createNote,
  getNote,
  updateNote,
  deleteNote,
  getAllNotes,
  getNotesByBot,
  getNotesByProject,
  searchNotes,
  getPinnedNotes,
  listNotes,
  subscribeToNote,
  subscribeToAllNotes,
  subscribeToNotesByBot,
  subscribeToNotesIndex,
  createEmptyNote,
  generateNoteId,
  generateBlockId,
  generateListItemId,
  createTextBlock,
  createCheckboxBlock,
  createListBlock,
};
