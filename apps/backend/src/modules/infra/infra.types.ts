export interface VmRecord {
  node: string;
  vmid: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
}

export interface CloneVmInput {
  node: string;
  vmid: string;
  body: {
    newid?: number | undefined;
    name?: string | undefined;
    storage?: string | undefined;
    format?: string | undefined;
    full?: number | boolean | undefined;
  };
}

export interface UpdateVmConfigInput {
  node: string;
  vmid: string;
  body: Record<string, unknown>;
}

export interface DeleteVmInput {
  node: string;
  vmid: string;
  purge?: boolean | undefined;
  destroyUnreferencedDisks?: boolean | undefined;
}

export interface ExecSshInput {
  command: string;
  timeout?: number | undefined;
}

export interface WriteVmConfigInput {
  vmid: string;
  content: string;
}

export interface VmDeletionPolicy {
  allowBanned: boolean;
  allowPrepareNoResources: boolean;
  allowOrphan: boolean;
}

export interface VmDeletionEvaluateItem {
  vmid: number | string;
  node?: string | undefined;
  vm_uuid?: string | undefined;
  name?: string | undefined;
}

export interface VmDeletionEvaluationResult {
  vmid: number | string;
  can_delete: boolean;
  reason: string;
  reasons?: string[] | undefined;
  node?: string | undefined;
  vm_uuid?: string | undefined;
  reason_code: string;
  linked_bot_ids: string[];
  linked_bots: number;
}

export interface VmPatchChange {
  field: string;
  oldValue: string;
  newValue: string;
}

export interface VmPatchPlan {
  patched: string;
  changes: VmPatchChange[];
  generatedIp: string;
  generatedMac: string;
  generatedSerial: string;
  vncPort: number;
  argsBlock: string;
}

export interface VmPatchPlanInput {
  vmid: number | string;
  node?: string | undefined;
  vm_uuid?: string | undefined;
  seed?: number | string | undefined;
  intent?: Record<string, unknown> | undefined;
  profile?: Record<string, unknown> | undefined;
  template?: Record<string, unknown> | undefined;
  current_config?: string | undefined;
}

export interface VmPatchApplyInput extends VmPatchPlanInput {
  apply?: boolean | undefined;
  dry_run?: boolean | undefined;
}
