import { Injectable } from '@nestjs/common';
import { BotsRepository } from './bots.repository';

export interface VmDeletionBotView {
  id: string;
  status: string;
  vmName: string;
  accountEmail: string;
  accountPassword: string;
}

@Injectable()
export class BotsVmDeletionReadFacade {
  constructor(private readonly repository: BotsRepository) {}

  async listTenantBots(tenantId: string): Promise<VmDeletionBotView[]> {
    const rows = await this.repository.list(tenantId);
    const mapped: VmDeletionBotView[] = [];
    for (const row of rows) {
      const bot = this.toBotView(row);
      if (bot) {
        mapped.push(bot);
      }
    }
    return mapped;
  }

  private toObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private toBotView(row: Record<string, unknown>): VmDeletionBotView | null {
    const payload = this.toObject(row.payload);
    const vm = this.toObject(payload.vm);
    const account = this.toObject(payload.account);
    const id = String(row.id ?? payload.id ?? '').trim();
    const vmName = String(vm.name ?? payload.vm_name ?? '').trim();
    if (!id || !vmName) {
      return null;
    }

    return {
      id,
      status: String(payload.status ?? '')
        .trim()
        .toLowerCase(),
      vmName,
      accountEmail: String(account.email ?? '').trim(),
      accountPassword: String(account.password ?? '').trim(),
    };
  }
}
