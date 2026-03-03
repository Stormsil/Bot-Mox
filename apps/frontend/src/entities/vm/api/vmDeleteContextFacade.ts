import { vmDeletionEvaluationSchema } from '@botmox/api-contract';
import { apiPost } from '../../../shared/api/apiClient';
import { fetchBotsListViaContract } from '../../../shared/api/providers/bot-contract-client';
import { fetchResourcesViaContract } from '../../resources/api/resourceContractFacade';

export interface DeleteVmBotRecord {
  id: string;
  status: string;
  vmName: string;
  accountEmail: string;
  accountPassword: string;
}

export interface DeleteVmProxyRecord {
  id: string;
  botId: string;
}

export interface DeleteVmSubscriptionRecord {
  id: string;
  botId: string;
}

export interface DeleteVmLicenseRecord {
  id: string;
  botIds: string[];
}

export interface DeleteVmContext {
  bots: Record<string, DeleteVmBotRecord>;
  proxies: DeleteVmProxyRecord[];
  subscriptions: DeleteVmSubscriptionRecord[];
  licenses: DeleteVmLicenseRecord[];
  evaluationsByVmid: Record<string, DeleteVmEvaluationRecord>;
}

export interface DeleteVmEvaluationPolicy {
  allowBanned?: boolean;
  allowPrepareNoResources?: boolean;
  allowOrphan?: boolean;
}

export interface DeleteVmEvaluationItem {
  vmid: number;
  name?: string;
}

export interface DeleteVmEvaluationRecord {
  vmid: number;
  can_delete: boolean;
  reason: string;
  reasons: string[];
}

interface FetchDeleteVmContextOptions {
  evaluation?: {
    items: DeleteVmEvaluationItem[];
    policy?: DeleteVmEvaluationPolicy;
    required?: boolean;
  };
}

interface VmDeletionEvaluationItemDto {
  vmid: number | string;
  can_delete: boolean;
  reason: string;
  reasons?: string[];
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export async function fetchDeleteVmContext(): Promise<DeleteVmContext> {
  const [botsList, proxiesList, subscriptionsList, licensesList] = await Promise.all([
    fetchBotsListViaContract(),
    fetchResourcesViaContract<{ id: string; bot_id?: string | null }>('proxies'),
    fetchResourcesViaContract<{ id: string; bot_id?: string | null }>('subscriptions'),
    fetchResourcesViaContract<{ id: string; bot_ids?: unknown[] }>('licenses'),
  ]);

  const evaluationsByVmid: Record<string, DeleteVmEvaluationRecord> = {};

  const bots: Record<string, DeleteVmBotRecord> = {};
  for (const rawBot of botsList) {
    const botData = toRecord(rawBot);
    const botId = String(botData.id ?? '').trim();
    const vmData = toRecord(botData.vm);
    const accountData = toRecord(botData.account);
    const vmName = String(vmData.name ?? '').trim();
    if (!botId || !vmName) continue;

    bots[botId] = {
      id: botId,
      status: normalizeToken(botData.status),
      vmName,
      accountEmail: String(accountData.email ?? '').trim(),
      accountPassword: String(accountData.password ?? '').trim(),
    };
  }

  const proxies: DeleteVmProxyRecord[] = [];
  for (const proxy of proxiesList) {
    const botId = String(proxy.bot_id ?? '').trim();
    if (!botId) continue;
    proxies.push({ id: proxy.id, botId });
  }

  const subscriptions: DeleteVmSubscriptionRecord[] = [];
  for (const subscription of subscriptionsList) {
    const botId = String(subscription.bot_id ?? '').trim();
    if (!botId) continue;
    subscriptions.push({ id: subscription.id, botId });
  }

  const licenses: DeleteVmLicenseRecord[] = [];
  for (const license of licensesList) {
    const botIds = Array.isArray(license.bot_ids)
      ? license.bot_ids.map((value) => String(value || '').trim()).filter(Boolean)
      : [];
    if (botIds.length === 0) continue;
    licenses.push({ id: license.id, botIds });
  }

  return {
    bots,
    proxies,
    subscriptions,
    licenses,
    evaluationsByVmid,
  };
}

async function fetchVmDeletionEvaluations(input: {
  items: DeleteVmEvaluationItem[];
  policy?: DeleteVmEvaluationPolicy;
}): Promise<Record<string, DeleteVmEvaluationRecord>> {
  const payload = {
    items: input.items.map((item) => ({
      vmid: item.vmid,
      ...(String(item.name || '').trim() ? { name: String(item.name || '').trim() } : {}),
    })),
    ...(input.policy
      ? {
          policy: {
            ...(typeof input.policy.allowBanned === 'boolean'
              ? { allowBanned: input.policy.allowBanned }
              : {}),
            ...(typeof input.policy.allowPrepareNoResources === 'boolean'
              ? { allowPrepareNoResources: input.policy.allowPrepareNoResources }
              : {}),
            ...(typeof input.policy.allowOrphan === 'boolean'
              ? { allowOrphan: input.policy.allowOrphan }
              : {}),
          },
        }
      : {}),
  };

  const response = await apiPost<unknown>('/api/v1/vms/evaluate-deletion', payload);
  const parsed = vmDeletionEvaluationSchema.parse(response.data);
  const map: Record<string, DeleteVmEvaluationRecord> = {};

  parsed.items.forEach((item: VmDeletionEvaluationItemDto) => {
    const vmid = Number(item.vmid);
    if (!Number.isInteger(vmid) || vmid <= 0) {
      return;
    }

    map[String(vmid)] = {
      vmid,
      can_delete: item.can_delete,
      reason: item.reason,
      reasons: Array.isArray(item.reasons) ? item.reasons : [],
    };
  });

  return map;
}

export async function fetchDeleteVmContextWithEvaluation(
  options: FetchDeleteVmContextOptions,
): Promise<DeleteVmContext> {
  const [context, evaluationsByVmid] = await Promise.all([
    fetchDeleteVmContext(),
    (async () => {
      const evaluation = options.evaluation;
      if (!evaluation || evaluation.items.length === 0) {
        return {};
      }

      try {
        return await fetchVmDeletionEvaluations({
          items: evaluation.items,
          policy: evaluation.policy,
        });
      } catch (error) {
        if (evaluation.required) {
          throw error;
        }
        return {};
      }
    })(),
  ]);

  return {
    ...context,
    evaluationsByVmid,
  };
}
