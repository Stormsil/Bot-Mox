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
    queued_at: command.queuedAt.toISOString(),
    expires_at: command.expiresAt ? command.expiresAt.toISOString() : null,
    started_at: command.startedAt ? command.startedAt.toISOString() : null,
    completed_at: command.completedAt ? command.completedAt.toISOString() : null,
    result: command.result ?? null,
    error_message: command.errorMessage,
    created_by: command.createdBy,
  };
}
