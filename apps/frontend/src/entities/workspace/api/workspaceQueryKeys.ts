export const workspaceQueryKeys = {
  all: ['workspace'] as const,
  calendar: () => [...workspaceQueryKeys.all, 'calendar', 'events'] as const,
  kanban: () => [...workspaceQueryKeys.all, 'kanban', 'tasks'] as const,
};
