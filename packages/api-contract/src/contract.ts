import { initContract } from '@ts-rest/core';
import { type ApiContractDefinitions, apiContractDefinitions } from './contractDefinitions.js';

const c = initContract();

export const apiContract: ApiContractDefinitions = c.router(apiContractDefinitions);

export type ApiContract = typeof apiContract;
