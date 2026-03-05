import { Injectable } from '@nestjs/common';
import { BotsVmDeletionReadFacade } from '../bots/bots-vm-deletion-read.facade';
import type {
  VmDeletionEvaluateItem,
  VmDeletionEvaluationResult,
  VmDeletionPolicy,
  VmRecord,
} from '../infra/infra.types';
import { InfraVmDeletionReadFacade } from '../infra/infra-vm-deletion-read.facade';
import { ResourcesVmDeletionReadFacade } from '../resources/resources-vm-deletion-read.facade';

@Injectable()
export class VmDeletionOrchestratorService {
  constructor(
    private readonly infraReadFacade: InfraVmDeletionReadFacade,
    private readonly botsReadFacade: BotsVmDeletionReadFacade,
    private readonly resourcesReadFacade: ResourcesVmDeletionReadFacade,
  ) {}

  async evaluateVmDeletion(
    tenantId: string,
    input: {
      items: VmDeletionEvaluateItem[];
      policy?: Partial<VmDeletionPolicy> | undefined;
    },
  ): Promise<{ items: VmDeletionEvaluationResult[] }> {
    const policy = this.normalizeDeletePolicy(input.policy);

    const [tenantVms, tenantBots, proxyRows, subscriptionRows, licenseRows] = await Promise.all([
      this.infraReadFacade.listTenantVms(tenantId),
      this.botsReadFacade.listTenantBots(tenantId),
      this.resourcesReadFacade.listTenantResources(tenantId, 'proxies'),
      this.resourcesReadFacade.listTenantResources(tenantId, 'subscriptions'),
      this.resourcesReadFacade.listTenantResources(tenantId, 'licenses'),
    ]);

    const vmByNodeAndId = new Map<string, VmRecord>();
    const vmById = new Map<string, VmRecord>();
    const vmByName = new Map<string, VmRecord>();
    for (const vm of tenantVms) {
      const vmid = String(vm.vmid ?? '').trim();
      const node = String(vm.node ?? '').trim();
      const name = this.normalizeToken(vm.name);
      if (node && vmid) {
        vmByNodeAndId.set(`${node}:${vmid}`, vm);
      }
      if (vmid && !vmById.has(vmid)) {
        vmById.set(vmid, vm);
      }
      if (name && !vmByName.has(name)) {
        vmByName.set(name, vm);
      }
    }

    const botsByVmName = new Map<string, typeof tenantBots>();
    for (const bot of tenantBots) {
      const key = this.normalizeToken(bot.vmName);
      const current = botsByVmName.get(key);
      if (current) {
        current.push(bot);
      } else {
        botsByVmName.set(key, [bot]);
      }
    }
    for (const bots of botsByVmName.values()) {
      bots.sort((left, right) => left.id.localeCompare(right.id));
    }

    const proxiesByBotId = new Map<string, number>();
    for (const row of proxyRows) {
      const payload = this.toObject(row.payload);
      const botId = String(payload.bot_id ?? '').trim();
      if (!botId) {
        continue;
      }
      proxiesByBotId.set(botId, (proxiesByBotId.get(botId) || 0) + 1);
    }

    const subscriptionsByBotId = new Map<string, number>();
    for (const row of subscriptionRows) {
      const payload = this.toObject(row.payload);
      const botId = String(payload.bot_id ?? '').trim();
      if (!botId) {
        continue;
      }
      subscriptionsByBotId.set(botId, (subscriptionsByBotId.get(botId) || 0) + 1);
    }

    const licensesByBotId = new Map<string, number>();
    for (const row of licenseRows) {
      const payload = this.toObject(row.payload);
      const botIdsRaw = Array.isArray(payload.bot_ids) ? payload.bot_ids : [];
      for (const rawBotId of botIdsRaw) {
        const botId = String(rawBotId ?? '').trim();
        if (!botId) {
          continue;
        }
        licensesByBotId.set(botId, (licensesByBotId.get(botId) || 0) + 1);
      }
    }

    const items = input.items.map((item) => {
      const resolvedVm = this.resolveEvaluatedVm(item, vmByNodeAndId, vmById, vmByName);
      const fallbackNode = String(item.node ?? '').trim();
      const fallbackVmUuid = String(item.vm_uuid ?? '').trim();

      if (!resolvedVm) {
        return {
          vmid: item.vmid,
          can_delete: false,
          reason: 'VM_NOT_FOUND',
          reasons: ['VM_NOT_FOUND'],
          ...(fallbackNode ? { node: fallbackNode } : {}),
          ...(fallbackVmUuid ? { vm_uuid: fallbackVmUuid } : {}),
          reason_code: 'VM_NOT_FOUND',
          linked_bot_ids: [],
          linked_bots: 0,
        } as VmDeletionEvaluationResult;
      }

      const linkedBots =
        botsByVmName.get(this.normalizeToken(String(resolvedVm.name ?? '')))?.slice() || [];

      if (linkedBots.length === 0) {
        const reasonCode = policy.allowOrphan ? 'ORPHAN_ALLOWED' : 'ORPHAN_BLOCKED';
        return {
          vmid: item.vmid,
          can_delete: policy.allowOrphan,
          reason: reasonCode,
          reasons: [reasonCode],
          node: String(resolvedVm.node ?? '').trim() || fallbackNode || undefined,
          ...(fallbackVmUuid ? { vm_uuid: fallbackVmUuid } : {}),
          reason_code: reasonCode,
          linked_bot_ids: [],
          linked_bots: 0,
        } as VmDeletionEvaluationResult;
      }

      const evaluations = linkedBots.map((bot) => {
        const decision = this.evaluateDeleteBot(
          bot,
          {
            hasProxy: (proxiesByBotId.get(bot.id) || 0) > 0,
            hasSubscription: (subscriptionsByBotId.get(bot.id) || 0) > 0,
            hasLicense: (licensesByBotId.get(bot.id) || 0) > 0,
          },
          policy,
        );
        return { botId: bot.id, ...decision };
      });
      const blocked = evaluations.find((entry) => !entry.canDelete);
      const picked = blocked ?? evaluations[0];
      if (!picked) {
        return {
          vmid: item.vmid,
          can_delete: false,
          reason: 'NOT_ELIGIBLE',
          reasons: ['NOT_ELIGIBLE'],
          node: String(resolvedVm.node ?? '').trim() || fallbackNode || undefined,
          ...(fallbackVmUuid ? { vm_uuid: fallbackVmUuid } : {}),
          reason_code: 'NOT_ELIGIBLE',
          linked_bot_ids: [],
          linked_bots: 0,
        } as VmDeletionEvaluationResult;
      }
      const reasons = blocked ? blocked.blockers : [picked.reasonCode];

      return {
        vmid: item.vmid,
        can_delete: !blocked,
        reason: picked.reasonCode,
        reasons,
        node: String(resolvedVm.node ?? '').trim() || fallbackNode || undefined,
        ...(fallbackVmUuid ? { vm_uuid: fallbackVmUuid } : {}),
        reason_code: picked.reasonCode,
        linked_bot_ids: evaluations.map((entry) => entry.botId),
        linked_bots: evaluations.length,
      } as VmDeletionEvaluationResult;
    });

    return { items };
  }

