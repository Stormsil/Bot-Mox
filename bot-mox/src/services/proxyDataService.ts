import type { Proxy } from '../types';
import { subscribeBotsMap, type BotRecord } from './botsApiService';
import {
  createResource,
  deleteResource,
  subscribeResources,
  updateResource,
} from './resourcesApiService';

export interface ProxiesBotMap {
  [botId: string]: {
    character?: { name?: string };
    person?: { name?: string; vm_name?: string };
    vm?: { name?: string };
    name?: string;
  };
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {};
}

function toBotMap(bots: Record<string, BotRecord>): ProxiesBotMap {
  const normalized: ProxiesBotMap = {};

  Object.entries(bots).forEach(([botId, bot]) => {
    const source = toRecord(bot);
    const character = toRecord(source.character);
    const person = toRecord(source.person);
    const vm = toRecord(source.vm);

    normalized[botId] = {
      character: Object.keys(character).length > 0 ? { name: typeof character.name === 'string' ? character.name : undefined } : undefined,
      person: Object.keys(person).length > 0
        ? {
            name: typeof person.name === 'string' ? person.name : undefined,
            vm_name: typeof person.vm_name === 'string' ? person.vm_name : undefined,
          }
        : undefined,
      vm: Object.keys(vm).length > 0 ? { name: typeof vm.name === 'string' ? vm.name : undefined } : undefined,
      name: typeof source.name === 'string' ? source.name : undefined,
    };
  });

  return normalized;
}

export function subscribeProxies(
  onData: (list: Proxy[]) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeResources<Proxy>('proxies', onData, onError, {
    intervalMs: 6000,
  });
}

export function subscribeBots(
  onData: (bots: ProxiesBotMap) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeBotsMap(
    (bots) => {
      onData(toBotMap(bots));
    },
    onError,
    {
      intervalMs: 6000,
    }
  );
}

export async function deleteProxyById(proxyId: string): Promise<void> {
  await deleteResource('proxies', proxyId);
}

export async function updateProxyById(proxyId: string, proxyData: Partial<Proxy>): Promise<void> {
  await updateResource<Proxy>('proxies', proxyId, proxyData as Record<string, unknown>);
}

export async function createProxy(proxyData: Omit<Proxy, 'id'>): Promise<string> {
  const created = await createResource<Proxy>('proxies', proxyData as Record<string, unknown>);
  return created.id;
}
