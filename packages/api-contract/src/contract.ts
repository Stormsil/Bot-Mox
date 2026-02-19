import { initContract } from '@ts-rest/core';
import { apiContractDefinitions } from './contractDefinitions.js';

const c = initContract();

export const apiContract = c.router(apiContractDefinitions);

export type ApiContract = typeof apiContract;
