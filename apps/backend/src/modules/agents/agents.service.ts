import { Injectable, NotFoundException } from '@nestjs/common';
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

  async createQuickPairAgent(input: {
    tenantId: string;
    userId: string;
    name?: string;
    machineName?: string;
    version?: string;
    platform?: string;
    capabilities?: string[];
  }): Promise<{
    id: string;
    name: string;
    status: string;
    paired_at: string;
  }> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const nextName = String(input.name || input.machineName || 'agent').trim() || 'agent';
    const nextVersion = String(input.version || '').trim();
    const nextPlatform = String(input.platform || '').trim();
    const nextCapabilities = Array.isArray(input.capabilities)
      ? input.capabilities.map((item) => String(item || '').trim()).filter(Boolean)
      : [];

    const created = await this.repository.createQuickPairAgent({
      tenantId: normalizedTenantId,
      name: nextName,
      pairedBy: String(input.userId || '').trim() || 'unknown-user',
      ...(nextVersion ? { version: nextVersion } : {}),
      ...(nextPlatform ? { platform: nextPlatform } : {}),
      capabilities: nextCapabilities,
      metadata: {
        machine_name: String(input.machineName || '').trim() || null,
      },
    });

    return {
      id: created.id,
      name: created.name,
      status: created.status,
      paired_at: (created.pairedAt || created.updatedAt || new Date()).toISOString(),
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
    if (!stored) {
      throw new NotFoundException({
        code: 'AGENT_NOT_FOUND',
        message: 'Agent not found for this tenant',
      });
    }
    return this.mapDbRecord(stored);
  }

  async existsWithinTenant(input: { tenantId: string; agentId: string }): Promise<boolean> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const agentId = String(input.agentId || '').trim();
    if (!agentId) {
      return false;
    }

    const direct = (
      this.repository as unknown as {
        findByIdWithinTenant?: (input: { tenantId: string; agentId: string }) => Promise<{
          id: string;
        } | null>;
      }
    ).findByIdWithinTenant;
    if (typeof direct === 'function') {
      const row = await direct({
        tenantId: normalizedTenantId,
        agentId,
      });
      return Boolean(row);
    }

    const fallback = await this.repository.findById(agentId);
    return Boolean(fallback && fallback.tenantId === normalizedTenantId);
  }

  async repair(input: {
    tenantId: string;
    agentId: string;
    repairedBy: string;
    reason?: string;
    expiresInMinutes?: number;
  }): Promise<Record<string, unknown>> {
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const expiresInMinutes = Number.isFinite(input.expiresInMinutes)
      ? Math.max(5, Math.min(1_440, Math.trunc(input.expiresInMinutes || 15)))
      : 15;
    const pairingCode = `bmx-${Math.random().toString(36).slice(2, 10)}`.toUpperCase();
    const pairingExpiresAt = new Date(Date.now() + expiresInMinutes * 60_000);

    const repaired = await this.repository.repair({
      tenantId: normalizedTenantId,
      agentId: input.agentId,
      pairingCode,
      pairingExpiresAt,
      repairedBy: String(input.repairedBy || '').trim() || 'unknown-user',
      ...(String(input.reason || '').trim() ? { reason: String(input.reason || '').trim() } : {}),
    });
    if (!repaired) {
      throw new NotFoundException({
        code: 'AGENT_NOT_FOUND',
        message: 'Agent not found for this tenant',
      });
    }

    return {
      id: repaired.id,
      tenant_id: repaired.tenantId,
      status: repaired.status,
      pairing_code: repaired.pairingCode,
      pairing_expires_at: repaired.pairingExpiresAt?.toISOString(),
      pairing_uri: `botmox://pair?code=${encodeURIComponent(pairingCode)}`,
    };
  }
}
