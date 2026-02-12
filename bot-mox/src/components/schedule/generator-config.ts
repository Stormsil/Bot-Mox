import type { ScheduleGenerationParams, ScheduleTemplate } from '../../types';

export const DEFAULT_PARAMS: ScheduleGenerationParams = {
  startTime: '07:00',
  endTime: '23:30',
  useSecondWindow: false,
  startTime2: '00:00',
  endTime2: '02:00',
  targetActiveMinutes: 720,
  minSessionMinutes: 60,
  minBreakMinutes: 30,
  randomOffsetMinutes: 15,
  profile: 'farming',
};

export const CONSTRAINTS = {
  minSessionMinutes: { min: 15, max: 240 },
  minBreakMinutes: { min: 5, max: 120 },
  randomOffsetMinutes: { min: 0, max: 60 },
  targetActiveMinutes: { min: 30, max: 1380 },
};

export const toTemplatesList = (value: unknown): ScheduleTemplate[] => {
  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value as Record<string, Record<string, unknown>>).map(([id, raw]) => ({
    id,
    name: typeof raw?.name === 'string' ? raw.name : 'Unnamed template',
    params: (raw?.params as ScheduleGenerationParams) || DEFAULT_PARAMS,
    created_at: typeof raw?.created_at === 'number' ? raw.created_at : Date.now(),
    updated_at: typeof raw?.updated_at === 'number' ? raw.updated_at : Date.now(),
  }));
};
