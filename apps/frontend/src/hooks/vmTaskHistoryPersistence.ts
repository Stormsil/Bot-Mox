import { uiLogger } from '../observability/uiLogger';
import { apiGet, createPollingSubscription } from '../services/apiClient';
import type { VMTaskEntry } from '../types';
import { parsePersistedTasks } from './vmLogUtils';

const VM_LOG_TASKS_API_PATH = '/api/v1/settings/vmgenerator/task_logs';

export async function loadPersistedTasks(): Promise<VMTaskEntry[]> {
  const response = await apiGet<unknown>(VM_LOG_TASKS_API_PATH);
  return parsePersistedTasks(response.data);
}

export function subscribeVmTaskHistory(
  applyHydratedTasks: (tasks: VMTaskEntry[]) => void,
  markHydratedOnError: () => void,
) {
  return createPollingSubscription(
    async () => loadPersistedTasks(),
    applyHydratedTasks,
    (error) => {
      uiLogger.error('Failed to load VM task history:', error);
      markHydratedOnError();
    },
    { key: 'settings:vmgenerator:task_logs', intervalMs: 4000, immediate: true },
  );
}
