import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type { CreateNoteData, Note, UpdateNoteData } from '../model/types';
import { createNote, deleteNote, updateNote } from './notesContractFacade';
import { notesQueryKeys } from './notesQueryKeys';

export function useCreateNoteMutation(): UseMutationResult<Note, Error, CreateNoteData> {
  const queryClient = useQueryClient();

  return useMutation<Note, Error, CreateNoteData>({
    mutationFn: async (data) => createNote(data),
    onSuccess: async (createdNote) => {
      await queryClient.invalidateQueries({ queryKey: notesQueryKeys.index() });
      queryClient.setQueryData(notesQueryKeys.note(createdNote.id), createdNote);
    },
  });
}

interface UpdateNotePayload {
  noteId: string;
  payload: UpdateNoteData;
}

export function useUpdateNoteMutation(): UseMutationResult<void, Error, UpdateNotePayload> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateNotePayload>({
    mutationFn: async ({ noteId, payload }) => updateNote(noteId, payload),
    onSuccess: async (_data, variables) => {
      await queryClient.invalidateQueries({ queryKey: notesQueryKeys.index() });
      await queryClient.invalidateQueries({ queryKey: notesQueryKeys.note(variables.noteId) });
    },
  });
}

export function useDeleteNoteMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (noteId) => deleteNote(noteId),
    onSuccess: async (_data, noteId) => {
      await queryClient.invalidateQueries({ queryKey: notesQueryKeys.index() });
      queryClient.removeQueries({ queryKey: notesQueryKeys.note(noteId), exact: true });
    },
  });
}
