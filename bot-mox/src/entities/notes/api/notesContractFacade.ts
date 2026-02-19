import { uiLogger } from '../../../observability/uiLogger';
import {
  createWorkspaceNoteViaContract,
  deleteWorkspaceNoteViaContract,
  getWorkspaceNoteViaContract,
  listWorkspaceNotesViaContract,
  patchWorkspaceNoteViaContract,
} from '../../../providers/workspace-contract-client';
import type { CreateNoteData, Note, NoteBlock, NoteIndex, UpdateNoteData } from '../model/types';

interface NoteDb {
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

const FETCH_LIMIT = 200;

function normalizeApiErrorMessage(error: unknown, fallback: string): Error {
  if (error instanceof Error) return error;
  return new Error(fallback);
}

function convertBlocksToMarkdown(blocks: Record<string, NoteBlock>): string {
  if (!blocks || Object.keys(blocks).length === 0) {
    return '';
  }

  const blockList = Object.values(blocks).sort((a, b) => a.created_at - b.created_at);
  return blockList
    .map((block) => {
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
        default:
          return block.content;
      }
    })
    .join('\n\n');
}

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
    const status =
      error && typeof error === 'object' && 'status' in error ? Number(error.status) : NaN;
    if (status === 404) {
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

export async function listNotes(): Promise<NoteIndex[]> {
  try {
    const raw = await fetchAllNotesRaw({ sort: 'updated_at', order: 'desc' });
    return raw
      .map(convertDbToNote)
      .map(toNoteIndex)
      .sort((a, b) => b.updated_at - a.updated_at);
  } catch (error) {
    uiLogger.error('Error listing notes:', error);
    throw normalizeApiErrorMessage(error, 'Failed to list notes');
  }
}
