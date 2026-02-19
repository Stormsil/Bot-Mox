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
  blocks?: NoteBlock[];
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
