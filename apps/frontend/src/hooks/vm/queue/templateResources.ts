import { getVMConfig } from '../../../services/vmService';
import type { VMLog } from '../../useVMLog';
import { normalizeCores, normalizeMemory } from './utils';

interface ResolveTemplateHardwareParams {
  templateVmId: number;
  targetNode: string;
  settingsTemplateCores: number;
  settingsTemplateMemory: number;
  log: VMLog;
}

export async function resolveTemplateHardware(params: ResolveTemplateHardwareParams): Promise<{
  liveTemplateCores: number;
  liveTemplateMemory: number;
}> {
  const { templateVmId, targetNode, settingsTemplateCores, settingsTemplateMemory, log } = params;

  let liveTemplateCores = settingsTemplateCores;
  let liveTemplateMemory = settingsTemplateMemory;

  try {
    const templateConfig = await getVMConfig(templateVmId, targetNode);
    liveTemplateCores = normalizeCores(templateConfig.cores, settingsTemplateCores);
    liveTemplateMemory = normalizeMemory(templateConfig.memory, settingsTemplateMemory);
    log.info(
      `Template VM ${templateVmId} resources from API: cores=${liveTemplateCores}, memory=${liveTemplateMemory}MB`,
    );
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    log.warn(
      `Failed to read template VM ${templateVmId} config from API (${msg}). Using settings fallback: cores=${settingsTemplateCores}, memory=${settingsTemplateMemory}MB`,
    );
  }

  return { liveTemplateCores, liveTemplateMemory };
}
