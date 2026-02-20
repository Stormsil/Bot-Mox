import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { AgentsRepository } from './agents.repository';

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
  constructor(private readonly repository: AgentsRepository) {}

  private mapDbRecord(record: {
    id: string;
    tenantId: string;
    name: string;
    status: string;
    lastSeenAt: Date | null;
    metadata: Prisma.JsonValue | null;
    updatedAt: Date;
  }): AgentRecord {
    return {
      id: record.id,
      tenant_id: record.tenantId,
      name: record.name,
      status: record.status,
      last_seen_at: record.lastSeenAt ? record.lastSeenAt.toISOString() : null,
      metadata:
        record.metadata && typeof record.metadata === 'object'
          ? (record.metadata as Record<string, unknown>)
          : {},
      updated_at: record.updatedAt.toISOString(),
    };
  }

  private normalizeTenantId(tenantId: string): string {
    const normalized = String(tenantId || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      throw new Error('tenantId is required');
    }
    return normalized;
  }

  async list(status: string | undefined, tenantId: string): Promise<AgentRecord[]> {
    const normalizedStatus = String(status || '')
      .trim()
      .toLowerCase();
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const rows = await this.repository.list(normalizedTenantId, normalizedStatus || undefined);
    return rows.map((row) => this.mapDbRecord(row));
  }

  async createPairing(input: {
    tenantId: string;
    name?: string;
    expiresInMinutes?: number;
  }): Promise<Record<string, unknown>> {
    const now = Date.now();
    const id = `pair-${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const code = `bmx-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
    const expiresInMinutes = Number.isFinite(input.expiresInMinutes)
      ? Math.max(5, Math.min(1_440, Math.trunc(input.expiresInMinutes || 15)))
      : 15;

    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const record = {
      id,
      tenant_id: normalizedTenantId,
      name: String(input.name || 'agent-pairing'),
      status: 'pending',
      pairing_code: code,
      pairing_expires_at: new Date(now + expiresInMinutes * 60_000).toISOString(),
      pairing_uri: `botmox://pair?code=${encodeURIComponent(code)}`,
    };
    const created = await this.repository.createPairing({
      tenantId: normalizedTenantId,
      name: String(input.name || 'agent-pairing'),
      pairingCode: code,
      pairingExpiresAt: new Date(now + expiresInMinutes * 60_000),
      metadata: {},
    });
    return {
      ...record,
      id: created.id,
      tenant_id: created.tenantId,
      name: created.name,
      status: created.status,
      pairing_expires_at: created.pairingExpiresAt?.toISOString(),
    };
  }

  async heartbeat(input: {
    tenantId: string;
    agentId: string;
    status: string;
    metadata: Record<string, unknown>;
  }): Promise<AgentRecord> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const stored = await this.repository.heartbeat({
      tenantId: normalizedTenantId,
      agentId: input.agentId,
      status: input.status,
      metadata: input.metadata as Prisma.InputJsonValue,
    });
    return this.mapDbRecord(stored);
  }
}
