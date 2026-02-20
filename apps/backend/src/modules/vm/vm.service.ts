import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { VmRepository } from './vm.repository';

export interface VmRegisterInput {
  tenantId: string;
  userId: string;
  vmUuid: string;
  vmName?: string | undefined;
  projectId?: string | undefined;
  status?: string | undefined;
  metadata?: Record<string, unknown> | undefined;
}

export interface VmRecord {
  tenant_id: string;
  vm_uuid: string;
  user_id: string;
  vm_name: string;
  project_id: string;
  status: string;
  metadata: Record<string, unknown>;
  created_at_ms: number;
  updated_at_ms: number;
  created_at: number;
  updated_at: number;
}

@Injectable()
export class VmService {
  constructor(private readonly repository: VmRepository) {}

  private normalizeVmUuid(vmUuid: string): string {
    return String(vmUuid || '')
      .trim()
      .toLowerCase();
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

  private mapDbRecord(row: Record<string, unknown>): VmRecord {
    const createdAtMs = Number.parseInt(String(row.created_at_ms || Date.now()), 10) || Date.now();
    const updatedAtMs = Number.parseInt(String(row.updated_at_ms || Date.now()), 10) || Date.now();

    return {
      tenant_id: this.normalizeTenantId(String(row.tenant_id || '')),
      vm_uuid: this.normalizeVmUuid(String(row.vm_uuid || '')),
      user_id: String(row.user_id || '').trim(),
      vm_name: String(row.vm_name || '').trim(),
      project_id: String(row.project_id || '').trim(),
      status:
        String(row.status || 'active')
          .trim()
          .toLowerCase() || 'active',
      metadata:
        row.metadata && typeof row.metadata === 'object'
          ? (row.metadata as Record<string, unknown>)
          : {},
      created_at_ms: createdAtMs,
      updated_at_ms: updatedAtMs,
      created_at: createdAtMs,
      updated_at: updatedAtMs,
    };
  }

  async registerVm(input: VmRegisterInput): Promise<VmRecord> {
    const normalizedUuid = this.normalizeVmUuid(input.vmUuid);
    const normalizedTenantId = this.normalizeTenantId(input.tenantId);
    const now = Date.now();
    const existing = await this.resolveVm(normalizedUuid, normalizedTenantId);

    const record: VmRecord = {
      tenant_id: normalizedTenantId,
      vm_uuid: normalizedUuid,
      user_id: String(input.userId || '').trim(),
      vm_name: String(input.vmName || '').trim(),
      project_id: String(input.projectId || '').trim(),
      status:
        String(input.status || 'active')
          .trim()
          .toLowerCase() || 'active',
      metadata: input.metadata && typeof input.metadata === 'object' ? input.metadata : {},
      created_at_ms: Number(existing?.created_at_ms || now),
      updated_at_ms: now,
      created_at: Number(existing?.created_at_ms || now),
      updated_at: now,
    };
    const row = await this.repository.upsert({
      tenantId: record.tenant_id,
      vmUuid: record.vm_uuid,
      userId: record.user_id,
      vmName: record.vm_name,
      projectId: record.project_id,
      status: record.status,
      metadata: record.metadata as Prisma.InputJsonValue,
      createdAtMs: record.created_at_ms,
      updatedAtMs: record.updated_at_ms,
    });
    if (!row) {
      throw new Error('vm_registry upsert returned no row');
    }
    return this.mapDbRecord(row);
  }

  async resolveVm(vmUuid: string, tenantId: string): Promise<VmRecord | null> {
    const normalizedTenantId = this.normalizeTenantId(tenantId);
    const normalizedUuid = this.normalizeVmUuid(vmUuid);
    const row = await this.repository.findById(normalizedTenantId, normalizedUuid);
    return row ? this.mapDbRecord(row) : null;
  }
}
