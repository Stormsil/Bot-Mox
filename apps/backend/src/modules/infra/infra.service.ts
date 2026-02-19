import { Injectable } from '@nestjs/common';

const ALLOWLISTED_SSH_PREFIXES = ['qm ', 'pvesh ', 'cat ', 'echo ', 'ls ', 'grep '];
const ALLOWLISTED_SSH_EXACT = new Set(['qm list']);

interface VmRecord {
  node: string;
  vmid: string;
  name: string;
  status: string;
  config: Record<string, unknown>;
}

interface CloneVmInput {
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

interface UpdateVmConfigInput {
  node: string;
  vmid: string;
  body: Record<string, unknown>;
}

interface DeleteVmInput {
  node: string;
  vmid: string;
  purge?: boolean | undefined;
  destroyUnreferencedDisks?: boolean | undefined;
}

interface ExecSshInput {
  command: string;
  timeout?: number | undefined;
}

interface WriteVmConfigInput {
  vmid: string;
  content: string;
}

export class InfraServiceError extends Error {
  readonly status: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = 'InfraServiceError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

@Injectable()
export class InfraService {
  private readonly vmStore = new Map<string, VmRecord>();
  private readonly vmConfigStore = new Map<string, string>();
  private taskSequence = 0;

  private makeVmKey(node: string, vmid: string): string {
    return `${String(node).trim()}:${String(vmid).trim()}`;
  }

  private nextUpid(): string {
    this.taskSequence += 1;
    return `UPID:nest:${Date.now().toString(16)}:${this.taskSequence}:mock-task`;
  }

  private ensureVm(node: string, vmid: string): VmRecord {
    const key = this.makeVmKey(node, vmid);
    const existing = this.vmStore.get(key);
    if (existing) {
      return existing;
    }

    const created: VmRecord = {
      node: String(node).trim(),
      vmid: String(vmid).trim(),
      name: `vm-${String(vmid).trim()}`,
      status: 'running',
      config: {
        cores: 2,
        memory: 4096,
      },
    };

    this.vmStore.set(key, created);
    return created;
  }

  private isSshCommandAllowlisted(command: string): boolean {
    const normalized = String(command || '')
      .trim()
      .toLowerCase();
    if (!normalized) {
      return false;
    }
    if (ALLOWLISTED_SSH_EXACT.has(normalized)) {
      return true;
    }
    return ALLOWLISTED_SSH_PREFIXES.some((prefix) => normalized.startsWith(prefix));
  }

  login(): { connected: true } {
    return { connected: true };
  }

  status(): { connected: true; version: Record<string, unknown> } {
    return {
      connected: true,
      version: {
        product: 'proxmox-mock',
        release: '8.x',
      },
    };
  }

  listNodeVms(node: string): Array<Record<string, unknown>> {
    const normalizedNode = String(node).trim();
    if (!normalizedNode) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'node is required');
    }

    const vmList = [...this.vmStore.values()]
      .filter((record) => record.node === normalizedNode)
      .map((record) => ({
        vmid: Number(record.vmid),
        name: record.name,
        status: record.status,
        node: record.node,
      }));

    if (vmList.length > 0) {
      return vmList;
    }

    return [
      {
        vmid: 100,
        name: 'template-100',
        status: 'stopped',
        node: normalizedNode,
      },
    ];
  }

  cloneVm(input: CloneVmInput): { upid: string } {
    const sourceVm = this.ensureVm(input.node, input.vmid);
    const targetVmid = String(input.body.newid ?? '').trim();
    const clonedVmid = targetVmid.length > 0 ? targetVmid : `${Number(sourceVm.vmid) + 1}`;
    const targetKey = this.makeVmKey(input.node, clonedVmid);

    const cloned: VmRecord = {
      ...sourceVm,
      vmid: clonedVmid,
      name: String(input.body.name || `${sourceVm.name}-clone`).trim(),
      status: 'stopped',
      config: {
        ...sourceVm.config,
      },
    };

    this.vmStore.set(targetKey, cloned);

    return {
      upid: this.nextUpid(),
    };
  }

  getVmConfig(node: string, vmid: string): Record<string, unknown> {
    const vm = this.ensureVm(node, vmid);
    return {
      ...vm.config,
      vmid: vm.vmid,
      name: vm.name,
      node: vm.node,
    };
  }

  updateVmConfig(input: UpdateVmConfigInput): { upid: string } {
    const vm = this.ensureVm(input.node, input.vmid);
    vm.config = {
      ...vm.config,
      ...input.body,
    };
    this.vmStore.set(this.makeVmKey(input.node, input.vmid), vm);

    return {
      upid: this.nextUpid(),
    };
  }

