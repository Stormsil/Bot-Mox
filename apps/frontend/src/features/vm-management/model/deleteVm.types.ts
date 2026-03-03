import type { ProxmoxVM, VMGeneratorSettings } from '../../../shared/types';

export interface DeleteVmCandidateRow {
  vm: ProxmoxVM;
  canDelete: boolean;
  decisionReasonCode?: string;
  decisionReasons: string[];
  decisionReason: string;
}

export type DeleteVmFilters = NonNullable<VMGeneratorSettings['deleteVmFilters']>;
