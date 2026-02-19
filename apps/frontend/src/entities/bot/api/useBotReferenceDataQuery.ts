import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import { readSettingsPath } from '../../settings/api/settingsPathClient';
import { botQueryKeys } from './botQueryKeys';

export function useBotReferenceDataQuery(projectId?: string): UseQueryResult<unknown, Error> {
  const id = String(projectId || '').trim();

  return useQuery<unknown, Error>({
    queryKey: botQueryKeys.referenceData(id || 'unknown'),
    queryFn: async () => {
      const response = await readSettingsPath<unknown>(
        `projects/${encodeURIComponent(id)}/referenceData`,
      );
      return response;
    },
    enabled: id.length > 0,
    staleTime: 5 * 60 * 1000,
  });
}
