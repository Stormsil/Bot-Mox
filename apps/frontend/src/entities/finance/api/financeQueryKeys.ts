export const financeQueryKeys = {
  all: ['finance'] as const,
  operations: () => [...financeQueryKeys.all, 'operations'] as const,
};
