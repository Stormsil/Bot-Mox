import '@tanstack/react-query';

export const mutationToastOwnershipMetaKeys = {
  suppressGlobalErrorToast: 'suppressGlobalErrorToast',
  localErrorToastOwner: 'localErrorToastOwner',
  errorToastDedupeKey: 'errorToastDedupeKey',
} as const;

export interface MutationToastOwnershipMeta {
  suppressGlobalErrorToast?: boolean;
  localErrorToastOwner?: boolean;
  errorToastDedupeKey?: string;
}

export type SharedMutationMeta = MutationToastOwnershipMeta & Record<string, unknown>;

declare module '@tanstack/react-query' {
  interface Register {
    mutationMeta: SharedMutationMeta;
  }
}
