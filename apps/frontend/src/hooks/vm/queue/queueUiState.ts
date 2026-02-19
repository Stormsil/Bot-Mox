import type { VMUiState } from '../../../types';

export function resolveDeleteOnlyUiState(params: {
  deleteSuccessCount: number;
  deleteErrorCount: number;
}): VMUiState {
  const { deleteSuccessCount, deleteErrorCount } = params;

  if (deleteSuccessCount > 0 && deleteErrorCount === 0) {
    return 'success';
  }
  if (deleteSuccessCount > 0 && deleteErrorCount > 0) {
    return 'error';
  }
  if (deleteErrorCount > 0) {
    return 'error';
  }
  return 'ready';
}

export function resolveBatchUiState(params: {
  completedVmCount: number;
  totalErrorCount: number;
}): VMUiState {
  const { completedVmCount, totalErrorCount } = params;

  if (completedVmCount > 0) {
    return totalErrorCount > 0 ? 'error' : 'success';
  }

  return 'error';
}
