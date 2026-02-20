import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

interface VmRecord {
  node: string;
  vmid: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
}

@Injectable()
export class InfraRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getVmClient(): {
    findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
    delete: (args: unknown) => Promise<unknown>;
  } {
    return (this.prisma as unknown as { infraVmItem: unknown }).infraVmItem as {
      findMany: (args: unknown) => Promise<Record<string, unknown>[]>;
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
      delete: (args: unknown) => Promise<unknown>;
    };
  }

  private getVmConfigClient(): {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (this.prisma as unknown as { infraVmConfigItem: unknown }).infraVmConfigItem as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async listVmsByNode(tenantId: string, node: string): Promise<VmRecord[]> {
    const rows = await this.getVmClient().findMany({
      where: {
        tenantId,
        node,
      },
      orderBy: {
        updatedAt: 'desc',
      },
    });
    return rows.map((row) => row.payload as VmRecord);
  }

  async findVm(tenantId: string, node: string, vmid: string): Promise<VmRecord | null> {
    const row = await this.getVmClient().findFirst({
      where: {
        tenantId,
        node,
        vmid,
      },
    });
    if (!row) {
      return null;
    }
    return row.payload as VmRecord;
  }

  async upsertVm(input: {
    tenantId: string;
    node: string;
    vmid: string;
    payload: VmRecord;
  }): Promise<VmRecord> {
    const row = await this.getVmClient().upsert({
      where: {
        tenantId_node_vmid: {
          tenantId: input.tenantId,
          node: input.node,
          vmid: input.vmid,
        },
      },
      create: {
        tenantId: input.tenantId,
        node: input.node,
        vmid: input.vmid,
        payload: input.payload as unknown as Prisma.InputJsonValue,
      },
      update: {
        payload: input.payload as unknown as Prisma.InputJsonValue,
      },
    });
    return row.payload as VmRecord;
  }

  async deleteVm(tenantId: string, node: string, vmid: string): Promise<void> {
    await this.getVmClient().delete({
      where: {
        tenantId_node_vmid: {
          tenantId,
          node,
          vmid,
        },
      },
    });
  }

  async findVmConfig(tenantId: string, vmid: string): Promise<string | null> {
    const row = await this.getVmConfigClient().findFirst({
      where: {
        tenantId,
        vmid,
      },
    });
    if (!row) {
      return null;
    }
    return String(row.content ?? '');
  }

  async upsertVmConfig(tenantId: string, vmid: string, content: string): Promise<void> {
    await this.getVmConfigClient().upsert({
      where: {
        tenantId_vmid: {
          tenantId,
          vmid,
        },
      },
      create: {
        tenantId,
        vmid,
        content,
      },
      update: {
        content,
      },
    });
  }
}
