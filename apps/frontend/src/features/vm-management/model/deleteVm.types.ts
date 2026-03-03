import type { DeleteVmBotRecord } from '../../../entities/vm/api/vmDeleteContextFacade';
import type { ProxmoxVM, VMGeneratorSettings } from '../../../shared/types';

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
