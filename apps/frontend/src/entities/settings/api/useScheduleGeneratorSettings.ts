import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import type { ScheduleGenerationParams, ScheduleTemplate } from '../../../types';
import { apiGet, apiPatch, apiPut } from './settingsPathClient';
import { settingsQueryKeys } from './settingsQueryKeys';

const SCHEDULE_TEMPLATES_PATH = '/api/v1/settings/schedule/templates';
const SCHEDULE_LAST_PARAMS_PATH = '/api/v1/settings/schedule/last_params';
const SCHEDULE_REFETCH_MS = 8_000;

const FALLBACK_PARAMS: ScheduleGenerationParams = {
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

export interface ScheduleGeneratorSettingsData {
  templates: ScheduleTemplate[];
  lastParams: Partial<ScheduleGenerationParams> | null;
}

function toTemplatesList(value: unknown): ScheduleTemplate[] {
  if (!value || typeof value !== 'object') {
    return [];
  }

  return Object.entries(value as Record<string, Record<string, unknown>>).map(([id, raw]) => ({
    id,
    name: typeof raw?.name === 'string' ? raw.name : 'Unnamed template',
    params: (raw?.params as ScheduleGenerationParams) || FALLBACK_PARAMS,
    created_at: typeof raw?.created_at === 'number' ? raw.created_at : Date.now(),
    updated_at: typeof raw?.updated_at === 'number' ? raw.updated_at : Date.now(),
  }));
}

async function fetchScheduleGeneratorSettings(): Promise<ScheduleGeneratorSettingsData> {
  const [templatesResponse, lastParamsResponse] = await Promise.all([
    apiGet<unknown>(SCHEDULE_TEMPLATES_PATH),
    apiGet<unknown>(SCHEDULE_LAST_PARAMS_PATH),
  ]);

  return {
    templates: toTemplatesList(templatesResponse.data),
    lastParams:
      lastParamsResponse.data && typeof lastParamsResponse.data === 'object'
        ? (lastParamsResponse.data as Partial<ScheduleGenerationParams>)
        : null,
  };
}

export function useScheduleGeneratorSettingsQuery(): UseQueryResult<
  ScheduleGeneratorSettingsData,
  Error
> {
  return useQuery<ScheduleGeneratorSettingsData, Error>({
    queryKey: settingsQueryKeys.scheduleGenerator(),
    queryFn: fetchScheduleGeneratorSettings,
    refetchInterval: SCHEDULE_REFETCH_MS,
  });
}

export function useSaveScheduleLastParamsMutation(): UseMutationResult<
  void,
  Error,
  ScheduleGenerationParams
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ScheduleGenerationParams>({
    mutationFn: async (params) => {
      await apiPut(SCHEDULE_LAST_PARAMS_PATH, params);
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.scheduleGenerator() });
    },
  });
}

export interface SaveScheduleTemplatePayload {
  templateId: string;
  name: string;
  params: ScheduleGenerationParams;
}

export function useSaveScheduleTemplateMutation(): UseMutationResult<
  void,
  Error,
  SaveScheduleTemplatePayload
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, SaveScheduleTemplatePayload>({
    mutationFn: async ({ templateId, name, params }) => {
      await apiPut(`${SCHEDULE_TEMPLATES_PATH}/${templateId}`, {
        name,
        params,
        created_at: Date.now(),
        updated_at: Date.now(),
      });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.scheduleGenerator() });
    },
  });
}

export function useDeleteScheduleTemplateMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: async (templateId) => {
      await apiPatch(SCHEDULE_TEMPLATES_PATH, { [templateId]: null });
    },
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: settingsQueryKeys.scheduleGenerator() });
    },
  });
}
