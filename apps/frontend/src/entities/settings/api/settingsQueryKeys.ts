export const settingsQueryKeys = {
  all: ['settings'] as const,
  apiKeys: () => [...settingsQueryKeys.all, 'api-keys'] as const,
  proxy: () => [...settingsQueryKeys.all, 'proxy'] as const,
  notifications: () => [...settingsQueryKeys.all, 'notifications-events'] as const,
  theme: () => [...settingsQueryKeys.all, 'theme'] as const,
  themeAssets: () => [...settingsQueryKeys.all, 'theme-assets'] as const,
  storagePolicy: () => [...settingsQueryKeys.all, 'storage-policy'] as const,
  projects: () => [...settingsQueryKeys.all, 'projects'] as const,
  subscriptionAlerts: () => [...settingsQueryKeys.all, 'subscription-alerts'] as const,
  resourceTree: () => [...settingsQueryKeys.all, 'resource-tree'] as const,
  scheduleGenerator: () => [...settingsQueryKeys.all, 'schedule-generator'] as const,
};
