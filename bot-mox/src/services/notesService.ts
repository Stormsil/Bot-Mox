/**
 * @fileoverview Notes service over canonical API (/api/v1/workspace/notes)
 * Версия 2: markdown content + backward compatibility для legacy blocks.
 */

import { apiDelete, apiGet, apiPatch, apiPost, ApiClientError, createPollingSubscription } from './apiClient';

// ============================================
// Type Definitions
// ============================================

export interface Note {
  id: string;
  title: string;
  content: string;
  tags: string[];
  bot_id: string | null;
  project_id: string | null;
  is_pinned: boolean;
  created_at: number;
  updated_at: number;
  created_by?: string;
  // Deprecated: blocks kept for backward compatibility.
  blocks?: NoteBlock[];
}

export type NoteBlockType =
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'paragraph'
  | 'checkbox'
  | 'bullet_list'
  | 'numbered_list';

export interface NoteBlockBase {
  id: string;
  type: NoteBlockType;
  created_at: number;
  updated_at: number;
}

export interface TextBlock extends NoteBlockBase {
  type: 'heading_1' | 'heading_2' | 'heading_3' | 'paragraph';
  content: string;
}

export interface CheckboxBlock extends NoteBlockBase {
  type: 'checkbox';
  content: string;
  checked: boolean;
}

export interface ListItem {
  id: string;
  content: string;
  checked?: boolean;
}

export interface ListBlock extends NoteBlockBase {
  type: 'bullet_list' | 'numbered_list';
  items: ListItem[];
}

export type NoteBlock = TextBlock | CheckboxBlock | ListBlock;

export interface NoteDb {
  id: string;
  title: string;
  content?: string;
  blocks?: Record<string, NoteBlock>;
  tags: string[];
  bot_id: string | null;
  project_id: string | null;
  is_pinned: boolean;
  created_at: number;
  updated_at: number;
  created_by?: string;
}

export interface NoteIndex {
  id: string;
  title: string;
  preview: string;
  tags: string[];
  bot_id: string | null;
  project_id: string | null;
  is_pinned: boolean;
  created_at: number;
  updated_at: number;
}

export interface CreateNoteData {
  title: string;
  bot_id?: string | null;
  project_id?: string | null;
  tags?: string[];
}

export interface UpdateNoteData {
  title?: string;
  content?: string;
  blocks?: NoteBlock[];
  tags?: string[];
  is_pinned?: boolean;
}

export interface NotesFilter {
  search?: string;
  tags?: string[];
  bot_id?: string | null;
  project_id?: string | null;
  is_pinned?: boolean;
}

export interface NotesSort {
  field: 'updated_at' | 'created_at' | 'title';
  direction: 'asc' | 'desc';
}

export type Unsubscribe = () => void;

// ============================================
// Constants
// ============================================

const NOTES_API_PATH = '/api/v1/workspace/notes';
const DEFAULT_POLL_INTERVAL_MS = 3000;
const FETCH_LIMIT = 200;

// ============================================
// API Helpers
// ============================================

function buildNotesListPath(params?: {
  page?: number;
  limit?: number;
  sort?: string;
  order?: 'asc' | 'desc';
  q?: string;
}): string {
  const search = new URLSearchParams();
  if (params?.page) search.set('page', String(params.page));
  if (params?.limit) search.set('limit', String(params.limit));
  if (params?.sort) search.set('sort', params.sort);
  if (params?.order) search.set('order', params.order);
  if (params?.q) search.set('q', params.q);
  const query = search.toString();
  return query ? `${NOTES_API_PATH}?${query}` : NOTES_API_PATH;
}

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

    const response = await apiGet<unknown[]>(
      buildNotesListPath({
        page,
        limit: FETCH_LIMIT,
        sort: options?.sort,
        order: options?.order,
        q: options?.q,
      })
    );

    const pageItems = Array.isArray(response.data) ? response.data : [];
    items.push(...(pageItems as NoteDb[]));

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

    const response = await apiPost<NoteDb>(NOTES_API_PATH, payload);
    return convertDbToNote(response.data);
  } catch (error) {
    console.error('Error creating note:', error);
    throw normalizeApiErrorMessage(error, 'Failed to create note');
  }
}

export async function getNote(id: string): Promise<Note | null> {
  try {
    const response = await apiGet<NoteDb>(`${NOTES_API_PATH}/${encodeURIComponent(id)}`);
    return convertDbToNote(response.data);
  } catch (error) {
    if (error instanceof ApiClientError && error.status === 404) {
      return null;
    }
    console.error(`Error getting note ${id}:`, error);
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
    await apiPatch(`${NOTES_API_PATH}/${encodeURIComponent(id)}`, payload);
  } catch (error) {
    console.error(`Error updating note ${id}:`, error);
    throw normalizeApiErrorMessage(error, 'Failed to update note');
  }
}

