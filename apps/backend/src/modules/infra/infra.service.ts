import { Injectable } from '@nestjs/common';
import { InfraServiceError } from './infra.errors';
import { InfraRepository } from './infra.repository';
import type {
  CloneVmInput,
  DeleteVmInput,
  ExecSshInput,
  UpdateVmConfigInput,
  VmRecord,
  WriteVmConfigInput,
} from './infra.types';
import {
  assertCommand,
  assertContent,
  assertNode,
  assertVmid,
  isSshCommandAllowlisted,
  normalizeTenantId,
  normalizeVmAction,
  parseTimeoutMs,
  resolveVmStatusByAction,
} from './infra.utils';

@Injectable()
export class InfraService {
  private taskSequence = 0;

  constructor(private readonly repository: InfraRepository) {}

  private nextUpid(): string {
    this.taskSequence += 1;
    return `UPID:nest:${Date.now().toString(16)}:${this.taskSequence}:mock-task`;
  }

  private async ensureVm(tenantId: string, node: string, vmid: string): Promise<VmRecord> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedNode = assertNode(node);
    const normalizedVmid = String(vmid).trim();

    const existing = await this.repository.findVm(
      normalizedTenantId,
      normalizedNode,
      normalizedVmid,
    );
    if (existing) {
      return existing;
    }

    const created: VmRecord = {
      node: normalizedNode,
      vmid: normalizedVmid,
      name: `vm-${normalizedVmid}`,
      status: 'running',
      config: {
        cores: 2,
        memory: 4096,
      },
    };

