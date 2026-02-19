import { type UseQueryResult, useQuery } from '@tanstack/react-query';
import type { BotLicense, Proxy as ProxyResource, Subscription } from '../../../types';
import type { ResourceKind } from '../model/types';
import { fetchResourcesViaContract } from './resourceContractFacade';
import { resourceQueryKeys } from './resourceQueryKeys';

const RESOURCES_REFETCH_INTERVAL_MS = 7_000;

export function useResourcesQuery<T extends { id: string }>(
  kind: ResourceKind,
): UseQueryResult<T[], Error> {
  return useQuery<T[], Error>({
    queryKey: resourceQueryKeys.list(kind),
    queryFn: () => fetchResourcesViaContract<T>(kind),
    refetchInterval: RESOURCES_REFETCH_INTERVAL_MS,
  });
}

export function useLicensesQuery(): UseQueryResult<BotLicense[], Error> {
  return useResourcesQuery<BotLicense>('licenses');
}

export function useProxiesQuery(): UseQueryResult<ProxyResource[], Error> {
  return useResourcesQuery<ProxyResource>('proxies');
}

export function useSubscriptionsQuery(): UseQueryResult<Subscription[], Error> {
  return useResourcesQuery<Subscription>('subscriptions');
}
