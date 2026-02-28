import type { VMQueueItemStatus, VMStorageOption } from '../../types';

export function toMemoryMb(memory?: number): number | null {
  if (!Number.isFinite(memory)) return null;
  const value = Math.max(0, Math.trunc(Number(memory)));
  if (value <= 0) return null;
  if (value <= 64) return value * 1024;
  return value;
}

export function formatMemoryGiB(memoryMb: number): string {
  const gib = memoryMb / 1024;
  if (Number.isInteger(gib)) {
    return `${gib} GiB`;
  }
  return `${gib.toFixed(1)} GiB`;
}

function formatGb(bytes: number): string {
  const gb = bytes / 1_000_000_000;
  if (!Number.isFinite(gb) || gb < 0) return '0.00';
  return gb.toFixed(2);
}

export function buildStorageUsage(opt: VMStorageOption): null | { percent: number; label: string } {
  const used = Number(opt.usedBytes);
  const total = Number(opt.totalBytes);
  if (!Number.isFinite(used) || used < 0 || !Number.isFinite(total) || total <= 0) return null;

  const percent = (used / total) * 100;
  const safePercent = Number.isFinite(percent) ? Math.min(100, Math.max(0, percent)) : 0;
  return {
    percent: safePercent,
    label: `${safePercent.toFixed(2)}% (${formatGb(used)} GB of ${formatGb(total)} GB)`,
  };
}

export function getStatusDisplay(status: VMQueueItemStatus): {
  text: string;
  tone: 'idle' | 'running' | 'ok' | 'error';
} {
  switch (status) {
    case 'done':
      return { text: 'Done', tone: 'ok' };
    case 'cloned':
      return { text: 'Queued', tone: 'idle' };
    case 'cloning':
      return { text: 'Running', tone: 'running' };
    case 'configuring':
      return { text: 'Running', tone: 'running' };
    case 'provisioning':
      return { text: 'Provisioning', tone: 'running' };
    case 'deleting':
      return { text: 'Deleting', tone: 'running' };
    case 'error':
      return { text: 'Error', tone: 'error' };
    default:
      return { text: 'Queued', tone: 'idle' };
  }
}