    return this.repository.upsertVm({
      tenantId: normalizedTenantId,
      node: created.node,
      vmid: created.vmid,
      payload: created,
    });
  }

  async login(tenantId: string): Promise<{ connected: true }> {
    normalizeTenantId(tenantId);
    return { connected: true };
  }

  async status(tenantId: string): Promise<{ connected: true; version: Record<string, unknown> }> {
    normalizeTenantId(tenantId);
    return {
      connected: true,
      version: {
        product: 'proxmox-mock',
        release: '8.x',
      },
    };
  }

  async listNodeVms(tenantId: string, node: string): Promise<Array<Record<string, unknown>>> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedNode = assertNode(node);

    const records = await this.repository.listVmsByNode(normalizedTenantId, normalizedNode);
    if (records.length === 0) {
      return [
        {
          vmid: 100,
          name: 'template-100',
          status: 'stopped',
          node: normalizedNode,
        },
      ];
    }

    return records.map((record) => ({
      vmid: Number(record.vmid),
      name: record.name,
      status: record.status,
      node: record.node,
    }));
  }

  async cloneVm(tenantId: string, input: CloneVmInput): Promise<{ upid: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const sourceVm = await this.ensureVm(normalizedTenantId, input.node, input.vmid);

    const targetVmid = String(input.body.newid || '').trim();
    if (!targetVmid) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'newid is required');
    }

    const targetName = String(input.body.name || `vm-${targetVmid}`).trim();
    const targetNode = String(input.node || sourceVm.node).trim();

    const cloned: VmRecord = {
      ...sourceVm,
      node: targetNode,
      vmid: targetVmid,
      name: targetName || `vm-${targetVmid}`,
      status: 'stopped',
      config: {
        ...sourceVm.config,
        ...(input.body.storage ? { storage: String(input.body.storage).trim() } : {}),
        ...(input.body.format ? { format: String(input.body.format).trim() } : {}),
        ...(input.body.full !== undefined ? { full: input.body.full } : {}),
      },
    };

    await this.repository.upsertVm({
      tenantId: normalizedTenantId,
      node: cloned.node,
      vmid: cloned.vmid,
      payload: cloned,
    });

    return {
      upid: this.nextUpid(),
    };
  }

  async getVmConfig(
    tenantId: string,
    node: string,
    vmid: string,
  ): Promise<Record<string, unknown>> {
    const vm = await this.ensureVm(tenantId, node, vmid);
    return {
      vmid: Number(vm.vmid),
      name: vm.name,
      status: vm.status,
      ...vm.config,
    };
  }

  async updateVmConfig(tenantId: string, input: UpdateVmConfigInput): Promise<{ upid: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const vm = await this.ensureVm(normalizedTenantId, input.node, input.vmid);

    const merged: VmRecord = {
      ...vm,
      config: {
        ...vm.config,
        ...(input.body || {}),
      },
    };

    await this.repository.upsertVm({
      tenantId: normalizedTenantId,
      node: merged.node,
      vmid: merged.vmid,
      payload: merged,
    });

    return {
      upid: this.nextUpid(),
    };
  }

  async getTaskStatus(
    tenantId: string,
    node: string,
    upid: string,
  ): Promise<Record<string, unknown>> {
    normalizeTenantId(tenantId);
    const normalizedNode = assertNode(node);
    const normalizedUpid = String(upid || '').trim();
    if (!normalizedUpid) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'upid is required');
    }

    return {
      upid: normalizedUpid,
      node: normalizedNode,
      status: 'stopped',
      exitstatus: 'OK',
    };
  }

  async vmAction(
    tenantId: string,
    node: string,
    vmid: string,
    action: string,
  ): Promise<{ upid: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedAction = normalizeVmAction(action);

    const vm = await this.ensureVm(normalizedTenantId, node, vmid);
    const nextVm: VmRecord = {
      ...vm,
      status: resolveVmStatusByAction(vm.status, normalizedAction),
    };

    await this.repository.upsertVm({
      tenantId: normalizedTenantId,
      node: nextVm.node,
      vmid: nextVm.vmid,
      payload: nextVm,
    });

    return {
      upid: this.nextUpid(),
    };
  }

  async deleteVm(tenantId: string, input: DeleteVmInput): Promise<{ upid: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);

    await this.repository
      .deleteVm(normalizedTenantId, String(input.node).trim(), String(input.vmid).trim())
      .catch(() => undefined);

    return {
      upid: this.nextUpid(),
    };
  }

  async sendKey(
    tenantId: string,
    node: string,
    vmid: string,
    key: string,
  ): Promise<{ transport: string; upid: string | null }> {
    await this.ensureVm(tenantId, node, vmid);
    const normalizedKey = String(key).trim();
    if (!normalizedKey) {
      throw new InfraServiceError(400, 'BAD_REQUEST', 'key is required');
    }

    return {
      transport: 'proxmox-api-mock',
      upid: null,
    };
  }

  async getVmCurrentStatus(
    tenantId: string,
    node: string,
    vmid: string,
  ): Promise<Record<string, unknown>> {
    const vm = await this.ensureVm(tenantId, node, vmid);
    return {
      vmid: Number(vm.vmid),
      status: vm.status,
      qmpstatus: vm.status === 'running' ? 'running' : 'stopped',
      node: vm.node,
      name: vm.name,
    };
  }

  async getClusterResources(tenantId: string): Promise<Array<Record<string, unknown>>> {
    normalizeTenantId(tenantId);
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

  async sshTest(tenantId: string): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    normalizeTenantId(tenantId);
    return {
      stdout: 'SSH connection OK',
      stderr: '',
      exitCode: 0,
    };
  }

  async execSsh(
    tenantId: string,
    input: ExecSshInput,
  ): Promise<{
    stdout: string;
    stderr: string;
    exitCode: number;
    allowlisted: boolean;
  }> {
    normalizeTenantId(tenantId);
    const command = assertCommand(String(input.command || ''));

    const allowlisted = isSshCommandAllowlisted(command);
    if (!allowlisted) {
      throw new InfraServiceError(
        403,
        'SSH_COMMAND_FORBIDDEN',
        'Command is not allowlisted. Set SSH_EXEC_ALLOW_UNSAFE=true for emergency bypass.',
      );
    }

    const timeoutMs = parseTimeoutMs(input.timeout, 30_000);

    return {
      stdout: `Executed (${timeoutMs}ms): ${command}`,
      stderr: '',
      exitCode: 0,
      allowlisted,
    };
  }

  async readVmConfig(tenantId: string, vmid: string): Promise<{ config: string }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedVmid = assertVmid(vmid);

    const existing = await this.repository.findVmConfig(normalizedTenantId, normalizedVmid);
    if (existing) {
      return { config: existing };
    }

    return {
      config: `cores: 2\nmemory: 4096\nname: vm-${normalizedVmid}\n`,
    };
  }

  async writeVmConfig(tenantId: string, input: WriteVmConfigInput): Promise<{ written: true }> {
    const normalizedTenantId = normalizeTenantId(tenantId);
    const normalizedVmid = assertVmid(input.vmid);
    const content = assertContent(String(input.content || ''));

    await this.repository.upsertVmConfig(normalizedTenantId, normalizedVmid, content);

    return {
      written: true,
    };
  }
}
