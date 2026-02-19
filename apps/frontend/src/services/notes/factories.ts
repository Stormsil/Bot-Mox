import type { CheckboxBlock, ListBlock, Note, TextBlock } from './types';

export function generateNoteId(): string {
  return `note_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function generateBlockId(): string {
  return `block_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

export function generateListItemId(): string {
  return `item_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
}

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

export function createTextBlock(content: string, type: TextBlock['type'] = 'paragraph'): TextBlock {
  const now = Date.now();
  return {
    id: generateBlockId(),
    type,
    content,
    created_at: now,
    updated_at: now,
  };
}

export function createCheckboxBlock(content: string, checked = false): CheckboxBlock {
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

export function createListBlock(type: ListBlock['type'], items: string[] = []): ListBlock {
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
