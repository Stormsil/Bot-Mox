export const notesQueryKeys = {
  all: ['notes'] as const,
  index: () => [...notesQueryKeys.all, 'index'] as const,
  note: (noteId: string) => [...notesQueryKeys.all, 'note', noteId] as const,
};
