import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { getProjectSettings, type ProjectSettings } from './settingsFacade';
import { settingsQueryKeys } from './settingsQueryKeys';

const PROJECT_SETTINGS_REFETCH_MS = 8_000;

export function useProjectSettingsQuery(): UseQueryResult<Record<string, ProjectSettings>, Error> {
  return useQuery<Record<string, ProjectSettings>, Error>({
    queryKey: settingsQueryKeys.projects(),
    queryFn: getProjectSettings,
    refetchInterval: PROJECT_SETTINGS_REFETCH_MS,
  });
}
