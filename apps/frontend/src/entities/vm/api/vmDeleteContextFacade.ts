import { vmDeletionEvaluationSchema } from '@botmox/api-contract';
import {
  createContractRuntimeClient,
  toContractApiClientError,
} from '../../../shared/api/contracts/runtimeClient';

export interface DeleteVmEvaluationPolicy {
  allowBanned?: boolean;
  allowPrepareNoResources?: boolean;
  allowOrphan?: boolean;
}

export interface DeleteVmEvaluationItem {
  vmid: number;
  name?: string;
}

export interface DeleteVmEvaluationRecord {
  vmid: number;
  can_delete: boolean;
  reason_code?: string;
  reason: string;
  reasons: string[];
  linked_bots?: Array<Record<string, unknown>>;
}

interface FetchDeleteVmEvaluationsOptions {
  evaluation?: {
    items: DeleteVmEvaluationItem[];
    policy?: DeleteVmEvaluationPolicy;
    required?: boolean;
  };
}

interface VmDeletionEvaluationItemDto {
  vmid: number | string;
  can_delete: boolean;
  reason_code?: string;
  reason: string;
  reasons?: string[];
  linked_bots?: Array<Record<string, unknown>>;
}

const VM_DELETION_EVALUATION_ENDPOINT = '/api/v1/vms/evaluate-deletion';

async function fetchVmDeletionEvaluations(input: {
  items: DeleteVmEvaluationItem[];
  policy?: DeleteVmEvaluationPolicy;
}): Promise<Record<string, DeleteVmEvaluationRecord>> {
  const payload = {
    items: input.items.map((item) => ({
      vmid: item.vmid,
      ...(String(item.name || '').trim() ? { name: String(item.name || '').trim() } : {}),
    })),
    ...(input.policy
      ? {
          policy: {
            ...(typeof input.policy.allowBanned === 'boolean'
              ? { allowBanned: input.policy.allowBanned }
              : {}),
            ...(typeof input.policy.allowPrepareNoResources === 'boolean'
              ? { allowPrepareNoResources: input.policy.allowPrepareNoResources }
              : {}),
            ...(typeof input.policy.allowOrphan === 'boolean'
              ? { allowOrphan: input.policy.allowOrphan }
              : {}),
          },
        }
      : {}),
  };

  const client = createContractRuntimeClient();
  const response = await client.vmsEvaluateDeletion({
    body: payload,
  });
  if (response.status !== 200) {
    throw toContractApiClientError(VM_DELETION_EVALUATION_ENDPOINT, response.status, response.body);
  }

  const parsed = vmDeletionEvaluationSchema.parse(response.body.data);
  const map: Record<string, DeleteVmEvaluationRecord> = {};

  parsed.items.forEach((item: VmDeletionEvaluationItemDto) => {
    const vmid = Number(item.vmid);
    if (!Number.isInteger(vmid) || vmid <= 0) {
      return;
    }

    map[String(vmid)] = {
      vmid,
      can_delete: item.can_delete,
      reason_code: String(item.reason_code || '').trim() || undefined,
      reason: item.reason,
      reasons: Array.isArray(item.reasons) ? item.reasons : [],
      linked_bots: Array.isArray(item.linked_bots) ? item.linked_bots : undefined,
    };
  });

  return map;
}

export async function fetchDeleteVmEvaluations(
  options: FetchDeleteVmEvaluationsOptions,
): Promise<Record<string, DeleteVmEvaluationRecord>> {
  const evaluationsByVmid = await (async () => {
    const evaluation = options.evaluation;
    if (!evaluation || evaluation.items.length === 0) {
      return {};
    }

    try {
      return await fetchVmDeletionEvaluations({
        items: evaluation.items,
        policy: evaluation.policy,
      });
    } catch (error) {
      if (evaluation.required) {
        throw error;
      }
      return {};
    }
  })();

  return evaluationsByVmid;
}