export async function deleteNote(id: string): Promise<void> {
  try {
    await apiDelete(`${NOTES_API_PATH}/${encodeURIComponent(id)}`);
  } catch (error) {
    console.error(`Error deleting note ${id}:`, error);
    throw normalizeApiErrorMessage(error, 'Failed to delete note');
  }
}

export async function getAllNotes(): Promise<Note[]> {
  try {
    const raw = await fetchAllNotesRaw({ sort: 'updated_at', order: 'desc' });
    return raw
      .map(convertDbToNote)
      .sort((a, b) => b.updated_at - a.updated_at);
  } catch (error) {
    console.error('Error getting all notes:', error);
    throw normalizeApiErrorMessage(error, 'Failed to get notes');
  }
}

// ============================================
// Filtering & Search
// ============================================

export async function getNotesByBot(botId: string): Promise<Note[]> {
  try {
    const notes = await getAllNotes();
    return notes.filter((note) => note.bot_id === botId);
  } catch (error) {
    console.error(`Error getting notes by bot ${botId}:`, error);
    throw normalizeApiErrorMessage(error, 'Failed to get notes by bot');
  }
}

export async function getNotesByProject(projectId: string): Promise<Note[]> {
  try {
    const notes = await getAllNotes();
    return notes.filter((note) => note.project_id === projectId);
  } catch (error) {
    console.error(`Error getting notes by project ${projectId}:`, error);
    throw normalizeApiErrorMessage(error, 'Failed to get notes by project');
  }
}

export async function searchNotes(query: string): Promise<Note[]> {
  try {
    const notes = await getAllNotes();
    const searchLower = String(query || '').toLowerCase();

    return notes.filter((note) => {
      if (note.title.toLowerCase().includes(searchLower)) return true;
      if (note.tags.some((tag) => tag.toLowerCase().includes(searchLower))) return true;
      if (note.content?.toLowerCase().includes(searchLower)) return true;

      if (note.blocks) {
        return note.blocks.some((block) => {
          if ('content' in block) {
            return block.content.toLowerCase().includes(searchLower);
          }
          if ('items' in block) {
            return block.items.some((item) => item.content.toLowerCase().includes(searchLower));
          }
          return false;
        });
      }

      return false;
    });
  } catch (error) {
    console.error(`Error searching notes with query "${query}":`, error);
    throw normalizeApiErrorMessage(error, 'Failed to search notes');
  }
}

export async function getPinnedNotes(): Promise<Note[]> {
  try {
    const notes = await getAllNotes();
    return notes.filter((note) => note.is_pinned);
  } catch (error) {
    console.error('Error getting pinned notes:', error);
    throw normalizeApiErrorMessage(error, 'Failed to get pinned notes');
  }
}

function toNoteIndex(note: Note): NoteIndex {
  const cleanTags = (note.tags || []).filter((tag): tag is string => Boolean(tag));
  return {
    id: note.id,
    title: note.title || '',
    preview: generatePreview(note),
    tags: cleanTags,
    bot_id: note.bot_id ?? null,
    project_id: note.project_id ?? null,
    is_pinned: note.is_pinned ?? false,
    created_at: note.created_at || Date.now(),
    updated_at: note.updated_at || Date.now(),
  };
}

export async function listNotes(
  filter?: NotesFilter,
  sort?: NotesSort
): Promise<NoteIndex[]> {
  try {
    let notes = (await getAllNotes()).map(toNoteIndex);

    if (filter) {
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        notes = notes.filter((n) =>
          n.title.toLowerCase().includes(searchLower)
          || n.preview.toLowerCase().includes(searchLower)
          || n.tags.some((t) => t.toLowerCase().includes(searchLower))
        );
      }

      if (filter.tags?.length) {
        notes = notes.filter((n) => filter.tags!.some((t) => n.tags.includes(t)));
      }

      if (filter.bot_id !== undefined) {
        notes = notes.filter((n) => n.bot_id === filter.bot_id);
      }

      if (filter.project_id !== undefined) {
        notes = notes.filter((n) => n.project_id === filter.project_id);
      }

      if (filter.is_pinned !== undefined) {
        notes = notes.filter((n) => n.is_pinned === filter.is_pinned);
      }
    }

    const sortField = sort?.field || 'updated_at';
    const sortDir = sort?.direction || 'desc';

    notes.sort((a, b) => {
      let comparison = 0;
      if (sortField === 'title') {
        comparison = a.title.localeCompare(b.title);
      } else {
        comparison = (a[sortField] || 0) - (b[sortField] || 0);
      }
      return sortDir === 'asc' ? comparison : -comparison;
    });

    return notes;
  } catch (error) {
    console.error('Error listing notes:', error);
    throw normalizeApiErrorMessage(error, 'Failed to list notes');
  }
}

// ============================================
// Realtime Subscriptions (polling)
// ============================================

export function subscribeToNote(
  id: string,
  callback: (note: Note | null) => void
): Unsubscribe {
  return createPollingSubscription(
    async () => getNote(id),
    callback,
    (error) => {
      console.error(`Error subscribing to note ${id}:`, error);
      callback(null);
    },
    { key: `notes:${id}`, intervalMs: 2000, immediate: true }
  );
}

