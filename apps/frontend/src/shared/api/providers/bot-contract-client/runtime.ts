import type { BotRecord } from '../../../../entities/bot/model/types';
import {
  createContractRuntimeClient,
  resolveContractApiBaseUrl,
  toContractApiClientError,
} from '../../contracts/runtimeClient';

export const createRuntimeClient = createContractRuntimeClient;
export const resolveApiBaseUrl = resolveContractApiBaseUrl;
export const toApiClientError = toContractApiClientError;

export function toBotRecord(value: unknown): BotRecord | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!id) return null;

  return source as unknown as BotRecord;
}
