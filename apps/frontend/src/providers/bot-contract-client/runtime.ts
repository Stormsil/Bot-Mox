import type { BotRecord } from '../../entities/bot/model/types';

export {
  createContractRuntimeClient as createRuntimeClient,
  resolveContractApiBaseUrl as resolveApiBaseUrl,
  resolveContractAuthorizationHeader as resolveAuthorizationHeader,
  resolveContractBearerToken as resolveBearerToken,
  toContractApiClientError as toApiClientError,
} from '../../shared/api/contracts/runtimeClient';

export function toBotRecord(value: unknown): BotRecord | null {
  if (!value || typeof value !== 'object') return null;
  const source = value as Record<string, unknown>;
  const id = typeof source.id === 'string' ? source.id.trim() : '';
  if (!id) return null;

  return source as unknown as BotRecord;
}
