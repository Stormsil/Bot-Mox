import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { getProjectSettings, type ProjectSettings } from './settingsFacade';
import { settingsQueryKeys } from './settingsQueryKeys';

export function useProjectSettingsQuery(): UseQueryResult<Record<string, ProjectSettings>, Error> {
  return useQuery<Record<string, ProjectSettings>, Error>({
    queryKey: settingsQueryKeys.projects(),
    queryFn: getProjectSettings,
  });
}
