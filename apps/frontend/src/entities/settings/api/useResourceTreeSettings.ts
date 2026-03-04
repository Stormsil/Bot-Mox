import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  fetchResourceTreeSettings,
  type ResourceTreeSettingsPayload,
  saveResourceTreeSettings,
} from './resourceTreeFacade';
import { settingsQueryKeys } from './settingsQueryKeys';

export function useResourceTreeSettingsQuery(): UseQueryResult<
  ResourceTreeSettingsPayload | null,
  Error
> {
  return useQuery<ResourceTreeSettingsPayload | null, Error>({
    queryKey: settingsQueryKeys.resourceTree(),
    queryFn: fetchResourceTreeSettings,
  });
}

export function useSaveResourceTreeSettingsMutation(): UseMutationResult<
  void,
  Error,
  ResourceTreeSettingsPayload
> {
  const queryClient = useQueryClient();

  return useMutation<void, Error, ResourceTreeSettingsPayload>({
    mutationFn: async (payload) => {
      await saveResourceTreeSettings(payload);
    },
    onSuccess: (_data, payload) => {
      queryClient.setQueryData(settingsQueryKeys.resourceTree(), payload);
    },
  });
}
