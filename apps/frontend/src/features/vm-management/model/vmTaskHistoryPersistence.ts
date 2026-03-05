import { readVmTaskLogs } from '../../../entities/vm/api/vmTaskLogFacade';
import type { VMTaskEntry } from '../../../shared/types';
import { parsePersistedTasks } from './vmLogUtils';

export async function loadPersistedTasks(): Promise<VMTaskEntry[]> {
  const data = await readVmTaskLogs();
  return parsePersistedTasks(data);
}
