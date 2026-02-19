import { contractRoutesInfraProxmox } from './contractRoutesInfraProxmox.js';
import { contractRoutesInfraSsh } from './contractRoutesInfraSsh.js';

export const contractRoutesInfra = {
  ...contractRoutesInfraProxmox,
  ...contractRoutesInfraSsh,
} as const;
