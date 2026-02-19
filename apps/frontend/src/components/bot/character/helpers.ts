import type { CharacterFormData, ReferenceData } from './types';

export const toReferenceData = (value: unknown): ReferenceData => {
  if (!value || typeof value !== 'object') {
    return {
      servers: {},
      races: {},
      classes: {},
      factions: {},
    };
  }

  const source = value as Record<string, unknown>;
  return {
    servers: (source.servers as ReferenceData['servers']) || {},
    races: (source.races as ReferenceData['races']) || {},
    classes: (source.classes as ReferenceData['classes']) || {},
    factions: (source.factions as ReferenceData['factions']) || {},
  };
};

export const isCharacterComplete = (formData: CharacterFormData) =>
  !!(
    formData.name?.trim() &&
    formData.server &&
    formData.faction &&
    formData.race &&
    formData.class
  );
