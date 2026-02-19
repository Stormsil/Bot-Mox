import { randomUUID } from 'node:crypto';
import { Injectable } from '@nestjs/common';

interface VmCommandRecord {
  id: string;
  tenant_id: string;
  agent_id: string;
  command_type: string;
  payload: Record<string, unknown>;
  status: 'queued' | 'dispatched' | 'running' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
  queued_at: string;
  expires_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  result?: unknown;
  error_message?: string | null;
  created_by?: string | null;
}

@Injectable()
export class VmOpsService {
  private readonly commands = new Map<string, VmCommandRecord>();

  dispatch(input: {
    tenantId?: string;
    agentId: string;
    commandType: string;
    payload: Record<string, unknown>;
    createdBy?: string;
  }): VmCommandRecord {
    const id = randomUUID();
    const command: VmCommandRecord = {
      id,
      tenant_id: String(input.tenantId || 'default'),
      agent_id: input.agentId,
      command_type: input.commandType,
      payload: input.payload,
      status: 'queued',
      queued_at: new Date().toISOString(),
      expires_at: null,
      started_at: null,
      completed_at: null,
      created_by: input.createdBy || null,
    };
    this.commands.set(id, command);
    return command;
  }

  getById(id: string): VmCommandRecord | null {
    return this.commands.get(id) ?? null;
  }
}
