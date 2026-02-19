import { type UseMutationResult, useMutation, useQueryClient } from '@tanstack/react-query';
import type {
  CreateCalendarEventData,
  CreateKanbanTaskData,
  UpdateCalendarEventData,
  UpdateKanbanTaskData,
} from '../model/types';
import {
  createCalendarEvent,
  createKanbanTask,
  deleteCalendarEvent,
  deleteKanbanTask,
  updateCalendarEvent,
  updateKanbanTask,
} from './workspaceContractFacade';
import { workspaceQueryKeys } from './workspaceQueryKeys';

interface UpdateCalendarEventPayload {
  id: string;
  data: UpdateCalendarEventData;
}

interface UpdateKanbanTaskPayload {
  id: string;
  data: UpdateKanbanTaskData;
}

export function useCreateCalendarEventMutation(): UseMutationResult<
  string,
  Error,
  CreateCalendarEventData
> {
  const queryClient = useQueryClient();

  return useMutation<string, Error, CreateCalendarEventData>({
    mutationFn: async (data) => createCalendarEvent(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.calendar() });
    },
  });
}

export function useUpdateCalendarEventMutation(): UseMutationResult<
  void,
  Error,
  UpdateCalendarEventPayload
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateCalendarEventPayload>({
    mutationFn: async ({ id, data }) => updateCalendarEvent(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.calendar() });
    },
  });
}

export function useDeleteCalendarEventMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteCalendarEvent(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.calendar() });
    },
  });
}

export function useCreateKanbanTaskMutation(): UseMutationResult<
  string,
  Error,
  CreateKanbanTaskData
> {
  const queryClient = useQueryClient();

  return useMutation<string, Error, CreateKanbanTaskData>({
    mutationFn: async (data) => createKanbanTask(data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.kanban() });
    },
  });
}

export function useUpdateKanbanTaskMutation(): UseMutationResult<
  void,
  Error,
  UpdateKanbanTaskPayload
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, UpdateKanbanTaskPayload>({
    mutationFn: async ({ id, data }) => updateKanbanTask(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.kanban() });
    },
  });
}

export function useDeleteKanbanTaskMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (id) => deleteKanbanTask(id),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: workspaceQueryKeys.kanban() });
    },
  });
}
