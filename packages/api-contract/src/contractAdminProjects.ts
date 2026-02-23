import { initContract } from '@ts-rest/core';
import { contractRoutesAdminProjects } from './contractRoutesAdminProjects.js';

const c = initContract();

export const adminProjectsContract = c.router(contractRoutesAdminProjects);

export type AdminProjectsContract = typeof adminProjectsContract;
