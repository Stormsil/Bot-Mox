import { Injectable } from '@nestjs/common';
import { type Agent, Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class AgentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, status?: string): Promise<Agent[]> {
    return this.prisma.withTenantContext(tenantId, async (tx) => {
      return tx.agent.findMany({
        where: {
          tenantId,
          ...(status ? { status } : {}),
        },
        orderBy: { updatedAt: 'desc' },
      });
    });
  }

  async createPairing(input: {
    tenantId: string;
    name: string;
    pairingCode: string;
    pairingExpiresAt: Date;
    metadata?: Prisma.InputJsonValue;
  }): Promise<Agent> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      return tx.agent.create({
        data: {
          tenantId: input.tenantId,
          name: input.name,
          status: 'pending',
          pairingCode: input.pairingCode,
          pairingExpiresAt: input.pairingExpiresAt,
          metadata: input.metadata ?? {},
        },
      });
    });
  }

  async createQuickPairAgent(input: {
    tenantId: string;
    name: string;
    pairedBy: string;
    version?: string;
    platform?: string;
    capabilities?: Prisma.InputJsonValue;
    metadata?: Prisma.InputJsonValue;
  }): Promise<Agent> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      return tx.agent.create({
        data: {
          tenantId: input.tenantId,
          name: input.name,
          status: 'active',
          pairedAt: new Date(),
          pairedBy: input.pairedBy,
          version: input.version ?? null,
          platform: input.platform ?? null,
          capabilities: input.capabilities ?? [],
          metadata: input.metadata ?? {},
          lastSeenAt: new Date(),
        },
      });
    });
  }

  async heartbeat(input: {
    tenantId: string;
    agentId: string;
    status: string;
    metadata: Prisma.InputJsonValue;
  }): Promise<Agent | null> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      const result = await tx.agent.updateMany({
        where: {
          id: input.agentId,
          tenantId: input.tenantId,
        },
        data: {
          status: input.status,
          metadata: input.metadata,
          lastSeenAt: new Date(),
        },
      });
      if (result.count === 0) {
        return null;
      }
      return tx.agent.findFirst({
        where: {
          id: input.agentId,
          tenantId: input.tenantId,
        },
      });
    });
  }

  async findById(agentId: string): Promise<Agent | null> {
    return this.prisma.withSystemContext(async () => {
      return this.prisma.agent.findUnique({
        where: { id: agentId },
      });
    });
  }

  async findByIdWithinTenant(input: { tenantId: string; agentId: string }): Promise<Agent | null> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      return tx.agent.findFirst({
        where: {
          id: input.agentId,
          tenantId: input.tenantId,
        },
      });
    });
  }

  async repair(input: {
    tenantId: string;
    agentId: string;
    pairingCode: string;
    pairingExpiresAt: Date;
    repairedBy: string;
    reason?: string;
  }): Promise<Agent | null> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      const existing = await tx.agent.findFirst({
        where: {
          id: input.agentId,
          tenantId: input.tenantId,
        },
      });
      if (!existing) {
        return null;
      }
      return tx.agent.update({
        where: { id: input.agentId },
        data: {
          status: 'pending',
          pairingCode: input.pairingCode,
          pairingExpiresAt: input.pairingExpiresAt,
          revokedAt: null,
          revokedBy: null,
          revokeReason: null,
          pairedAt: null,
          pairedBy: input.repairedBy,
          metadata: {
            repaired_at: new Date().toISOString(),
            repaired_by: input.repairedBy,
            reason: input.reason || null,
          },
        },
      });
    });
  }
}
