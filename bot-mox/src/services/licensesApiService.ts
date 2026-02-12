import type { BotLicense } from '../types';
import {
  createResource,
  deleteResource,
  fetchResources,
  subscribeResources,
  updateResource,
} from './resourcesApiService';

export function subscribeLicenses(
  onData: (licenses: BotLicense[]) => void,
  onError?: (error: Error) => void
): () => void {
  return subscribeResources<BotLicense>('licenses', onData, onError, { intervalMs: 7000 });
}

export async function fetchLicenses(): Promise<BotLicense[]> {
  return fetchResources<BotLicense>('licenses');
}

export async function createLicense(payload: Omit<BotLicense, 'id'>): Promise<BotLicense> {
  return createResource<BotLicense>('licenses', payload as Record<string, unknown>);
}

export async function updateLicense(id: string, payload: Partial<BotLicense>): Promise<BotLicense> {
  return updateResource<BotLicense>('licenses', id, payload as Record<string, unknown>);
}

export async function deleteLicense(id: string): Promise<void> {
  await deleteResource('licenses', id);
}
