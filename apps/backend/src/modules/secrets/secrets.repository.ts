import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class SecretsRepository {
  constructor(private readonly prisma: PrismaService) {}

  private getSecretMetaClient(): {
    findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (this.prisma as unknown as { secretMeta: unknown }).secretMeta as {
      findFirst: (args: unknown) => Promise<Record<string, unknown> | null>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  private getSecretBindingClient(): {
    findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
    upsert: (args: unknown) => Promise<Record<string, unknown>>;
  } {
    return (this.prisma as unknown as { secretBinding: unknown }).secretBinding as {
      findMany: (args: unknown) => Promise<Array<Record<string, unknown>>>;
      upsert: (args: unknown) => Promise<Record<string, unknown>>;
    };
  }

  async upsertSecretMeta(input: {
    tenantId: string;
    id: string;
    label: string;
    alg: string;
    keyId: string;
    vaultRef?: string | null;
    materialVersion?: number;
    aadMeta: Prisma.InputJsonValue;
    rotatedAt?: Date | null;
  }): Promise<Record<string, unknown>> {
    const updateData: Record<string, unknown> = {
      label: input.label,
      alg: input.alg,
      keyId: input.keyId,
      aadMeta: input.aadMeta,
      ...(Object.hasOwn(input, 'vaultRef') ? { vaultRef: input.vaultRef ?? null } : {}),
      ...(Object.hasOwn(input, 'materialVersion')
        ? { materialVersion: input.materialVersion }
        : {}),
    };
    if (Object.hasOwn(input, 'rotatedAt')) {
      updateData.rotatedAt = input.rotatedAt ?? null;
    }

    return this.getSecretMetaClient().upsert({
      where: {
        tenantId_id: {
          tenantId: input.tenantId,
          id: input.id,
        },
      },
      create: {
        tenantId: input.tenantId,
        id: input.id,
        label: input.label,
        alg: input.alg,
        keyId: input.keyId,
        ...(Object.hasOwn(input, 'vaultRef') ? { vaultRef: input.vaultRef ?? null } : {}),
        ...(Object.hasOwn(input, 'materialVersion')
          ? { materialVersion: input.materialVersion }
          : {}),
        aadMeta: input.aadMeta,
        ...(Object.hasOwn(input, 'rotatedAt') ? { rotatedAt: input.rotatedAt ?? null } : {}),
      },
      update: updateData,
    });
  }

  async findSecretMeta(tenantId: string, id: string): Promise<Record<string, unknown> | null> {
    return this.getSecretMetaClient().findFirst({
      where: {
        tenantId,
        id,
      },
    });
  }

  async upsertBinding(input: {
    tenantId: string;
    id: string;
    scopeType: string;
    scopeId: string;
    secretRef: string;
    fieldName: string;
  }): Promise<Record<string, unknown>> {
    return this.getSecretBindingClient().upsert({
      where: {
        tenantId_scopeType_scopeId_fieldName: {
          tenantId: input.tenantId,
          scopeType: input.scopeType,
          scopeId: input.scopeId,
          fieldName: input.fieldName,
        },
      },
      create: {
        tenantId: input.tenantId,
        id: input.id,
        scopeType: input.scopeType,
        scopeId: input.scopeId,
        secretRef: input.secretRef,
        fieldName: input.fieldName,
      },
      update: {
        secretRef: input.secretRef,
      },
    });
  }

  async listBindings(input: {
    tenantId: string;
    scopeType?: string;
    scopeId?: string;
  }): Promise<Array<Record<string, unknown>>> {
    return this.getSecretBindingClient().findMany({
      where: {
        tenantId: input.tenantId,
        ...(input.scopeType ? { scopeType: input.scopeType } : {}),
        ...(input.scopeId ? { scopeId: input.scopeId } : {}),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
  }
}
