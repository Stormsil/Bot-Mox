import { uiLogger } from '../../observability/uiLogger';
import {
  createWorkspaceNoteViaContract,
  deleteWorkspaceNoteViaContract,
  getWorkspaceNoteViaContract,
  patchWorkspaceNoteViaContract,
} from '../../providers/workspace-contract-client';
import { ApiClientError } from '../apiClient';
import { convertDbToNote } from '../notes/mappers';
import type { CreateNoteData, Note, NoteBlock, NoteDb, UpdateNoteData } from '../notes/types';
import { fetchAllNotesRaw, normalizeApiErrorMessage } from './api';

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
