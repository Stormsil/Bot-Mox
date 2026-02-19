interface ResourcePreset {
  label: string;
  cores: number;
  memoryMb: number;
  diskGiB: number;
}

export type VMProjectId = 'wow_tbc' | 'wow_midnight';

export function getProjectOptions(): Array<{ value: VMProjectId; label: string }> {
  return [
    { value: 'wow_tbc', label: 'TBC' },
    { value: 'wow_midnight', label: 'Midnight' },
  ];
}

export function buildResourcePresets(
  getResourcePreset: (projectId: VMProjectId) => {
    cores: number;
    memory: number;
    diskGiB?: number;
  },
): Record<VMProjectId, ResourcePreset> {
  const wowTbc = getResourcePreset('wow_tbc');
  const wowMidnight = getResourcePreset('wow_midnight');

  return {
    wow_tbc: {
      label: 'TBC',
      cores: wowTbc.cores,
      memoryMb: wowTbc.memory,
      diskGiB: wowTbc.diskGiB || 128,
    },
    wow_midnight: {
      label: 'Midnight',
      cores: wowMidnight.cores,
      memoryMb: wowMidnight.memory,
      diskGiB: wowMidnight.diskGiB || 256,
    },
  };
}