  getTaskStatus(node: string, upid: string): Record<string, unknown> {
    const normalizedNode = String(node).trim();
    const normalizedUpid = String(upid).trim();
    if (!normalizedNode || !normalizedUpid) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'Invalid task id');
    }

    return {
      upid: normalizedUpid,
      node: normalizedNode,
      status: 'stopped',
      exitstatus: 'OK',
    };
  }

  vmAction(node: string, vmid: string, action: string): { upid: string } {
    const normalizedAction = String(action).trim().toLowerCase();
    const allowed = new Set(['start', 'stop', 'shutdown', 'reset', 'suspend', 'resume']);
    if (!allowed.has(normalizedAction)) {
      throw new InfraServiceError(400, 'BAD_REQUEST', `Invalid action: ${normalizedAction}`);
    }

    const vm = this.ensureVm(node, vmid);
    if (normalizedAction === 'start' || normalizedAction === 'resume') {
      vm.status = 'running';
    }
    if (
      normalizedAction === 'stop' ||
      normalizedAction === 'shutdown' ||
      normalizedAction === 'suspend'
    ) {
      vm.status = 'stopped';
    }
    this.vmStore.set(this.makeVmKey(node, vmid), vm);

    return {
      upid: this.nextUpid(),
    };
  }

  deleteVm(input: DeleteVmInput): { upid: string } {
    const key = this.makeVmKey(input.node, input.vmid);
    this.vmStore.delete(key);

    return {
      upid: this.nextUpid(),
    };
  }

  sendKey(node: string, vmid: string, key: string): { transport: string; upid: string | null } {
    this.ensureVm(node, vmid);
    const normalizedKey = String(key).trim();
    if (!normalizedKey) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'key is required');
    }

    return {
      transport: 'proxmox-api-mock',
      upid: null,
    };
  }

  getVmCurrentStatus(node: string, vmid: string): Record<string, unknown> {
    const vm = this.ensureVm(node, vmid);
    return {
      vmid: Number(vm.vmid),
      status: vm.status,
      qmpstatus: vm.status === 'running' ? 'running' : 'stopped',
      node: vm.node,
      name: vm.name,
    };
  }

  getClusterResources(): Array<Record<string, unknown>> {
    return [
      {
        id: 'node/pve',
        type: 'node',
        node: 'pve',
        status: 'online',
      },
      {
        id: 'storage/local-lvm',
        type: 'storage',
        node: 'pve',
        storage: 'local-lvm',
        status: 'available',
      },
    ];
  }

  sshTest(): { stdout: string; stderr: string; exitCode: number } {
    return {
      stdout: 'SSH connection OK',
      stderr: '',
      exitCode: 0,
    };
  }

  execSsh(input: ExecSshInput): {
    stdout: string;
    stderr: string;
    exitCode: number;
    allowlisted: boolean;
  } {
    const command = String(input.command || '').trim();
    if (!command) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'command is required');
    }

    const allowlisted = this.isSshCommandAllowlisted(command);
    if (!allowlisted) {
      throw new InfraServiceError(
        403,
        'SSH_COMMAND_FORBIDDEN',
        'Command is not allowlisted. Set SSH_EXEC_ALLOW_UNSAFE=true for emergency bypass.',
      );
    }

    const timeoutMs = Number.isFinite(Number(input.timeout)) ? Number(input.timeout) : 30_000;

    return {
      stdout: `Executed (${timeoutMs}ms): ${command}`,
      stderr: '',
      exitCode: 0,
      allowlisted,
    };
  }

  readVmConfig(vmid: string): { config: string } {
    const normalizedVmid = String(vmid).trim();
    if (!normalizedVmid) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'Invalid vmid');
    }

    const existing = this.vmConfigStore.get(normalizedVmid);
    if (existing) {
      return { config: existing };
    }

    const fallback = `cores: 2\nmemory: 4096\nname: vm-${normalizedVmid}\n`;
    return {
      config: fallback,
    };
  }

  writeVmConfig(input: WriteVmConfigInput): { written: true } {
    const normalizedVmid = String(input.vmid).trim();
    if (!normalizedVmid) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'Invalid vmid');
    }

    const content = String(input.content || '');
    if (!content) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'content is required');
    }

    this.vmConfigStore.set(normalizedVmid, content);
    return {
      written: true,
    };
  }
}
