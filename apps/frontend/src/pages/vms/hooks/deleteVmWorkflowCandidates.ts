import type {
  DeleteVmBotRecord,
  DeleteVmLicenseRecord,
  DeleteVmProxyRecord,
  DeleteVmSubscriptionRecord,
} from '../../../entities/vm/api/vmDeleteContextFacade';
import type { ProxmoxVM } from '../../../types';
import {
  type DeleteVmCandidateRow,
  type DeleteVmFilters,
  evaluateDeleteBot,
  normalizeToken,
} from '../deleteVmRules';

interface BuildDeleteVmCandidatesRawParams {
  deleteVmBots: Record<string, DeleteVmBotRecord>;
  deleteVmProxies: DeleteVmProxyRecord[];
  deleteVmSubscriptions: DeleteVmSubscriptionRecord[];
  deleteVmLicenses: DeleteVmLicenseRecord[];
  proxmoxVms: ProxmoxVM[];
  templateVmId: number;
  policy: DeleteVmFilters['policy'];
}

export function buildDeleteVmCandidatesRaw({
  deleteVmBots,
  deleteVmProxies,
  deleteVmSubscriptions,
  deleteVmLicenses,
  proxmoxVms,
  templateVmId,
  policy,
}: BuildDeleteVmCandidatesRawParams): DeleteVmCandidateRow[] {
  const botsByVmName = new Map<string, DeleteVmBotRecord[]>();

  Object.values(deleteVmBots).forEach((bot) => {
    const key = normalizeToken(bot.vmName);
    if (!key) {
      return;
    }

    const current = botsByVmName.get(key);
    if (current) {
      current.push(bot);
    } else {
      botsByVmName.set(key, [bot]);
    }
  });

  const proxiesByBotId = new Map<string, number>();
  deleteVmProxies.forEach((record) => {
    proxiesByBotId.set(record.botId, (proxiesByBotId.get(record.botId) || 0) + 1);
  });

  const subscriptionsByBotId = new Map<string, number>();
  deleteVmSubscriptions.forEach((record) => {
    subscriptionsByBotId.set(record.botId, (subscriptionsByBotId.get(record.botId) || 0) + 1);
  });

  const licensesByBotId = new Map<string, number>();
  deleteVmLicenses.forEach((record) => {
    record.botIds.forEach((botId) => {
      licensesByBotId.set(botId, (licensesByBotId.get(botId) || 0) + 1);
    });
  });

  return [...proxmoxVms]
    .filter((vm) => !vm.template)
    .filter((vm) => vm.vmid !== templateVmId)
    .sort((first, second) => first.vmid - second.vmid)
    .map((vm) => {
      const linkedBots = botsByVmName.get(normalizeToken(vm.name)) || [];
      const evaluations = linkedBots.map((bot) =>
        evaluateDeleteBot(
          bot,
          {
            hasProxy: (proxiesByBotId.get(bot.id) || 0) > 0,
            hasSubscription: (subscriptionsByBotId.get(bot.id) || 0) > 0,
            hasLicense: (licensesByBotId.get(bot.id) || 0) > 0,
          },
          policy,
        ),
      );

      let canDelete = false;
      let decisionReason = '';

      if (evaluations.length === 0) {
        canDelete = policy.allowOrphan;
        decisionReason = policy.allowOrphan
          ? 'Orphan VM: no linked account in database'
          : 'Orphan VM blocked by filter';
      } else {
        const blocked = evaluations.find((evaluation) => !evaluation.canDelete);
        if (blocked) {
          decisionReason = blocked.reason;
        } else {
          canDelete = true;
          decisionReason = evaluations[0]?.reason || 'Eligible for deletion';
        }
      }

      return {
        vm,
        linkedBots,
        evaluations,
        canDelete,
        decisionReason,
      };
    });
}

export function filterDeleteVmCandidates(
  candidates: DeleteVmCandidateRow[],
  view: DeleteVmFilters['view'],
): DeleteVmCandidateRow[] {
  return candidates.filter((candidate) => {
    const vmStatus = normalizeToken(candidate.vm.status);
    const statusAllowed =
      (vmStatus === 'running' && view.showRunning) ||
      (vmStatus === 'stopped' && view.showStopped) ||
      (vmStatus !== 'running' && vmStatus !== 'stopped');

    if (!statusAllowed) {
      return false;
    }
    if (candidate.canDelete && !view.showAllowed) {
      return false;
    }
    if (!candidate.canDelete && !view.showLocked) {
      return false;
    }

    return true;
  });
}

export function collectSelectableDeleteVmIds(
  candidates: DeleteVmCandidateRow[],
  queuedDeleteVmIds: Set<number>,
): Set<number> {
  const ids = new Set<number>();

  candidates.forEach((candidate) => {
    if (!candidate.canDelete) {
      return;
    }
    if (queuedDeleteVmIds.has(candidate.vm.vmid)) {
      return;
    }

    ids.add(candidate.vm.vmid);
  });

  return ids;
}
