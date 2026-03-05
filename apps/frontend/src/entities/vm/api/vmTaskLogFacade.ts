import type { VMTaskEntry } from '../../../shared/types';
import { readSettingsPath, writeSettingsPath } from '../../settings/api/settingsPathClient';

const VM_LOG_TASKS_PATH = 'vmgenerator/task_logs';

export async function readVmTaskLogs(): Promise<unknown> {
  return readSettingsPath<unknown>(VM_LOG_TASKS_PATH);
}

export async function writeVmTaskLogs(tasks: VMTaskEntry[]): Promise<void> {
  await writeSettingsPath(VM_LOG_TASKS_PATH, tasks);
}
