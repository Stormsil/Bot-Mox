import { MutationCache, QueryClient } from '@tanstack/react-query';
import { message } from 'antd';

import { ApiClientError } from '../../api/internal/types';
import { mutationToastOwnershipMetaKeys } from './mutationToastOwnership';

function resolveMutationErrorMessage(error: unknown): string {
  if (error instanceof ApiClientError) {
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return 'An unexpected error occurred';
}

export const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const suppressGlobalErrorToast =
        mutation.options.meta?.[mutationToastOwnershipMetaKeys.suppressGlobalErrorToast] === true;

      if (suppressGlobalErrorToast) {
        return;
      }

      message.error(resolveMutationErrorMessage(error));
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      gcTime: 5 * 60_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});