  private normalizeDeletePolicy(input?: Partial<VmDeletionPolicy> | null): VmDeletionPolicy {
    return {
      allowBanned: input?.allowBanned ?? true,
      allowPrepareNoResources: input?.allowPrepareNoResources ?? true,
      allowOrphan: input?.allowOrphan ?? true,
    };
  }

  private normalizeToken(value: unknown): string {
    return String(value ?? '')
      .trim()
      .toLowerCase();
  }

  private toObject(value: unknown): Record<string, unknown> {
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
  }

  private evaluateDeleteBot(
    bot: {
      status: string;
      accountEmail: string;
      accountPassword: string;
    },
    resources: {
      hasProxy: boolean;
      hasSubscription: boolean;
      hasLicense: boolean;
    },
    policy: VmDeletionPolicy,
  ): {
    canDelete: boolean;
    reasonCode: string;
    blockers: string[];
  } {
    const status = this.normalizeToken(bot.status);
    const hasEmail = Boolean(bot.accountEmail);
    const hasPassword = Boolean(bot.accountPassword);
    const hasProxy = resources.hasProxy;
    const hasSubscription = resources.hasSubscription;
    const hasLicense = resources.hasLicense;
    const isBanned = status === 'banned';
    const isPrepare = status === 'prepare';
    const isPrepareNoResources = isPrepare && !hasProxy && !hasSubscription && !hasLicense;
    const isPrepareSeed =
      isPrepare && !hasEmail && !hasPassword && !hasProxy && !hasSubscription && !hasLicense;

    if (isBanned && policy.allowBanned) {
      return {
        canDelete: true,
        reasonCode: 'BANNED_ALLOWED',
        blockers: [],
      };
    }
    if (isBanned && !policy.allowBanned) {
      return {
        canDelete: false,
        reasonCode: 'BANNED_BLOCKED',
        blockers: ['BANNED_BLOCKED'],
      };
    }
    if (isPrepareNoResources && policy.allowPrepareNoResources) {
      return {
        canDelete: true,
        reasonCode: isPrepareSeed
          ? 'PREPARE_SEED_NO_CREDENTIALS_RESOURCES_ALLOWED'
          : 'PREPARE_NO_RESOURCES_ALLOWED',
        blockers: [],
      };
    }
    if (isPrepareNoResources && !policy.allowPrepareNoResources) {
      return {
        canDelete: false,
        reasonCode: 'PREPARE_NO_RESOURCES_BLOCKED',
        blockers: ['PREPARE_NO_RESOURCES_BLOCKED'],
      };
    }

    const blockers: string[] = [];
    if (!isPrepare) blockers.push('STATUS_NOT_PREPARE');
    if (hasEmail || hasPassword) blockers.push('CREDENTIALS_PRESENT');
    if (hasProxy) blockers.push('PROXY_LINKED');
    if (hasSubscription) blockers.push('SUBSCRIPTION_LINKED');
    if (hasLicense) blockers.push('LICENSE_LINKED');

    return {
      canDelete: false,
      reasonCode: blockers[0] || 'NOT_ELIGIBLE',
      blockers,
    };
  }

  private resolveEvaluatedVm(
    item: VmDeletionEvaluateItem,
    vmByNodeAndId: Map<string, VmRecord>,
    vmById: Map<string, VmRecord>,
    vmByName: Map<string, VmRecord>,
  ): VmRecord | null {
    const normalizedVmid = String(item.vmid ?? '').trim();
    const normalizedNode = String(item.node ?? '').trim();
    const normalizedName = this.normalizeToken(item.name);

    if (normalizedNode && normalizedVmid) {
      const exact = vmByNodeAndId.get(`${normalizedNode}:${normalizedVmid}`);
      if (exact) {
        return exact;
      }
    }
    if (normalizedVmid) {
      const byId = vmById.get(normalizedVmid);
      if (byId) {
        return byId;
      }
    }
    if (normalizedName) {
      const byName = vmByName.get(normalizedName);
      if (byName) {
        return byName;
      }
    }
    return null;
  }
}
