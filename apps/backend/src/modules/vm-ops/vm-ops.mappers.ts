import type { Prisma } from '@prisma/client';
import type { VmCommandRecord, VmCommandStatus } from './vm-ops.types';

interface VmCommandDbRow {
  id: string;
  tenantId: string;
  agentId: string;
  commandType: string;
  payload: Prisma.JsonValue;
  status: string;
  queuedAt: Date;
  expiresAt: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  result: Prisma.JsonValue | null;
  errorMessage: string | null;
  createdBy: string | null;
}

function toIsoOrFallback(
  value: Date | string | null | undefined,
  fallback: string | null = null,
): string | null {
  if (value instanceof Date) {
    return value.toISOString();
  }
  if (typeof value === 'string') {
    const parsed = new Date(value);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed.toISOString();
    }
  }
  return fallback;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function normalizeTenantId(tenantId: string): string {
  return String(tenantId || '')
    .trim()
    .toLowerCase();
}

export function cloneCommand(command: VmCommandRecord): VmCommandRecord {
  return {
    ...command,
    payload: { ...command.payload },
  };
}

export function mapDbCommand(command: VmCommandDbRow): VmCommandRecord {
  return {
    id: command.id,
    tenant_id: command.tenantId,
    agent_id: command.agentId,
    command_type: command.commandType,
    payload:
      command.payload && typeof command.payload === 'object'
        ? (command.payload as Record<string, unknown>)
        : {},
    status: command.status as VmCommandStatus,
    queued_at: toIsoOrFallback(command.queuedAt, nowIso()) as string,
    expires_at: toIsoOrFallback(command.expiresAt),
    started_at: toIsoOrFallback(command.startedAt),
    completed_at: toIsoOrFallback(command.completedAt),
    result: command.result ?? null,
    error_message: command.errorMessage,
    created_by: command.createdBy,
  };
}
