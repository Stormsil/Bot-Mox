import type { Note, NoteBlock, NoteDb, NoteIndex } from './types';

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

export function convertDbToNote(noteDb: NoteDb): Note {
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

export function generatePreview(note: Pick<Note, 'content' | 'blocks'>): string {
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

export function toNoteIndex(note: Note): NoteIndex {
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
