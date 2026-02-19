import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { NoteIndex } from '../model/types';
import { listNotes } from './notesContractFacade';
import { notesQueryKeys } from './notesQueryKeys';

const NOTES_INDEX_REFETCH_MS = 3_000;

export function useNotesIndexQuery(): UseQueryResult<NoteIndex[], Error> {
  return useQuery<NoteIndex[], Error>({
    queryKey: notesQueryKeys.index(),
    queryFn: () => listNotes(),
    refetchInterval: NOTES_INDEX_REFETCH_MS,
  });
}
