import {
  type UseMutationResult,
  type UseQueryResult,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import {
  createFinanceOperation,
  deleteFinanceOperation,
  getFinanceOperations,
  updateFinanceOperation,
} from '../lib/analytics';
import type { FinanceOperation, FinanceOperationFormData } from '../model/types';
import { financeQueryKeys } from './financeQueryKeys';

export function useFinanceOperationsQuery(): UseQueryResult<FinanceOperation[], Error> {
  return useQuery<FinanceOperation[], Error>({
    queryKey: financeQueryKeys.operations(),
    queryFn: getFinanceOperations,
    refetchInterval: 4_000,
  });
}

export function useCreateFinanceOperationMutation(): UseMutationResult<
  string,
  Error,
  FinanceOperationFormData
> {
  const queryClient = useQueryClient();
  return useMutation<string, Error, FinanceOperationFormData>({
    mutationFn: createFinanceOperation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeQueryKeys.operations() });
    },
  });
}

export function useUpdateFinanceOperationMutation(): UseMutationResult<
  void,
  Error,
  { id: string; data: Partial<FinanceOperationFormData> }
> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, { id: string; data: Partial<FinanceOperationFormData> }>({
    mutationFn: ({ id, data }) => updateFinanceOperation(id, data),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeQueryKeys.operations() });
    },
  });
}

export function useDeleteFinanceOperationMutation(): UseMutationResult<void, Error, string> {
  const queryClient = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: deleteFinanceOperation,
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: financeQueryKeys.operations() });
    },
  });
}