export function subscribeToAllNotes(
  callback: (notes: Note[]) => void
): Unsubscribe {
  return createPollingSubscription(
    async () => getAllNotes(),
    callback,
    (error) => {
      console.error('Error subscribing to all notes:', error);
      callback([]);
    },
    { key: 'notes:all', intervalMs: DEFAULT_POLL_INTERVAL_MS, immediate: true }
  );
}

export function subscribeToNotesByBot(
  botId: string,
  callback: (notes: Note[]) => void
): Unsubscribe {
  return createPollingSubscription(
    async () => getNotesByBot(botId),
    callback,
    (error) => {
      console.error(`Error subscribing to notes by bot ${botId}:`, error);
      callback([]);
    },
    { key: `notes:bot:${botId}`, intervalMs: DEFAULT_POLL_INTERVAL_MS, immediate: true }
  );
}

export function subscribeToNotesIndex(
  callback: (notes: NoteIndex[]) => void
): Unsubscribe {
  return createPollingSubscription(
    async () => listNotes(),
    callback,
    (error) => {
      console.error('Error subscribing to notes index:', error);
      callback([]);
    },
    { key: 'notes:index', intervalMs: DEFAULT_POLL_INTERVAL_MS, immediate: true }
  );
}

// ============================================
// Utilities
// ============================================

export function createEmptyNote(): Note {
  const now = Date.now();
  return {
    id: generateNoteId(),
    title: 'New Note',
    content: '',
    tags: [],
    bot_id: null,
    project_id: null,
    is_pinned: false,
    created_at: now,
    updated_at: now,
  };
}

export function generateNoteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function generateListItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function createTextBlock(
  content: string,
  type: TextBlock['type'] = 'paragraph'
): TextBlock {
  const now = Date.now();
  return {
    id: generateBlockId(),
    type,
    content,
    created_at: now,
    updated_at: now,
  };
}

export function createCheckboxBlock(
  content: string,
  checked = false
): CheckboxBlock {
  const now = Date.now();
  return {
    id: generateBlockId(),
    type: 'checkbox',
    content,
    checked,
    created_at: now,
    updated_at: now,
  };
}

export function createListBlock(
  type: ListBlock['type'],
  items: string[] = []
): ListBlock {
  const now = Date.now();
  return {
    id: generateBlockId(),
    type,
    items: items.map((content) => ({
      id: generateListItemId(),
      content,
    })),
    created_at: now,
    updated_at: now,
  };
}

// ============================================
// Helper Functions
// ============================================

function convertDbToNote(noteDb: NoteDb): Note {
  let content = noteDb.content || '';
  if (!content && noteDb.blocks) {
    content = convertBlocksToMarkdown(noteDb.blocks);
  }

  const blocks = noteDb.blocks
    ? Object.values(noteDb.blocks).sort((a, b) => a.created_at - b.created_at)
    : [];

  return {
    ...noteDb,
    content,
    blocks: blocks.length > 0 ? blocks : undefined,
    tags: noteDb.tags || [],
    title: noteDb.title || '',
    is_pinned: noteDb.is_pinned ?? false,
    bot_id: noteDb.bot_id ?? null,
    project_id: noteDb.project_id ?? null,
  };
}

function convertBlocksToMarkdown(blocks: Record<string, NoteBlock>): string {
  if (!blocks || Object.keys(blocks).length === 0) {
    return '';
  }

  const blockList = Object.values(blocks).sort((a, b) => a.created_at - b.created_at);
  return blockList.map((block) => {
    switch (block.type) {
      case 'heading_1':
        return `# ${block.content}`;
      case 'heading_2':
        return `## ${block.content}`;
      case 'heading_3':
        return `### ${block.content}`;
      case 'checkbox':
        return `- [${block.checked ? 'x' : ' '}] ${block.content}`;
      case 'bullet_list':
        return block.items.map((item) => `- ${item.content}`).join('\n');
      case 'numbered_list':
        return block.items.map((item, index) => `${index + 1}. ${item.content}`).join('\n');
      case 'paragraph':
      default:
        return block.content;
    }
  }).join('\n\n');
}

function generatePreview(note: Pick<Note, 'content' | 'blocks'>): string {
  if (note.content) {
    const clean = note.content
      .replace(/[#*_`()]/g, '')
      .replaceAll('[', '')
      .replaceAll(']', '');
    return clean.slice(0, 100) + (clean.length > 100 ? '...' : '');
  }

  if (!note.blocks || note.blocks.length === 0) {
    return '';
  }

  const text = note.blocks
    .map((block) => {
      if ('content' in block) return block.content;
      if ('items' in block) return block.items.map((item) => item.content).join(' ');
      return '';
    })
    .join(' ')
    .slice(0, 100);

  return text + (text.length >= 100 ? '...' : '');
}

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
