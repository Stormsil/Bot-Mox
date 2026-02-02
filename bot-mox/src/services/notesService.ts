/**
 * @fileoverview Сервис для работы с заметками (Notes Service)
 * Работает с Firebase Realtime Database
 * Путь: notes_v2/{note_id}
 * 
 * Версия 2: Упрощенная структура с markdown content вместо blocks
 * Сохраняет backward compatibility со старыми заметками
 */

import { ref, get, set, update, remove, onValue, off, push } from 'firebase/database';
import { database } from '../utils/firebase';

// ============================================
// Type Definitions
// ============================================

/**
 * Заметка (основной интерфейс) - упрощенная версия с markdown content
 */
export interface Note {
  id: string;
  title: string;
  content: string;  // Markdown content вместо blocks
  tags: string[];
  bot_id: string | null;
  project_id: string | null;
  is_pinned: boolean;
  created_at: number;
  updated_at: number;
  created_by?: string;
  // Deprecated: blocks оставлено для backward compatibility
  blocks?: NoteBlock[];
}

/**
 * Тип блока заметки (DEPRECATED - для backward compatibility)
 */
export type NoteBlockType =
  | 'heading_1'
  | 'heading_2'
  | 'heading_3'
  | 'paragraph'
  | 'checkbox'
  | 'bullet_list'
  | 'numbered_list';

/**
 * Базовый интерфейс для всех блоков (DEPRECATED)
 */
export interface NoteBlockBase {
  id: string;
  type: NoteBlockType;
  created_at: number;
  updated_at: number;
}

/**
 * Текстовый блок (DEPRECATED)
 */
export interface TextBlock extends NoteBlockBase {
  type: 'heading_1' | 'heading_2' | 'heading_3' | 'paragraph';
  content: string;
}

/**
 * Блок чекбокса (DEPRECATED)
 */
export interface CheckboxBlock extends NoteBlockBase {
  type: 'checkbox';
  content: string;
  checked: boolean;
}

/**
 * Элемент списка (DEPRECATED)
 */
export interface ListItem {
  id: string;
  content: string;
  checked?: boolean;
}

/**
 * Блок списка (DEPRECATED)
 */
export interface ListBlock extends NoteBlockBase {
  type: 'bullet_list' | 'numbered_list';
  items: ListItem[];
}

/**
 * Объединенный тип блока заметки (DEPRECATED)
 */
export type NoteBlock = TextBlock | CheckboxBlock | ListBlock;

/**
 * Заметка в формате Firebase (новая версия с content)
 */
export interface NoteDb {
  id: string;
  title: string;
  content?: string;  // Новое поле для markdown
  blocks?: Record<string, NoteBlock>;  // DEPRECATED: для старых заметок
  tags: string[];
  bot_id: string | null;
  project_id: string | null;
  is_pinned: boolean;
  created_at: number;
  updated_at: number;
  created_by?: string;
}

/**
 * Упрощенная версия для списка (индекс)
 */
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

/**
 * Данные для создания заметки
 */
export interface CreateNoteData {
  title: string;
  bot_id?: string | null;
  project_id?: string | null;
  tags?: string[];
}

/**
 * Данные для обновления заметки
 */
export interface UpdateNoteData {
  title?: string;
  content?: string;  // Новое поле
  blocks?: NoteBlock[];  // DEPRECATED
  tags?: string[];
  is_pinned?: boolean;
}

/**
 * Фильтр для поиска заметок
 */
export interface NotesFilter {
  search?: string;
  tags?: string[];
  bot_id?: string | null;
  project_id?: string | null;
  is_pinned?: boolean;
}

/**
 * Сортировка заметок
 */
export interface NotesSort {
  field: 'updated_at' | 'created_at' | 'title';
  direction: 'asc' | 'desc';
}

/**
 * Функция отписки от realtime обновлений
 */
export type Unsubscribe = () => void;

// ============================================
// Constants
// ============================================

const NOTES_PATH = 'notes_v2';
const NOTES_INDEX_PATH = 'notes_index';

// ============================================
// CRUD Operations
// ============================================

/**
 * Создает новую заметку
 * @param data - Данные для создания заметки
 * @param userId - ID пользователя (опционально)
 * @returns Созданная заметка
 */
