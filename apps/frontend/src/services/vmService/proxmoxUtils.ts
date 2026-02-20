const AGENT_CONNECTIVITY_ERROR_CODES = new Set([
  'AGENT_OFFLINE',
  'AGENT_NOT_FOUND',
  'AGENT_OWNER_UNASSIGNED',
  'AGENT_OWNER_MISMATCH',
]);

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRunningStatus(status: unknown): boolean {
  return String(status || '').toLowerCase() === 'running';
}

function extractUpid(value: unknown, depth = 0): string {
  if (depth > 6 || value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized || normalized === '[object Object]') {
      return '';
    }
    const match = normalized.match(/UPID:[^\s'"]+/i);
    return match ? match[0] : normalized;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractUpid(item, depth + 1);
      if (extracted) return extracted;
    }
    return '';
  }

  if (typeof value === 'object') {
    const record = value as Record<string, unknown>;
    const candidates: unknown[] = [
      record.upid,
      record.UPID,
      record.task,
      record.taskId,
      record.task_id,
      record.id,
      record.value,
      record.data,
      record.result,
    ];

    for (const candidate of candidates) {
      const extracted = extractUpid(candidate, depth + 1);
      if (extracted) return extracted;
    }
    return '';
  }

  return '';
}

export { AGENT_CONNECTIVITY_ERROR_CODES, extractUpid, isRunningStatus, sleep };
