import { Injectable } from '@nestjs/common';

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
  private readonly store = new Map<string, VmRecord>();

  private normalizeVmUuid(vmUuid: string): string {
    return String(vmUuid || '')
      .trim()
      .toLowerCase();
  }

  registerVm(input: VmRegisterInput): VmRecord {
    const normalizedUuid = this.normalizeVmUuid(input.vmUuid);
    const now = Date.now();
    const existing = this.store.get(normalizedUuid);

    const record: VmRecord = {
      tenant_id: String(input.tenantId || 'default').trim() || 'default',
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

    this.store.set(normalizedUuid, record);
    return record;
  }

  resolveVm(vmUuid: string): VmRecord | null {
    const normalizedUuid = this.normalizeVmUuid(vmUuid);
    return this.store.get(normalizedUuid) ?? null;
  }
}
