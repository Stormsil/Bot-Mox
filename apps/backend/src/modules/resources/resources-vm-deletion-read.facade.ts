import { Injectable } from '@nestjs/common';
import { ResourcesRepository } from './resources.repository';

type VmDeletionResourceKind = 'proxies' | 'subscriptions' | 'licenses';

@Injectable()
export class ResourcesVmDeletionReadFacade {
  constructor(private readonly repository: ResourcesRepository) {}

  async listTenantResources(
    tenantId: string,
    kind: VmDeletionResourceKind,
  ): Promise<Array<Record<string, unknown>>> {
    return this.repository.list(tenantId, kind);
  }
}
