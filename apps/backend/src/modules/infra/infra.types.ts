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
