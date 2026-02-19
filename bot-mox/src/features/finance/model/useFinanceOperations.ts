import { message } from 'antd';
import { useCallback, useMemo } from 'react';
import {
  useCreateFinanceOperationMutation,
  useDeleteFinanceOperationMutation,
  useFinanceOperationsQuery,
  useUpdateFinanceOperationMutation,
} from '../../../entities/finance/api/useFinanceOperationsQuery';
import type { FinanceOperationFormData } from '../../../entities/finance/model/types';
import { uiLogger } from '../../../observability/uiLogger';

export function useFinanceOperations() {
  const operationsQuery = useFinanceOperationsQuery();
  const createMutation = useCreateFinanceOperationMutation();
  const updateMutation = useUpdateFinanceOperationMutation();
  const deleteMutation = useDeleteFinanceOperationMutation();

  const loading = useMemo(
    () =>
      operationsQuery.isLoading ||
      createMutation.isPending ||
      updateMutation.isPending ||
      deleteMutation.isPending,
    [
      createMutation.isPending,
      deleteMutation.isPending,
      operationsQuery.isLoading,
      updateMutation.isPending,
    ],
  );

  const addOperation = useCallback(
    async (data: FinanceOperationFormData): Promise<void> => {
      try {
        await createMutation.mutateAsync(data);
        message.success('Transaction added successfully');
      } catch (error) {
        uiLogger.error('Error adding operation:', error);
        message.error('Failed to add transaction');
        throw error;
      }
    },
    [createMutation],
  );

  const updateOperation = useCallback(
    async (id: string, data: Partial<FinanceOperationFormData>): Promise<void> => {
      try {
        await updateMutation.mutateAsync({ id, data });
        message.success('Transaction updated successfully');
      } catch (error) {
        uiLogger.error('Error updating operation:', error);
        message.error('Failed to update transaction');
        throw error;
      }
    },
    [updateMutation],
  );

  const deleteOperation = useCallback(
    async (id: string): Promise<void> => {
      try {
        await deleteMutation.mutateAsync(id);
        message.success('Transaction deleted successfully');
      } catch (error) {
        uiLogger.error('Error deleting operation:', error);
        message.error('Failed to delete transaction');
        throw error;
      }
    },
    [deleteMutation],
  );

  return {
    operations: operationsQuery.data ?? [],
    loading,
    error:
      operationsQuery.error ??
      createMutation.error ??
      updateMutation.error ??
      deleteMutation.error ??
      null,
    addOperation,
    updateOperation,
    deleteOperation,
  };
}
