export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeTimeoutMs(
  value: unknown,
  fallbackMs: number,
  bounds: { min: number; max: number },
): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallbackMs;
  }
  return Math.max(bounds.min, Math.min(bounds.max, Math.trunc(parsed)));
}

export function extractUpid(value: unknown, depth = 0): string | null {
  if (depth > 6 || value === null || value === undefined) {
    return null;
  }

  if (typeof value === 'string') {
    const normalized = value.trim();
    if (!normalized || normalized === '[object Object]') {
      return null;
    }
    const match = normalized.match(/UPID:[^\s'"]+/i);
    return match ? match[0] : normalized;
  }

  if (Array.isArray(value)) {
    for (const item of value) {
      const extracted = extractUpid(item, depth + 1);
      if (extracted) return extracted;
    }
    return null;
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
    return null;
  }

  return null;
}

export function normalizeVmId(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Math.trunc(parsed) < 1) {
    throw new Error('vmid is required');
  }
  return Math.trunc(parsed);
}

export function parseTaggedErrorCode(message: string): string {
  const match = String(message || '')
    .trim()
    .match(/^([A-Z_]+):/);
  return match ? match[1] : 'SSH_EXEC_ERROR';
}

export function buildVmConfigWriteCommand(vmid: number, content: string): string {
  const normalizedContent = String(content || '');
  if (!normalizedContent.trim()) {
    throw new Error('content is required for proxmox.ssh-write-config');
  }
  let marker = `BOTMOX_VM_CONFIG_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  while (normalizedContent.includes(marker)) {
    marker = `${marker}_X`;
  }
  const body = normalizedContent.endsWith('\n') ? normalizedContent : `${normalizedContent}\n`;
  return `cat > /etc/pve/qemu-server/${vmid}.conf <<'${marker}'\n${body}${marker}`;
}
