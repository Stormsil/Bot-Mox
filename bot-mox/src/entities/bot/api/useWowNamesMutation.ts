import { type UseMutationResult, useMutation } from '@tanstack/react-query';
import { getWowNames } from './botLegacyFacade';

interface GetWowNamesPayload {
  batches?: number;
}

export function useWowNamesMutation(): UseMutationResult<
  Awaited<ReturnType<typeof getWowNames>>,
  Error,
  GetWowNamesPayload
> {
  return useMutation<Awaited<ReturnType<typeof getWowNames>>, Error, GetWowNamesPayload>({
    mutationFn: async ({ batches }) => getWowNames({ batches }),
  });
}