export async function createNote(data: CreateNoteData, userId?: string): Promise<Note> {
  try {
    const notesRef = ref(database, NOTES_PATH);
    const newNoteRef = push(notesRef);
    const noteId = newNoteRef.key!;
    const now = Date.now();

    const noteDb: NoteDb = {
      id: noteId,
      title: data.title,
      content: '',  // Пустой markdown content
      tags: data.tags || [],
      bot_id: data.bot_id ?? null,
      project_id: data.project_id ?? null,
      is_pinned: false,
      created_at: now,
      updated_at: now,
    };

    if (userId) {
      noteDb.created_by = userId;
    }

    await set(newNoteRef, noteDb);
    await updateNoteIndex(noteId, noteDb);

    return convertDbToNote(noteDb);
  } catch (error) {
    console.error('Error creating note:', error);
    throw new Error('Failed to create note');
  }
}

/**
 * Получает заметку по ID
 * @param id - ID заметки
 * @returns Заметка или null если не найдена
 */
export async function getNote(id: string): Promise<Note | null> {
  try {
    const noteRef = ref(database, `${NOTES_PATH}/${id}`);
    const snapshot = await get(noteRef);

    if (!snapshot.exists()) {
      return null;
    }

    return convertDbToNote(snapshot.val() as NoteDb);
  } catch (error) {
    console.error(`Error getting note ${id}:`, error);
    throw new Error('Failed to get note');
  }
}

/**
 * Обновляет заметку
 * @param id - ID заметки
 * @param data - Данные для обновления
 */
export async function updateNote(id: string, data: UpdateNoteData): Promise<void> {
  try {
    const updates: Record<string, unknown> = {
      [`${NOTES_PATH}/${id}/updated_at`]: Date.now(),
    };

    if (data.title !== undefined) {
      updates[`${NOTES_PATH}/${id}/title`] = data.title;
    }

    // Новое поле content имеет приоритет
    if (data.content !== undefined) {
      updates[`${NOTES_PATH}/${id}/content`] = data.content;
    }

    // DEPRECATED: blocks оставлено для backward compatibility
    if (data.blocks !== undefined) {
      const blocksObj: Record<string, NoteBlock> = {};
      data.blocks.forEach(block => {
        blocksObj[block.id] = {
          ...block,
          updated_at: Date.now(),
        };
      });
      updates[`${NOTES_PATH}/${id}/blocks`] = blocksObj;
    }

    if (data.tags !== undefined) {
      updates[`${NOTES_PATH}/${id}/tags`] = data.tags;
    }

    if (data.is_pinned !== undefined) {
      updates[`${NOTES_PATH}/${id}/is_pinned`] = data.is_pinned;
    }

    await update(ref(database), updates);
    await updateNoteIndexFromDb(id);
  } catch (error) {
    console.error(`Error updating note ${id}:`, error);
    throw new Error('Failed to update note');
  }
}

/**
 * Удаляет заметку
 * @param id - ID заметки
 */
export async function deleteNote(id: string): Promise<void> {
  try {
    const noteRef = ref(database, `${NOTES_PATH}/${id}`);
    const indexRef = ref(database, `${NOTES_INDEX_PATH}/${id}`);

    await remove(noteRef);
    await remove(indexRef);
  } catch (error) {
    console.error(`Error deleting note ${id}:`, error);
    throw new Error('Failed to delete note');
  }
}

/**
 * Получает все заметки
 * @returns Массив всех заметок
 */
export async function getAllNotes(): Promise<Note[]> {
  try {
    const notesRef = ref(database, NOTES_PATH);
    const snapshot = await get(notesRef);

    if (!snapshot.exists()) {
      return [];
    }

    const notesData = snapshot.val() as Record<string, NoteDb>;
    return Object.values(notesData)
      .map(convertDbToNote)
      .sort((a, b) => b.updated_at - a.updated_at);
  } catch (error) {
    console.error('Error getting all notes:', error);
    throw new Error('Failed to get notes');
  }
}

// ============================================
// Filtering & Search
// ============================================

/**
 * Получает заметки по ID бота
 * @param botId - ID бота
 * @returns Массив заметок привязанных к боту
 */
export async function getNotesByBot(botId: string): Promise<Note[]> {
  try {
    const notes = await getAllNotes();
    return notes.filter(note => note.bot_id === botId);
  } catch (error) {
    console.error(`Error getting notes by bot ${botId}:`, error);
    throw new Error('Failed to get notes by bot');
  }
}

/**
 * Получает заметки по ID проекта
 * @param projectId - ID проекта
 * @returns Массив заметок привязанных к проекту
 */
