import { initClient } from '@ts-rest/core';
import { apiContract } from './contract.js';
import { adminProjectsContract } from './contractAdminProjects.js';

export type { ApiContract } from './contract.js';
export { apiContract } from './contract.js';
export type { AdminProjectsContract } from './contractAdminProjects.js';
export { adminProjectsContract } from './contractAdminProjects.js';
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

export function createAdminProjectsContractClient(options: ApiClientOptions) {
  const token = options.accessToken?.trim();
  return initClient(adminProjectsContract, {
    baseUrl: options.baseUrl.replace(/\/+$/, ''),
    baseHeaders: token ? { authorization: `Bearer ${token}` } : {},
    throwOnUnknownStatus: false,
  });
}
