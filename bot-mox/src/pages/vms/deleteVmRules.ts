import type { DeleteVmBotRecord } from '../../entities/vm/api/vmDeleteContextFacade';
import type { ProxmoxVM, VMGeneratorSettings } from '../../types';

export interface DeleteVmBotEvaluation {
  bot: DeleteVmBotRecord;
  hasEmail: boolean;
  hasPassword: boolean;
  hasProxy: boolean;
  hasSubscription: boolean;
  hasLicense: boolean;
  isBanned: boolean;
  isPrepareSeed: boolean;
  canDelete: boolean;
  reason: string;
}

export interface DeleteVmCandidateRow {
  vm: ProxmoxVM;
  linkedBots: DeleteVmBotRecord[];
  evaluations: DeleteVmBotEvaluation[];
  canDelete: boolean;
  decisionReason: string;
}

export type DeleteVmFilters = NonNullable<VMGeneratorSettings['deleteVmFilters']>;

export const DEFAULT_DELETE_VM_FILTERS: DeleteVmFilters = {
  policy: {
    allowBanned: true,
    allowPrepareNoResources: true,
    allowOrphan: true,
  },
  view: {
    showAllowed: true,
    showLocked: true,
    showRunning: true,
    showStopped: true,
  },
};

export function normalizeToken(value: unknown): string {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

export function normalizeDeleteVmFilters(
  input?: VMGeneratorSettings['deleteVmFilters'],
): DeleteVmFilters {
  return {
    policy: {
      ...DEFAULT_DELETE_VM_FILTERS.policy,
      ...(input?.policy || {}),
    },
    view: {
      ...DEFAULT_DELETE_VM_FILTERS.view,
      ...(input?.view || {}),
    },
  };
}

export function evaluateDeleteBot(
  bot: DeleteVmBotRecord,
  resources: {
    hasProxy: boolean;
    hasSubscription: boolean;
    hasLicense: boolean;
  },
  policy: DeleteVmFilters['policy'],
): DeleteVmBotEvaluation {
  const status = normalizeToken(bot.status);
  const hasEmail = Boolean(bot.accountEmail);
  const hasPassword = Boolean(bot.accountPassword);
  const hasProxy = resources.hasProxy;
  const hasSubscription = resources.hasSubscription;
  const hasLicense = resources.hasLicense;
  const isBanned = status === 'banned';
  const isPrepare = status === 'prepare';
  const isPrepareNoResources = isPrepare && !hasProxy && !hasSubscription && !hasLicense;
  const isPrepareSeed =
    isPrepare && !hasEmail && !hasPassword && !hasProxy && !hasSubscription && !hasLicense;

  if (isBanned && policy.allowBanned) {
    return {
      bot,
      hasEmail,
      hasPassword,
      hasProxy,
      hasSubscription,
      hasLicense,
      isBanned: true,
      isPrepareSeed: false,
      canDelete: true,
      reason: 'BANNED account',
    };
  }

  if (isBanned && !policy.allowBanned) {
    return {
      bot,
      hasEmail,
      hasPassword,
      hasProxy,
      hasSubscription,
      hasLicense,
      isBanned: true,
      isPrepareSeed: false,
      canDelete: false,
      reason: 'BANNED blocked by filter',
    };
  }

  if (isPrepareNoResources && policy.allowPrepareNoResources) {
    return {
      bot,
      hasEmail,
      hasPassword,
      hasProxy,
      hasSubscription,
      hasLicense,
      isBanned: false,
      isPrepareSeed,
      canDelete: true,
      reason: isPrepareSeed
        ? 'PREPARE seed without credentials/resources'
        : 'PREPARE without linked resources',
    };
  }

  if (isPrepareNoResources && !policy.allowPrepareNoResources) {
    return {
      bot,
      hasEmail,
      hasPassword,
      hasProxy,
      hasSubscription,
      hasLicense,
      isBanned: false,
      isPrepareSeed,
      canDelete: false,
      reason: 'PREPARE without resources blocked by filter',
    };
  }

  if (isPrepareSeed && policy.allowPrepareNoResources) {
    return {
      bot,
      hasEmail,
      hasPassword,
      hasProxy,
      hasSubscription,
      hasLicense,
      isBanned: false,
      isPrepareSeed: true,
      canDelete: true,
      reason: 'PREPARE seed without credentials/resources',
    };
  }

  const blockers: string[] = [];
  if (!isPrepare) blockers.push(`status=${status || 'unknown'}`);
  if (hasEmail || hasPassword) blockers.push('credentials present');
  if (hasProxy) blockers.push('proxy linked');
  if (hasSubscription) blockers.push('subscription linked');
  if (hasLicense) blockers.push('license linked');

  return {
    bot,
    hasEmail,
    hasPassword,
    hasProxy,
    hasSubscription,
    hasLicense,
    isBanned: false,
    isPrepareSeed: false,
    canDelete: false,
    reason: blockers.join(', ') || 'not eligible',
  };
}
