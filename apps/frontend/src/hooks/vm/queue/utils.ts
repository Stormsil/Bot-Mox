import type { VMLog } from '../../useVMLog';
import { MUTABLE_PROXMOX_CONFIG_KEY } from './constants';

export function proxmoxConfigToText(config: Record<string, unknown>): string {
  const lines = Object.entries(config)
    .filter(([key, value]) => key !== 'digest' && value !== undefined && value !== null)
    .map(([key, value]) => `${key}: ${String(value)}`);
  return lines.join('\n');
}

export function parseConfigTextToMap(configText: string): Record<string, string> {
  const result: Record<string, string> = {};
  for (const line of configText.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);
    if (!match) continue;
    result[match[1]] = match[2];
  }
  return result;
}

export function buildMutableConfigPatch(
  originalConfig: Record<string, unknown>,
  patchedConfigText: string,
): Record<string, string> {
  const originalMap: Record<string, string> = {};
  for (const [key, value] of Object.entries(originalConfig)) {
    if (!MUTABLE_PROXMOX_CONFIG_KEY.test(key)) continue;
    if (value === undefined || value === null) continue;
    originalMap[key] = String(value);
  }

  const patchedMap = parseConfigTextToMap(patchedConfigText);
  const patchPayload: Record<string, string> = {};

  for (const [key, value] of Object.entries(patchedMap)) {
    if (!MUTABLE_PROXMOX_CONFIG_KEY.test(key)) continue;
    if (originalMap[key] !== value) {
      patchPayload[key] = value;
    }
  }

  return patchPayload;
}

export function extractUuidAndIp(configText: string): { uuid: string; ip: string } {
  const uuidMatch = configText.match(/smbios1:\s*.*?\buuid=([a-fA-F0-9-]+)/i);
  const ipMatch = configText.match(/type=11,value=([0-9.]+)/i);
  return {
    uuid: uuidMatch ? uuidMatch[1] : '',
    ip: ipMatch ? ipMatch[1] : '',
  };
}

export function clipValue(value: unknown, maxLength = 120): string {
  const text = String(value ?? '').trim();
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 1)}...`;
}

export function formatConfigValue(value: unknown, maxLength = 120): string {
  const clipped = clipValue(value, maxLength);
  return clipped || '(empty)';
}

export function formatConfigValueFull(value: unknown): string {
  const text = String(value ?? '').trim();
  return text || '(empty)';
}

export function formatMemoryWithGb(memoryMb: number): string {
  const gb = memoryMb / 1024;
  const gbLabel = Number.isInteger(gb) ? String(gb) : gb.toFixed(1).replace(/\.0$/, '');
  return `${memoryMb}MB (${gbLabel}GB)`;
}

export function buildConfigDiffLines(
  before: Record<string, unknown>,
  after: Record<string, unknown>,
  fields: readonly string[],
): string[] {
  const lines: string[] = [];
  for (const field of fields) {
    const beforeValue = formatConfigValueFull(before[field]);
    const afterValue = formatConfigValueFull(after[field]);
    if (beforeValue !== afterValue) {
      lines.push(`${field}: ${beforeValue} -> ${afterValue}`);
    }
  }
  return lines;
}

export function logTaskFieldChanges(
  log: Pick<VMLog, 'taskLog'>,
  taskKey: string,
  title: string,
  lines: string[],
): void {
  if (lines.length === 0) {
    log.taskLog(taskKey, `${title}: no changes`);
    return;
  }
  log.taskLog(taskKey, `${title} (${lines.length}):`);
  for (const line of lines) {
    log.taskLog(taskKey, `  ${line}`);
  }
}

export function buildPatchChangeLines(
  changes: Array<{ field: string; oldValue: string; newValue: string }>,
  originalIp: string,
): string[] {
  return changes.map((change) => {
    const oldValue =
      change.field === 'IP (SMBIOS)'
        ? String(change.oldValue || '').trim() || originalIp
        : change.oldValue;
    return `${change.field}: ${formatConfigValueFull(oldValue)} -> ${formatConfigValueFull(change.newValue)}`;
  });
}

export interface ExpectationCheck {
  field: string;
  expected: string;
  actual: string;
  ok: boolean;
}

export function buildExpectationCheck(
  field: string,
  expected: unknown,
  actual: unknown,
): ExpectationCheck {
  const expectedText = formatConfigValue(expected, 120);
  const actualText = formatConfigValue(actual, 120);
  return {
    field,
    expected: expectedText,
    actual: actualText,
    ok: expectedText === actualText,
  };
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function normalizeCores(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.max(1, Math.trunc(n));
}

export function normalizeMemory(value: unknown, fallback: number): number {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return fallback;
  // Accept GB values from UI (e.g. 6 -> 6144 MB).
  const mbValue = n <= 64 ? n * 1024 : n;
  if (!Number.isFinite(mbValue) || mbValue < 256) return fallback;
  return Math.max(256, Math.trunc(mbValue));
}

export function normalizeProxmoxUsername(value: unknown): string {
  const raw = String(value ?? 'root').trim();
  if (!raw) return 'root@pam';
  return raw.includes('@') ? raw : `${raw}@pam`;
}

export function normalizeVmId(value: unknown): number | undefined {
  const n = Number(value);
  if (!Number.isFinite(n) || n < 1) return undefined;
  return Math.trunc(n);
}

/**
 * Smart name generation - port of WPF GenerateNextVmName().
 * Skips IDs/names already in Proxmox or in the queue.
 */
export function generateNextVmName(
  prefix: string,
  proxmoxUsedIds: Set<number>,
  proxmoxUsedNames: Set<string>,
  queueNames: string[],
): { name: string; number: number } {
  const allNames = new Set([
    ...Array.from(proxmoxUsedNames),
    ...queueNames.map((n) => n.toLowerCase()),
  ]);
  let i = 1;
  while (true) {
    const candidateId = 100 + i;
    const candidateName = `${prefix}${i}`;
    if (!proxmoxUsedIds.has(candidateId) && !allNames.has(candidateName.toLowerCase())) {
      return { name: candidateName, number: i };
    }
    i++;
    if (i > 9999) break;
  }
  return { name: `${prefix}${Date.now()}`, number: 0 };
}

export function extractVmIndex(name: string): number | null {
  const match = String(name || '').match(/(\d+)$/);
  if (!match) return null;
  const n = Number(match[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return Math.trunc(n);
}

export function pickCloneNewId(vmName: string, takenIds: Set<number>): number {
  const nameIndex = extractVmIndex(vmName);
  if (nameIndex !== null) {
    const preferred = 100 + nameIndex;
    if (!takenIds.has(preferred)) {
      return preferred;
    }
  }

  let candidate = 101;
  while (takenIds.has(candidate)) {
    candidate++;
    if (candidate > 999999) {
      throw new Error('Failed to allocate new VM ID');
    }
  }
  return candidate;
}
