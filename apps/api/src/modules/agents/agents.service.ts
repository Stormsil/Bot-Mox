import { Injectable } from '@nestjs/common';

interface AgentRecord {
  id: string;
  tenant_id: string;
  name: string;
  status: string;
  last_seen_at: string | null;
  metadata: Record<string, unknown>;
  updated_at: string;
}

@Injectable()
export class AgentsService {
  private readonly records = new Map<string, AgentRecord>();
  private readonly pairings = new Map<string, Record<string, unknown>>();

  list(status?: string): AgentRecord[] {
    const normalizedStatus = String(status || '')
      .trim()
      .toLowerCase();
    if (!normalizedStatus) {
      return [...this.records.values()];
    }
    return [...this.records.values()].filter(
      (record) =>
        String(record.status || '')
          .trim()
          .toLowerCase() === normalizedStatus,
    );
  }

  createPairing(input: {
    tenantId?: string;
    name?: string;
    expiresInMinutes?: number;
  }): Record<string, unknown> {
    const now = Date.now();
    const id = `pair-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const code = `bmx-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
    const expiresInMinutes = Number.isFinite(input.expiresInMinutes)
      ? Math.max(5, Math.min(1_440, Math.trunc(input.expiresInMinutes || 15)))
      : 15;

    const record = {
      id,
      tenant_id: String(input.tenantId || 'default'),
      name: String(input.name || 'agent-pairing'),
      status: 'pending',
      pairing_code: code,
      pairing_expires_at: new Date(now + expiresInMinutes * 60_000).toISOString(),
      pairing_uri: `botmox://pair?code=${encodeURIComponent(code)}`,
    };
    this.pairings.set(id, record);
    return record;
  }

  heartbeat(input: {
    tenantId?: string;
    agentId: string;
    status: string;
    metadata: Record<string, unknown>;
  }): AgentRecord {
    const current = this.records.get(input.agentId);
    const nextRecord: AgentRecord = {
      id: input.agentId,
      tenant_id: String(input.tenantId || current?.tenant_id || 'default'),
      name: String(current?.name || input.agentId),
      status: input.status,
      last_seen_at: new Date().toISOString(),
      metadata: input.metadata,
      updated_at: new Date().toISOString(),
    };
    this.records.set(input.agentId, nextRecord);
    return nextRecord;
  }
}
