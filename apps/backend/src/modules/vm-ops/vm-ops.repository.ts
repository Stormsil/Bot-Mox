import { Injectable } from '@nestjs/common';
import { type AgentCommand, Prisma } from '@prisma/client';
import { DataAtRestCrypto } from '../common/data-at-rest-crypto';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class VmOpsRepository {
  private readonly atRestCrypto = new DataAtRestCrypto();

  constructor(private readonly prisma: PrismaService) {}

  private encryptJsonField(value: Prisma.InputJsonValue): Prisma.InputJsonValue {
    return this.atRestCrypto.encryptJson(value) as unknown as Prisma.InputJsonValue;
  }

  private decryptJsonField(value: Prisma.JsonValue | null): Prisma.JsonValue | null {
    if (value === null || value === undefined) {
      return null;
    }
    try {
      const decrypted = this.atRestCrypto.decryptJson<Prisma.JsonValue>(value as unknown);
      return decrypted === null ? value : decrypted;
    } catch {
      return value;
    }
  }

  private mapCommandRow(row: AgentCommand): AgentCommand {
    return {
      ...row,
      payload: (this.decryptJsonField(row.payload) ?? row.payload) as Prisma.JsonValue,
      result: this.decryptJsonField((row.result ?? null) as Prisma.JsonValue | null),
    };
  }

  async create(input: {
    id: string;
    tenantId: string;
    agentId: string;
    commandType: string;
    payload: Prisma.InputJsonValue;
    status: string;
    expiresAt?: Date | null;
    createdBy?: string | null;
  }): Promise<AgentCommand> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      const row = await tx.agentCommand.create({
        data: {
          id: input.id,
          tenantId: input.tenantId,
          agentId: input.agentId,
          commandType: input.commandType,
          payload: this.encryptJsonField(input.payload),
          status: input.status,
          expiresAt: input.expiresAt ?? null,
          createdBy: input.createdBy ?? null,
        },
      });
      return this.mapCommandRow(row);
    });
  }

  async findById(id: string): Promise<AgentCommand | null> {
    return this.prisma.withSystemContext(async () => {
      const row = await this.prisma.agentCommand.findUnique({
        where: { id },
      });
      return row ? this.mapCommandRow(row) : null;
    });
  }

  async findByIdWithinTenant(input: {
    id: string;
    tenantId: string;
  }): Promise<AgentCommand | null> {
    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      const row = await tx.agentCommand.findFirst({
        where: {
          id: input.id,
          tenantId: input.tenantId,
        },
      });
      return row ? this.mapCommandRow(row) : null;
    });
  }

  async list(input: {
    tenantId?: string;
    agentId?: string;
    status?: string;
  }): Promise<AgentCommand[]> {
    const tenantId = input.tenantId;
    if (tenantId) {
      return this.prisma.withTenantContext(tenantId, async (tx) => {
        const rows = await tx.agentCommand.findMany({
          where: {
            tenantId,
            ...(input.agentId ? { agentId: input.agentId } : {}),
            ...(input.status ? { status: input.status } : {}),
          },
          orderBy: { queuedAt: 'desc' },
        });
        return rows.map((row) => this.mapCommandRow(row));
      });
    }
    return this.prisma.withSystemContext(async () => {
      const rows = await this.prisma.agentCommand.findMany({
        where: {
          ...(input.agentId ? { agentId: input.agentId } : {}),
          ...(input.status ? { status: input.status } : {}),
        },
        orderBy: { queuedAt: 'desc' },
      });
      return rows.map((row) => this.mapCommandRow(row));
    });
  }

  async claimNextQueued(input: {
    tenantId: string;
    agentId: string;
  }): Promise<AgentCommand | null> {
    const claimed = await this.prisma.withTenantContext(input.tenantId, async (tx) => {
      return tx.$queryRaw<AgentCommand[]>`
        WITH candidate AS (
          SELECT id
          FROM public.agent_commands
          WHERE tenant_id = ${input.tenantId}
            AND agent_id = ${input.agentId}::uuid
            AND status = 'queued'
          ORDER BY queued_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        )
        UPDATE public.agent_commands command
        SET status = 'dispatched',
            updated_at = timezone('utc', now())
        FROM candidate
        WHERE command.id = candidate.id
        RETURNING command.*;
      `;
    });

    return claimed[0] ? this.mapCommandRow(claimed[0]) : null;
  }

  async updateStatus(input: {
    id: string;
    status: 'running' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
    result?: Prisma.InputJsonValue | null;
    errorMessage?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<AgentCommand | null> {
    const data: Prisma.AgentCommandUpdateInput = {
      status: input.status,
    };
    if (Object.hasOwn(input, 'result')) {
      const result = input.result;
      if (result === null) {
        data.result = Prisma.JsonNull;
      } else if (result !== undefined) {
        data.result = this.encryptJsonField(result);
      }
    }
    if (Object.hasOwn(input, 'errorMessage')) {
      data.errorMessage = input.errorMessage ?? null;
    }
    if (Object.hasOwn(input, 'startedAt')) {
      data.startedAt = input.startedAt ?? null;
    }
    if (Object.hasOwn(input, 'completedAt')) {
      data.completedAt = input.completedAt ?? null;
    }

    return this.prisma.withSystemContext(async () => {
      const row = await this.prisma.agentCommand
        .update({
          where: { id: input.id },
          data,
        })
        .catch((error: unknown) => {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code === 'P2025'
          ) {
            return null;
          }
          throw error;
        });
      return row ? this.mapCommandRow(row) : null;
    });
  }

  async updateStatusWithinTenant(input: {
    id: string;
    tenantId: string;
    agentId?: string;
    status: 'running' | 'succeeded' | 'failed' | 'expired' | 'cancelled';
    result?: Prisma.InputJsonValue | null;
    errorMessage?: string | null;
    startedAt?: Date | null;
    completedAt?: Date | null;
  }): Promise<AgentCommand | null> {
    const data: Prisma.AgentCommandUpdateInput = {
      status: input.status,
    };
    if (Object.hasOwn(input, 'result')) {
      const result = input.result;
      if (result === null) {
        data.result = Prisma.JsonNull;
      } else if (result !== undefined) {
        data.result = this.encryptJsonField(result);
      }
    }
    if (Object.hasOwn(input, 'errorMessage')) {
      data.errorMessage = input.errorMessage ?? null;
    }
    if (Object.hasOwn(input, 'startedAt')) {
      data.startedAt = input.startedAt ?? null;
    }
    if (Object.hasOwn(input, 'completedAt')) {
      data.completedAt = input.completedAt ?? null;
    }

    return this.prisma.withTenantContext(input.tenantId, async (tx) => {
      const result = await tx.agentCommand.updateMany({
        where: {
          id: input.id,
          tenantId: input.tenantId,
          ...(input.agentId ? { agentId: input.agentId } : {}),
        },
        data,
      });
      if (result.count === 0) {
        return null;
      }
      const row = await tx.agentCommand.findFirst({
        where: {
          id: input.id,
          tenantId: input.tenantId,
          ...(input.agentId ? { agentId: input.agentId } : {}),
        },
      });
      return row ? this.mapCommandRow(row) : null;
    });
  }

  async expireStaleRunning(input: { runningMaxAgeMs: number }): Promise<number> {
    const runningBaseline = new Date(Date.now() - input.runningMaxAgeMs);
    const result = await this.prisma.withSystemContext(async () => {
      return this.prisma.agentCommand.updateMany({
        where: {
          status: 'running',
          OR: [
            { startedAt: { lt: runningBaseline } },
            { startedAt: null, queuedAt: { lt: runningBaseline } },
          ],
        },
        data: {
          status: 'expired',
          errorMessage: `Command lease expired by reliability sweep`,
          completedAt: new Date(),
        },
      });
    });
    return result.count;
  }

  async listStaleDispatched(input: { dispatchedMaxAgeMs: number }): Promise<AgentCommand[]> {
    const dispatchedBaseline = new Date(Date.now() - input.dispatchedMaxAgeMs);
    return this.prisma.withSystemContext(async () => {
      const rows = await this.prisma.agentCommand.findMany({
        where: {
          status: 'dispatched',
          queuedAt: { lt: dispatchedBaseline },
        },
        orderBy: { queuedAt: 'asc' },
      });
      return rows.map((row) => this.mapCommandRow(row));
    });
  }

  async requeueDispatched(input: {
    id: string;
    errorMessage: string;
  }): Promise<AgentCommand | null> {
    return this.prisma.withSystemContext(async () => {
      const row = await this.prisma.agentCommand
        .update({
          where: { id: input.id },
          data: {
            status: 'queued',
            queuedAt: new Date(),
            startedAt: null,
            completedAt: null,
            errorMessage: input.errorMessage,
          },
        })
        .catch((error: unknown) => {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code === 'P2025'
          ) {
            return null;
          }
          throw error;
        });
      return row ? this.mapCommandRow(row) : null;
    });
  }

  async deadLetterDispatched(input: {
    id: string;
    errorMessage: string;
  }): Promise<AgentCommand | null> {
    return this.prisma.withSystemContext(async () => {
      const row = await this.prisma.agentCommand
        .update({
          where: { id: input.id },
          data: {
            status: 'failed',
            completedAt: new Date(),
            errorMessage: input.errorMessage,
          },
        })
        .catch((error: unknown) => {
          if (
            typeof error === 'object' &&
            error !== null &&
            'code' in error &&
            (error as { code?: string }).code === 'P2025'
          ) {
            return null;
          }
          throw error;
        });
      return row ? this.mapCommandRow(row) : null;
    });
  }
}
