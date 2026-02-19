import { initClient } from '@ts-rest/core';
import { apiContract } from './contract.js';

export type { ApiContract } from './contract.js';
export { apiContract } from './contract.js';
export * from './schemas.js';

export interface ApiClientOptions {
  baseUrl: string;
  accessToken?: string;
}

export function createApiContractClient(options: ApiClientOptions) {
  const token = options.accessToken?.trim();
  return initClient(apiContract, {
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    baseHeaders: token ? { authorization: `Bearer ${token}` } : {},
    throwOnUnknownStatus: false,
  });
}
