import { Injectable } from '@nestjs/common';
import { type Agent, Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class AgentsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async list(tenantId: string, status?: string): Promise<Agent[]> {
    return this.prisma.agent.findMany({
      where: {
        tenantId,
        ...(status ? { status } : {}),
      },
      orderBy: { updatedAt: 'desc' },
    });
  }

  async createPairing(input: {
    tenantId: string;
    name: string;
    pairingCode: string;
    pairingExpiresAt: Date;
    metadata?: Prisma.InputJsonValue;
  }): Promise<Agent> {
    return this.prisma.agent.create({
      data: {
        tenantId: input.tenantId,
        name: input.name,
        status: 'pending',
        pairingCode: input.pairingCode,
        pairingExpiresAt: input.pairingExpiresAt,
        metadata: input.metadata ?? {},
      },
    });
  }

  async heartbeat(input: {
    tenantId: string;
    agentId: string;
    status: string;
    metadata: Prisma.InputJsonValue;
  }): Promise<Agent> {
    return this.prisma.agent.upsert({
      where: { id: input.agentId },
      update: {
        tenantId: input.tenantId,
        status: input.status,
        metadata: input.metadata,
        lastSeenAt: new Date(),
      },
      create: {
        id: input.agentId,
        tenantId: input.tenantId,
        name: input.agentId,
        status: input.status,
        metadata: input.metadata,
        lastSeenAt: new Date(),
      },
    });
  }
}
