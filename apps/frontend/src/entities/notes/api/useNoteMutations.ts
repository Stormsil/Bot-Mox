import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import { message } from 'antd';
import { mutationToastOwnershipMetaKeys } from '../../../shared/lib/query/mutationToastOwnership';
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
      message.success('Note created');
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
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'notes.update',
    },
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
    meta: {
      [mutationToastOwnershipMetaKeys.suppressGlobalErrorToast]: true,
      [mutationToastOwnershipMetaKeys.localErrorToastOwner]: true,
      [mutationToastOwnershipMetaKeys.errorToastDedupeKey]: 'notes.delete',
    },
    onSuccess: async (_data, noteId) => {
      await queryClient.invalidateQueries({ queryKey: notesQueryKeys.index() });
      queryClient.removeQueries({ queryKey: notesQueryKeys.note(noteId), exact: true });
      message.success('Note deleted');
    },
  });
}
