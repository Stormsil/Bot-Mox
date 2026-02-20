import { useCallback, useMemo } from 'react';
import type { VMGeneratorSettings, VMResourceMode } from '../../../types';
import { buildResourcePresets, getProjectOptions } from '../page/resourcePresets';
import { normalizeCores, normalizeMemory } from '../vmPageUtils';

type VMProjectId = 'wow_tbc' | 'wow_midnight';

interface UseVmResourcePresetsOptions {
  settings: VMGeneratorSettings | null;
  templateHardwareLive: { cores: number; memory: number } | null;
}

interface VmResourcePreset {
  cores: number;
  memory: number;
  diskGiB: number | undefined;
}

export function useVmResourcePresets(options: UseVmResourcePresetsOptions): {
  templateVmId: number;
  getResourcePreset: (projectId: VMProjectId, mode: VMResourceMode) => VmResourcePreset;
  projectOptions: ReturnType<typeof getProjectOptions>;
  resourcePresets: ReturnType<typeof buildResourcePresets>;
} {
  const getResourcePreset = useCallback(
    (projectId: VMProjectId, mode: VMResourceMode) => {
      const fallbackCores = 2;
      const fallbackMemory = 4096;
      const templateCores = normalizeCores(
        options.templateHardwareLive?.cores ?? options.settings?.hardware?.cores,
        fallbackCores,
      );
      const templateMemory = normalizeMemory(
        options.templateHardwareLive?.memory ?? options.settings?.hardware?.memory,
        fallbackMemory,
      );
      const projectPreset = options.settings?.projectHardware?.[projectId];
      const projectCores = normalizeCores(projectPreset?.cores, templateCores);
      const projectMemory = normalizeMemory(projectPreset?.memory, templateMemory);
      const projectDiskGiB =
        Number.isFinite(Number(projectPreset?.diskGiB)) && Number(projectPreset?.diskGiB) > 0
          ? Math.max(1, Math.trunc(Number(projectPreset?.diskGiB)))
          : undefined;

      if (mode === 'project' || mode === 'custom') {
        return { cores: projectCores, memory: projectMemory, diskGiB: projectDiskGiB };
      }

      return { cores: templateCores, memory: templateMemory, diskGiB: undefined };
    },
    [options.settings, options.templateHardwareLive],
  );

  const templateVmId = useMemo(() => {
    const candidate = Number(options.settings?.template?.vmId ?? 100);
    if (!Number.isFinite(candidate) || candidate < 1) {
      return 100;
    }
    return Math.trunc(candidate);
  }, [options.settings?.template?.vmId]);

  const projectOptions = getProjectOptions();
  const resourcePresets = buildResourcePresets((projectId) =>
    getResourcePreset(projectId, 'project'),
  );

  return {
    templateVmId,
    getResourcePreset,
    projectOptions,
    resourcePresets,
  };
}
