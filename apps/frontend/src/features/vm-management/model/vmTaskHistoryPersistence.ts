import { apiGet } from '../../../shared/api/apiClient';
import type { VMTaskEntry } from '../../../shared/types';
import { parsePersistedTasks } from './vmLogUtils';

const VM_LOG_TASKS_API_PATH = '/api/v1/settings/vmgenerator/task_logs';

export async function loadPersistedTasks(): Promise<VMTaskEntry[]> {
  const response = await apiGet<unknown>(VM_LOG_TASKS_API_PATH);
  return parsePersistedTasks(response.data);
}
