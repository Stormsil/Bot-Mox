import { fetchBotsListViaContract } from '../../../providers/bot-contract-client';
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
  };
}
