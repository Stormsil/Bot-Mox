import type { ResourceKind } from '../model/types';

export const resourceQueryKeys = {
  all: ['resources'] as const,
  lists: () => [...resourceQueryKeys.all, 'list'] as const,
  list: (kind: ResourceKind) => [...resourceQueryKeys.lists(), kind] as const,
};
