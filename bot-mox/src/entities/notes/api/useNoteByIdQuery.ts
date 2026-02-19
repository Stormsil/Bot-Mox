import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { Note } from '../model/types';
import { getNote } from './notesContractFacade';
import { notesQueryKeys } from './notesQueryKeys';

const NOTE_REFETCH_MS = 2_000;

export function useNoteByIdQuery(
  noteId: string | null | undefined,
): UseQueryResult<Note | null, Error> {
  const id = String(noteId || '').trim();

  return useQuery<Note | null, Error>({
    queryKey: notesQueryKeys.note(id || 'none'),
    queryFn: () => getNote(id),
    enabled: Boolean(id),
    refetchInterval: NOTE_REFETCH_MS,
  });
}