export async function getNotesByProject(projectId: string): Promise<Note[]> {
  try {
    const notes = await getAllNotes();
    return notes.filter(note => note.project_id === projectId);
  } catch (error) {
    console.error(`Error getting notes by project ${projectId}:`, error);
    throw new Error('Failed to get notes by project');
  }
}

/**
 * Поиск заметок по запросу
 * @param query - Поисковый запрос
 * @returns Массив найденных заметок
 */
export async function searchNotes(query: string): Promise<Note[]> {
  try {
    const notes = await getAllNotes();
    const searchLower = query.toLowerCase();

    return notes.filter(note => {
      // Поиск по заголовку
      if (note.title.toLowerCase().includes(searchLower)) {
        return true;
      }

      // Поиск по тегам
      if (note.tags.some(tag => tag.toLowerCase().includes(searchLower))) {
        return true;
      }

      // Поиск по content (markdown)
      if (note.content?.toLowerCase().includes(searchLower)) {
        return true;
      }

      // DEPRECATED: поиск по блокам для старых заметок
      if (note.blocks) {
        return note.blocks.some(block => {
          if ('content' in block) {
            return block.content.toLowerCase().includes(searchLower);
          }
          if ('items' in block) {
            return block.items.some(item =>
              item.content.toLowerCase().includes(searchLower)
            );
          }
          return false;
        });
      }

      return false;
    });
  } catch (error) {
    console.error(`Error searching notes with query "${query}":`, error);
    throw new Error('Failed to search notes');
  }
}

/**
 * Получает закрепленные заметки
 * @returns Массив закрепленных заметок
 */
export async function getPinnedNotes(): Promise<Note[]> {
  try {
    const notes = await getAllNotes();
    return notes.filter(note => note.is_pinned);
  } catch (error) {
    console.error('Error getting pinned notes:', error);
    throw new Error('Failed to get pinned notes');
  }
}

/**
 * Получает список заметок с фильтрацией и сортировкой
 * @param filter - Фильтр для заметок
 * @param sort - Параметры сортировки
 * @returns Массив индексов заметок
 */
export async function listNotes(
  filter?: NotesFilter,
  sort?: NotesSort
): Promise<NoteIndex[]> {
  try {
    const indexRef = ref(database, NOTES_INDEX_PATH);
    const snapshot = await get(indexRef);

    if (!snapshot.exists()) {
      return [];
    }

    let notes: NoteIndex[] = Object.values(snapshot.val());

    // Применяем фильтры
    if (filter) {
      if (filter.search) {
        const searchLower = filter.search.toLowerCase();
        notes = notes.filter(n =>
          n.title.toLowerCase().includes(searchLower) ||
          n.preview.toLowerCase().includes(searchLower) ||
          n.tags.some(t => t.toLowerCase().includes(searchLower))
        );
      }

      if (filter.tags?.length) {
        notes = notes.filter(n =>
          filter.tags!.some(t => n.tags.includes(t))
        );
      }

      if (filter.bot_id !== undefined) {
        notes = notes.filter(n => n.bot_id === filter.bot_id);
      }

      if (filter.project_id !== undefined) {
        notes = notes.filter(n => n.project_id === filter.project_id);
      }

      if (filter.is_pinned !== undefined) {
        notes = notes.filter(n => n.is_pinned === filter.is_pinned);
      }
    }

    // Применяем сортировку
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
    throw new Error('Failed to list notes');
  }
}

// ============================================
// Realtime Subscriptions
// ============================================

/**
 * Подписывается на обновления конкретной заметки
 * @param id - ID заметки
 * @param callback - Функция обратного вызова
 * @returns Функция для отписки
 */
export function subscribeToNote(
  id: string,
  callback: (note: Note | null) => void
): Unsubscribe {
  const noteRef = ref(database, `${NOTES_PATH}/${id}`);

  const handleValue = (snapshot: { exists: () => boolean; val: () => NoteDb }) => {
    if (snapshot.exists()) {
      callback(convertDbToNote(snapshot.val()));
    } else {
      callback(null);
    }
  };

  onValue(noteRef, handleValue, (error: Error) => {
    console.error(`Error subscribing to note ${id}:`, error);
    callback(null);
  });

  return () => off(noteRef, 'value', handleValue);
}

/**
 * Подписывается на обновления всех заметок
 * @param callback - Функция обратного вызова
 * @returns Функция для отписки
 */
