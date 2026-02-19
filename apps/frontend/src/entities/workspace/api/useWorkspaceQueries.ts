import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { KanbanTask, WorkspaceCalendarEvent } from '../model/types';
import { fetchCalendarEvents, fetchKanbanTasks } from './workspaceContractFacade';
import { workspaceQueryKeys } from './workspaceQueryKeys';

const WORKSPACE_REFETCH_MS = 6_000;

export function useWorkspaceCalendarEventsQuery(): UseQueryResult<WorkspaceCalendarEvent[], Error> {
  return useQuery<WorkspaceCalendarEvent[], Error>({
    queryKey: workspaceQueryKeys.calendar(),
    queryFn: fetchCalendarEvents,
    refetchInterval: WORKSPACE_REFETCH_MS,
  });
}

export function useWorkspaceKanbanTasksQuery(): UseQueryResult<KanbanTask[], Error> {
  return useQuery<KanbanTask[], Error>({
    queryKey: workspaceQueryKeys.kanban(),
    queryFn: fetchKanbanTasks,
    refetchInterval: WORKSPACE_REFETCH_MS,
  });
}
