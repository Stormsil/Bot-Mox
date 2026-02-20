import { toNoteIndex } from './mappers';
import type { Note, NoteIndex, NotesFilter, NotesSort } from './types';

export function filterNotesByBot(notes: Note[], botId: string): Note[] {
  return notes.filter((note) => note.bot_id === botId);
}

export function filterNotesByProject(notes: Note[], projectId: string): Note[] {
  return notes.filter((note) => note.project_id === projectId);
}

export function searchNotesInCollection(notes: Note[], query: string): Note[] {
  const searchLower = String(query || '').toLowerCase();
  if (!searchLower) {
    return notes;
  }

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
}

export function getPinnedNotesFromCollection(notes: Note[]): Note[] {
  return notes.filter((note) => note.is_pinned);
}

export function listNoteIndexes(
  notes: Note[],
  filter?: NotesFilter,
  sort?: NotesSort,
): NoteIndex[] {
  let indexes = notes.map(toNoteIndex);

  if (filter) {
    if (filter.search) {
      const searchLower = filter.search.toLowerCase();
      indexes = indexes.filter(
        (n) =>
          n.title.toLowerCase().includes(searchLower) ||
          n.preview.toLowerCase().includes(searchLower) ||
          n.tags.some((t) => t.toLowerCase().includes(searchLower)),
      );
    }

    if (filter.tags?.length) {
      indexes = indexes.filter((n) => filter.tags?.some((t) => n.tags.includes(t)));
    }

    if (filter.bot_id !== undefined) {
      indexes = indexes.filter((n) => n.bot_id === filter.bot_id);
    }

    if (filter.project_id !== undefined) {
      indexes = indexes.filter((n) => n.project_id === filter.project_id);
    }

    if (filter.is_pinned !== undefined) {
      indexes = indexes.filter((n) => n.is_pinned === filter.is_pinned);
    }
  }

  const sortField = sort?.field || 'updated_at';
  const sortDir = sort?.direction || 'desc';
  indexes.sort((a, b) => {
    let comparison = 0;
    if (sortField === 'title') {
      comparison = a.title.localeCompare(b.title);
    } else {
      comparison = (a[sortField] || 0) - (b[sortField] || 0);
    }
    return sortDir === 'asc' ? comparison : -comparison;
  });

  return indexes;
}