export function subscribeToAllNotes(
  callback: (notes: Note[]) => void
): Unsubscribe {
  const notesRef = ref(database, NOTES_PATH);

  const handleValue = (snapshot: { exists: () => boolean; val: () => Record<string, NoteDb> }) => {
    if (snapshot.exists()) {
      const notesData = snapshot.val();
      const notes = Object.values(notesData)
        .map(convertDbToNote)
        .sort((a, b) => b.updated_at - a.updated_at);
      callback(notes);
    } else {
      callback([]);
    }
  };

  onValue(notesRef, handleValue, (error: Error) => {
    console.error('Error subscribing to all notes:', error);
    callback([]);
  });

  return () => off(notesRef, 'value', handleValue);
}

/**
 * Подписывается на обновления заметок по ID бота
 * @param botId - ID бота
 * @param callback - Функция обратного вызова
 * @returns Функция для отписки
 */
export function subscribeToNotesByBot(
  botId: string,
  callback: (notes: Note[]) => void
): Unsubscribe {
  const notesRef = ref(database, NOTES_PATH);

  const handleValue = (snapshot: { exists: () => boolean; val: () => Record<string, NoteDb> }) => {
    if (snapshot.exists()) {
      const notesData = snapshot.val();
      const notes = Object.values(notesData)
        .filter(noteDb => noteDb.bot_id === botId)
        .map(convertDbToNote)
        .sort((a, b) => b.updated_at - a.updated_at);
      callback(notes);
    } else {
      callback([]);
    }
  };

  onValue(notesRef, handleValue, (error: Error) => {
    console.error(`Error subscribing to notes by bot ${botId}:`, error);
    callback([]);
  });

  return () => off(notesRef, 'value', handleValue);
}

/**
 * Подписывается на индекс заметок (для списков)
 * @param callback - Функция обратного вызова
 * @returns Функция для отписки
 */
export function subscribeToNotesIndex(
  callback: (notes: NoteIndex[]) => void
): Unsubscribe {
  const indexRef = ref(database, NOTES_INDEX_PATH);

  const handleValue = (snapshot: { exists: () => boolean; val: () => Record<string, NoteIndex> }) => {
    if (snapshot.exists()) {
      const notes = Object.values(snapshot.val()) as NoteIndex[];
      callback(notes.sort((a, b) => b.updated_at - a.updated_at));
    } else {
      callback([]);
    }
  };

  onValue(indexRef, handleValue, (error: Error) => {
    console.error('Error subscribing to notes index:', error);
    callback([]);
  });

  return () => off(indexRef, 'value', handleValue);
}

// ============================================
// Utilities
// ============================================

/**
 * Создает пустую заметку с markdown content
 * @returns Объект пустой заметки
 */
export function createEmptyNote(): Note {
  const now = Date.now();

  return {
    id: generateNoteId(),
    title: 'New Note',
    content: '',  // Пустой markdown
    tags: [],
    bot_id: null,
    project_id: null,
    is_pinned: false,
    created_at: now,
    updated_at: now,
  };
}

/**
 * Генерирует уникальный ID для заметки
 * @returns Уникальный ID
 */
export function generateNoteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Генерирует уникальный ID для блока (DEPRECATED)
 * @returns Уникальный ID блока
 */
export function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Генерирует уникальный ID для элемента списка (DEPRECATED)
 * @returns Уникальный ID элемента
 */
export function generateListItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Создает текстовый блок (DEPRECATED)
 * @param content - Содержимое блока
 * @param type - Тип блока (по умолчанию paragraph)
 * @returns Текстовый блок
 */
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

/**
 * Создает блок чекбокса (DEPRECATED)
 * @param content - Текст чекбокса
 * @param checked - Состояние чекбокса
 * @returns Блок чекбокса
 */
