import { ALLOWLISTED_SSH_EXACT, ALLOWLISTED_SSH_PREFIXES } from './infra.constants';
import { InfraServiceError } from './infra.errors';

export function normalizeTenantId(tenantId: string): string {
  const normalized = String(tenantId || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    throw new Error('tenantId is required');
  }
  return normalized;
}

export function isSshCommandAllowlisted(command: string): boolean {
  const normalized = String(command || '')
    .trim()
    .toLowerCase();
  if (!normalized) {
    return false;
  }
  if (ALLOWLISTED_SSH_EXACT.has(normalized)) {
    return true;
  }
  return ALLOWLISTED_SSH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
}

export function assertNode(node: string): string {
  const normalizedNode = String(node || '').trim();
  if (!normalizedNode) {
    throw new InfraServiceError(400, 'BAD_REQUEST', 'node is required');
  }
  return normalizedNode;
}

export function assertVmid(vmid: string): string {
  const normalizedVmid = String(vmid || '').trim();
  if (!normalizedVmid) {
    throw new InfraServiceError(400, 'BAD_REQUEST', 'Invalid vmid');
  }
  return normalizedVmid;
}

export function assertCommand(command: string): string {
  const normalizedCommand = String(command || '').trim();
  if (!normalizedCommand) {
    throw new InfraServiceError(400, 'BAD_REQUEST', 'command is required');
  }
  return normalizedCommand;
}

export function assertContent(content: string): string {
  const normalizedContent = String(content || '');
  if (!normalizedContent) {
    throw new InfraServiceError(400, 'BAD_REQUEST', 'content is required');
  }
  return normalizedContent;
}

const VM_ACTIONS = new Set(['start', 'stop', 'shutdown', 'reset', 'suspend', 'resume']);

export function normalizeVmAction(action: string): string {
  const normalizedAction = String(action).trim().toLowerCase();
  if (!VM_ACTIONS.has(normalizedAction)) {
    throw new InfraServiceError(400, 'BAD_REQUEST', `Invalid action: ${normalizedAction}`);
  }
  return normalizedAction;
}

export function resolveVmStatusByAction(currentStatus: string, normalizedAction: string): string {
  if (normalizedAction === 'start' || normalizedAction === 'resume') {
    return 'running';
  }
  if (
    normalizedAction === 'stop' ||
    normalizedAction === 'shutdown' ||
    normalizedAction === 'suspend'
  ) {
    return 'stopped';
  }
  return currentStatus;
}

export function parseTimeoutMs(timeout: unknown, fallbackMs: number): number {
  const numeric = Number(timeout);
  if (!Number.isFinite(numeric)) {
    return fallbackMs;
  }
  return numeric;
}
