import { uiLogger } from '../../observability/uiLogger';
import {
  filterNotesByBot,
  filterNotesByProject,
  getPinnedNotesFromCollection,
  listNoteIndexes,
  searchNotesInCollection,
} from '../notes/query';
import type { Note, NoteIndex, NotesFilter, NotesSort } from '../notes/types';
import { normalizeApiErrorMessage } from './api';
import { getAllNotes } from './crud';

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
