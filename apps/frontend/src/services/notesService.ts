/**
 * @fileoverview Notes service over canonical API (/api/v1/workspace/notes).
 * Compatibility facade: exports stable API while implementation is split by responsibility.
 */

import {
  createCheckboxBlock,
  createEmptyNote,
  createListBlock,
  createTextBlock,
  generateBlockId,
  generateListItemId,
  generateNoteId,
} from './notes/factories';
import { createNote, deleteNote, getAllNotes, getNote, updateNote } from './notesService/crud';
import {
  getNotesByBot,
  getNotesByProject,
  getPinnedNotes,
  listNotes,
  searchNotes,
} from './notesService/query';
import {
  subscribeToAllNotes,
  subscribeToNote,
  subscribeToNotesByBot,
  subscribeToNotesIndex,
} from './notesService/subscriptions';

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

export {
  createNote,
  deleteNote,
  getAllNotes,
  getNote,
  getNotesByBot,
  getNotesByProject,
  getPinnedNotes,
  listNotes,
  searchNotes,
  subscribeToAllNotes,
  subscribeToNote,
  subscribeToNotesByBot,
  subscribeToNotesIndex,
  updateNote,
};

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
