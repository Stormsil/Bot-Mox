import { contractRoutesAgents } from './contractRoutesAgents.js';
import { contractRoutesArtifacts } from './contractRoutesArtifacts.js';
import { contractRoutesAuth } from './contractRoutesAuth.js';
import { contractRoutesBots } from './contractRoutesBots.js';
import { contractRoutesCore } from './contractRoutesCore.js';
import { contractRoutesFinance } from './contractRoutesFinance.js';
import { contractRoutesInfra } from './contractRoutesInfra.js';
import { contractRoutesIpqs } from './contractRoutesIpqs.js';
import { contractRoutesLicense } from './contractRoutesLicense.js';
import { contractRoutesPlaybooks } from './contractRoutesPlaybooks.js';
import { contractRoutesProvisioning } from './contractRoutesProvisioning.js';
import { contractRoutesResources } from './contractRoutesResources.js';
import { contractRoutesSecrets } from './contractRoutesSecrets.js';
import { contractRoutesSettingsTheme } from './contractRoutesSettingsTheme.js';
import { contractRoutesVmOps } from './contractRoutesVmOps.js';
import { contractRoutesVmRegistry } from './contractRoutesVmRegistry.js';
import { contractRoutesWorkspace } from './contractRoutesWorkspace.js';
import { contractRoutesWowNames } from './contractRoutesWowNames.js';

export const apiContractDefinitions = {
  ...contractRoutesCore,
  ...contractRoutesAuth,
  ...contractRoutesLicense,
  ...contractRoutesProvisioning,
  ...contractRoutesBots,
  ...contractRoutesResources,
  ...contractRoutesSettingsTheme,
  ...contractRoutesWorkspace,
  ...contractRoutesFinance,
  ...contractRoutesPlaybooks,
  ...contractRoutesIpqs,
  ...contractRoutesWowNames,
  ...contractRoutesAgents,
  ...contractRoutesVmRegistry,
  ...contractRoutesSecrets,
  ...contractRoutesArtifacts,
  ...contractRoutesInfra,
  ...contractRoutesVmOps,
} as const;
