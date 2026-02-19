export const botQueryKeys = {
  all: ['bot'] as const,
  lists: () => [...botQueryKeys.all, 'list'] as const,
  list: (scope: string) => [...botQueryKeys.lists(), scope] as const,
  details: () => [...botQueryKeys.all, 'detail'] as const,
  byId: (botId: string) => [...botQueryKeys.details(), botId] as const,
  referenceData: (projectId: string) => [...botQueryKeys.all, 'reference-data', projectId] as const,
};
