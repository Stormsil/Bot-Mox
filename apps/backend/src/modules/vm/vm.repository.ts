import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { PrismaService } from '../db/prisma.service';

@Injectable()
export class VmRepository {
  constructor(private readonly prisma: PrismaService) {}

  async upsert(input: {
    tenantId: string;
    vmUuid: string;
    userId: string;
    vmName: string;
    projectId: string;
    status: string;
    metadata: Prisma.InputJsonValue;
    createdAtMs: number;
    updatedAtMs: number;
  }): Promise<Record<string, unknown> | null> {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      insert into public.vm_registry (
        tenant_id,
        vm_uuid,
        user_id,
        vm_name,
        project_id,
        status,
        metadata,
        created_at_ms,
        updated_at_ms
      )
      values (
        ${input.tenantId},
        ${input.vmUuid},
        ${input.userId},
        ${input.vmName},
        ${input.projectId},
        ${input.status},
        ${JSON.stringify(input.metadata || {})}::jsonb,
        ${input.createdAtMs},
        ${input.updatedAtMs}
      )
      on conflict (tenant_id, vm_uuid)
      do update set
        user_id = excluded.user_id,
        vm_name = excluded.vm_name,
        project_id = excluded.project_id,
        status = excluded.status,
        metadata = excluded.metadata,
        updated_at_ms = excluded.updated_at_ms
      returning
        tenant_id,
        vm_uuid,
        user_id,
        vm_name,
        project_id,
        status,
        metadata,
        created_at_ms,
        updated_at_ms
    `;
    return rows[0] ?? null;
  }

  async findById(tenantId: string, vmUuid: string): Promise<Record<string, unknown> | null> {
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      select
        tenant_id,
        vm_uuid,
        user_id,
        vm_name,
        project_id,
        status,
        metadata,
        created_at_ms,
        updated_at_ms
      from public.vm_registry
      where tenant_id = ${tenantId}
        and vm_uuid = ${vmUuid}
      limit 1
    `;
    return rows[0] ?? null;
  }
}