export function createCheckboxBlock(
  content: string,
  checked: boolean = false
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

/**
 * Создает блок списка (DEPRECATED)
 * @param type - Тип списка
 * @param items - Элементы списка
 * @returns Блок списка
 */
export function createListBlock(
  type: ListBlock['type'],
  items: string[] = []
): ListBlock {
  const now = Date.now();
  return {
    id: generateBlockId(),
    type,
    items: items.map(content => ({
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

/**
 * Конвертирует заметку из формата Firebase в формат приложения
 * Поддерживает как новые заметки (content), так и старые (blocks)
 * @param noteDb - Заметка в формате Firebase
 * @returns Заметка в формате приложения
 */
function convertDbToNote(noteDb: NoteDb): Note {
  // Если есть content - используем его (новый формат)
  // Если нет content, но есть blocks - конвертируем blocks в markdown (старый формат)
  let content = noteDb.content || '';
  
  // DEPRECATED: конвертация старых заметок с blocks в markdown
  if (!content && noteDb.blocks) {
    content = convertBlocksToMarkdown(noteDb.blocks);
  }

  // DEPRECATED: конвертация blocks для backward compatibility
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

/**
 * Конвертирует старые блоки в markdown текст
 * @param blocks - Объект блоков из Firebase
 * @returns Markdown строка
 */
function convertBlocksToMarkdown(blocks: Record<string, NoteBlock>): string {
  if (!blocks || Object.keys(blocks).length === 0) {
    return '';
  }

  const blockList = Object.values(blocks).sort((a, b) => a.created_at - b.created_at);
  
  return blockList.map(block => {
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
        return block.items.map(item => `- ${item.content}`).join('\n');
      case 'numbered_list':
        return block.items.map((item, index) => `${index + 1}. ${item.content}`).join('\n');
      case 'paragraph':
      default:
        return block.content;
    }
  }).join('\n\n');
}

/**
 * Генерирует превью текста из content или blocks
 * @param noteDb - Данные заметки из Firebase
 * @returns Превью текста (до 100 символов)
 */
function generatePreview(noteDb: NoteDb): string {
  // Приоритет у нового поля content
  if (noteDb.content) {
    return noteDb.content.replace(/[#*_`\[\]\(\)]/g, '').slice(0, 100) + 
      (noteDb.content.length > 100 ? '...' : '');
  }

  // DEPRECATED: генерация preview из blocks для старых заметок
  if (!noteDb.blocks || Object.keys(noteDb.blocks).length === 0) {
    return '';
  }

  const blockList = Object.values(noteDb.blocks).sort((a, b) => a.created_at - b.created_at);
  const text = blockList
    .map(b => {
      if ('content' in b) return b.content;
      if ('items' in b) return b.items.map(i => i.content).join(' ');
      return '';
    })
    .join(' ')
    .slice(0, 100);

  return text + (text.length >= 100 ? '...' : '');
}

/**
 * Обновляет индекс заметки
 * @param noteId - ID заметки
 * @param noteDb - Данные заметки
 */
async function updateNoteIndex(noteId: string, noteDb: NoteDb): Promise<void> {
  try {
    // Фильтруем undefined значения в tags
    const cleanTags = (noteDb.tags || []).filter((tag): tag is string => tag !== undefined && tag !== null);

    const index: NoteIndex = {
      id: noteId,
      title: noteDb.title || '',
      preview: generatePreview(noteDb),
      tags: cleanTags,
      bot_id: noteDb.bot_id ?? null,
      project_id: noteDb.project_id ?? null,
      is_pinned: noteDb.is_pinned ?? false,
      created_at: noteDb.created_at || Date.now(),
      updated_at: noteDb.updated_at || Date.now(),
    };

    const indexRef = ref(database, `${NOTES_INDEX_PATH}/${noteId}`);
    await set(indexRef, index);
  } catch (error) {
    console.error(`Error updating note index for ${noteId}:`, error);
  }
}

/**
 * Обновляет индекс заметки из базы данных
 * @param noteId - ID заметки
 */
async function updateNoteIndexFromDb(noteId: string): Promise<void> {
  try {
    const noteRef = ref(database, `${NOTES_PATH}/${noteId}`);
    const snapshot = await get(noteRef);

    if (snapshot.exists()) {
      await updateNoteIndex(noteId, snapshot.val() as NoteDb);
    }
  } catch (error) {
    console.error(`Error updating note index from db for ${noteId}:`, error);
  }
}

// ============================================
// Default Export
// ============================================

/**
 * Сервис для работы с заметками
 */
export const notesService = {
  // CRUD
  createNote,
  getNote,
  updateNote,
  deleteNote,
  getAllNotes,

  // Filtering & Search
  getNotesByBot,
  getNotesByProject,
  searchNotes,
  getPinnedNotes,
  listNotes,

  // Realtime Subscriptions
  subscribeToNote,
  subscribeToAllNotes,
  subscribeToNotesByBot,
  subscribeToNotesIndex,

  // Utilities
  createEmptyNote,
  generateNoteId,
  generateBlockId,
  generateListItemId,
  createTextBlock,
  createCheckboxBlock,
  createListBlock,
};
