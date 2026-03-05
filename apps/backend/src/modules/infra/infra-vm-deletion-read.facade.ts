import { Injectable } from '@nestjs/common';
import { InfraRepository } from './infra.repository';
import type { VmRecord } from './infra.types';

@Injectable()
export class InfraVmDeletionReadFacade {
  constructor(private readonly repository: InfraRepository) {}

  async listTenantVms(tenantId: string): Promise<VmRecord[]> {
    return this.repository.listTenantVms(tenantId);
  }
}
